# Oppie Remote Cursor Control Mesh (M1) — Low-Level Design  
*(algorithms, utilities, tests — brand **SoraSpark**, codename **oppie.xyz**)*

---

## 1 Implementation Scope

This document breaks the **M1** milestone into concrete, testable units of work for the **Remote Cursor Control Mesh**.  It supersedes previous *Dev-Loop* notes and merges them with the new remote PWA surface.

| Component            | Status in M1 | Language | LOC target | Notes |
|----------------------|--------------|----------|-----------|-------|
| Cursor Extension Core| ✅ ship       | TS       | < 500     | IPC + Webview timeline |
| PocketFlow Orchestrator | ✅ ship    | TS       | < 150     | 3-step loop, adapters plug-in |
| ToolBroker / Plug-in Loader | ✅ ship | TS | < 200 | Dynamic `import()` of `*.plugin.js` |
| Sidecar Daemon       | ✅ ship       | Py 3.12  | < 400     | WSS bridge + keystroke fallback + push buffer |
| Dev-Loop Watcher     | ✅ ship       | Py 3.12  | < 250     | Regex + Agent S recovery |
| Agent S Helpers      | ✅ ship       | Py 3.12  | < 80      | focus + type utilities |
| Vector Store Client  | ✅ ship       | TS       | < 120     | Wraps rqlite HTTP |

---

## 2 IPC & Message Schema

```ts
// shared.ts (imported by Extension & Sidecar)
export type Msg =
  | { type: 'runPlan'; plan: Step[] }
  | { type: 'chat'; prompt: string }
  | { type: 'progress'; pct: number; log: string }
  | { type: 'diff'; patch: string }
  | { type: 'approve'; ok: boolean }
  | { type: 'recover'; ok: boolean; ts: number };  // NEW — push recovery status to PWA

export const IPC_PATH = process.platform === 'win32'
  ? r"\\.\\pipe\\oppie-ipc"
  : '/tmp/oppie-ipc.sock';
```

Push events of type `recover` allow the PWA to update its timeline and measure **P95 push latency** KPI.

*Transport*: UNIX domain socket (Windows named pipe) created by the **Extension Core** on activation.  The **Sidecar** reconnects with exponential backoff.

---

## 3 Cursor Extension Core (TypeScript)

### 3.1 Activation & IPC server

```ts
import { IPC_PATH, Msg } from './shared';
import * as vscode from 'vscode';
import net from 'net';

export function activate(ctx: vscode.ExtensionContext) {
  const server = net.createServer(socket => {
    socket.on('data', async (raw) => {
      const msg: Msg = JSON.parse(raw.toString());
      if (msg.type === 'runPlan') {
        await executePlan(msg.plan);
      } else if (msg.type === 'chat') {
        await invokeChat(msg.prompt);
      }
    });
  }).listen(IPC_PATH);

  ctx.subscriptions.push({ dispose() { server.close(); } });
}
```

### 3.2 `executePlan` & PocketFlow mini-loop

```ts
async function executePlan(plan: Step[]) {
  const pf = new PocketFlow({ adapters: loadReasoningAdapters() });
  for await (const evt of pf.run(plan)) {
    webviewPost(evt);            // stream to PWA
    sidecarNotify(evt);          // optional fallback
  }
}
```

### 3.3 Chat Invocation Strategy

1. Attempt dynamic command discovery (regex `^cursor\..*(chat|composer)`)
2. If found, `executeCommand` + clipboard paste + `type('\n')`.
3. Else, send `{ type: 'chat', prompt }` back to Sidecar which uses keystroke automation.

---

## 4 ToolBroker & Plug-in Loader

```ts
import glob from 'fast-glob';

export async function loadPlugins(): Promise<Plugin[]> {
  const files = await glob('plugins/**/*.plugin.js', { cwd: vscode.workspace.rootPath });
  return Promise.all(files.map(f => import(f)));
}
```

Each plug-in exposes:

```ts
export interface Plugin {
  name: string;
  version: string;
  apply(step: Step, ctx: ExecCtx): Promise<ExecResult>;
}
```

The **ToolBroker** iterates over steps and delegates to the first plug-in whose `apply` returns non-null.

---

## 5 Sidecar Daemon (Python 3.12)

```python
import asyncio, json, websockets, socket, os, sys, pathlib
from ipc_shared import IPC_PATH
WS_URL = os.environ.get('OPPIE_WSS') or 'wss://relay.oppie.xyz/session?jwt=…'

async def main():
    # connect IPC first
    reader, writer = await asyncio.open_unix_connection(IPC_PATH) if os.name != 'nt' else await asyncio.open_connection(path=IPC_PATH)
    async with websockets.connect(WS_URL) as ws:
        while True:
            data = await ws.recv()
            msg = json.loads(data)
            await handle(msg, writer)

def handle(msg, writer):
    writer.write(json.dumps(msg).encode())
```

### 5.1 Fallback keystroke path

```python
import pyautogui

def send_chat(prompt: str):
    pyautogui.hotkey('command', 'l')  # focus Composer
    pyautogui.write(prompt)
    pyautogui.press('enter')
```

This path is invoked when the Extension replies with `{ type: 'chat', prompt }`.

---

## 6 Dev-Loop Watcher (Python 3.12)

Most logic is unchanged from the legacy *Dev-Loop* but now listens to the real `cursor-executor` process spawned by the Extension.

```python
import re, subprocess, json, time
from agent_s_helpers import focus_cursor, type_and_enter

ERROR_RE  = re.compile(r"Exceeded 25 native tool calls")
TEMPLATE_RE = re.compile(r"### 🔄  Template A")

def tail_executor(cmd):
    with subprocess.Popen(cmd,
                          stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT,
                          text=True) as proc:
        for line in proc.stdout:
            handle_line(line, proc.pid)

def handle_line(line, pid):
    log("EXEC_LOG", line.rstrip(), pid)
    if ERROR_RE.search(line):
        recover("TOOL_LIMIT", pid)
    elif line.startswith("🪄 assistant_bubble_end"):
        if not TEMPLATE_RE.search(line):
            recover("MISSING_TEMPLATE", pid)

def recover(reason, pid):
    log("RECOVER_START", reason, pid)
    focus_cursor()
    type_and_enter(RECOVERY_PROMPT)
    log("RECOVER_DONE", reason, pid)
```

### 6.1 Recovery Prompt Constant

```python
RECOVERY_PROMPT = (
    "Cursor Executor, on top of @.cursorrules, @tech_stack.md and @scratchpad.md, "
    "strictly follow instructions from Codex Planner in the `Template Aₓ — Plan-and-Execute Loop` "
    "above to continue at where you stopped"
)
```

---

## 7 Testing & QA Matrix

| Level        | Tool / Framework   | Assertions |
|--------------|--------------------|------------|
| **Unit**     | `pytest`, `jest`   | IPC parse, regex match, plugin selection |
| **Contract** | `pact` (TS ↔ Py)   | Extension ↔ Sidecar message schema |
| **Integration** | `pexpect`, `vitest` | Fake executor → watcher recovers |
| **End-to-end** | Manual, screencast | Trigger from phone, watch loop for 1 h |

---

## 8 Packaging & Distribution

| Target            | Command |
|-------------------|---------|
| **Watcher Bin**   | `pyinstaller watcher.spec` |
| **Extension VSIX**| `pnpm package` |
| **Sidecar Zip**   | `pyinstaller sidecar.spec` |

`start_devloop.sh` spawns Planner (`codex -m o3 -a full-auto`) in a new iTerm tab **and** launches `watcher.bin` in the current shell.

---

## 9 Security & Privacy Notes

* **Accessibility** Agent S binaries are signed; first launch will request Assistive permission (macOS) — documented in README.
* **Sandbox** Sidecar and plugins run in separate processes, no shared memory.
* **Data** Only plan / diff metadata is sent to the relay; source code never leaves the workstation.

---

## 10 Performance Tuning

*Steady-state CPU* < 2 %, *RAM* < 120 MB per process.  Use non-blocking IO everywhere.  Profile with `py-spy` and `vscode-profiling`.

---

## Planner Integration

### Codex-CLI as Template A Planner

Codex-CLI将增强对Template A循环中Planner角色的支持，通过以下具体实现:

#### 1. 新CLI标志设计

为支持Planner角色引入新的命令行参数:

```bash
# 专门的Planner模式
codex --planner <PromptA_path> [options]
  --project-doc <path>     # 项目上下文文档路径
  --save-response <path>   # 保存原始响应到指定文件
  --format json|markdown   # 输出格式（默认markdown）

# 辅助功能
codex --fill-template <input> --output <output>  # 自动填充缺失的Template A部分
```

#### 2. Template A解析和渲染工具

实现一个`template-a`模块，封装Template A格式处理:

```typescript
// src/template-a/index.ts
export type PlanRequest = {
  cycleNumber: number;
  project: string;
  previousGoal?: string;
  previousOutcome?: string;
  currentBlockers: string[];
  nextGoal: string;
  historyPath?: string;
  timeBox?: string;
  relevantArtifacts?: string[];
  scratchpadDelta?: string;
};

export type PlanResponse = {
  analysis: string;
  plan: string[];
  blockerSolutions: string;
  bestPractices: string;
  recommendedTools?: string;
  executorChecklist: string[];
};

export const templateA = {
  // 解析Template A请求文件
  parse: (content: string): PlanRequest => {
    // 使用正则表达式提取各部分
    const cycleMatch = content.match(/\[🔢 CYCLE_NUMBER\]\s*(\d+)/);
    // ...其他部分的提取逻辑
    
    return {
      cycleNumber: cycleMatch ? parseInt(cycleMatch[1]) : 0,
      // ...组装其他字段
    };
  },
  
  // 渲染PlanResponse为格式化字符串
  render: (response: PlanResponse, cycleNumber: number): string => {
    return `
#### 📝 PLANNER RESPONSE FOR CYCLE ${cycleNumber} (filled by Planner, shipped to Executor)

1.  **ANALYSIS & JUSTIFICATION:** ${response.analysis}

2.  **PLAN (STRICTLY ≤ 8 ATOMIC ACTIONS; ACTION 1 MUST BE \`Review scratchpad.md\`):** 
${response.plan.map((step, i) => `    ${i+1}. ${step}`).join('\n')}

3.  **BLOCKER SOLUTIONS:** ${response.blockerSolutions}

4.  **BEST PRACTICES / MENTAL MODELS:** ${response.bestPractices}

5.  **RECOMMENDED MCP TOOL CALLS (via pluggedin_proxy):** ${response.recommendedTools || 'None specifically required for this cycle.'}

6.  **EXECUTOR FOLLOW-UP CHECKLIST (to be executed at Cycle ${cycleNumber} conclusion):**
    
\`\`\`text
    a. Summarize the work done and fresh insights in the \`PREVIOUS OUTCOME\` field of Prompt A{${cycleNumber}+1}.
    b. Refresh the \`CURRENT BLOCKERS\` list in Prompt A{${cycleNumber}+1}.
    c. Set the \`NEXT GOAL\` for Cycle {${cycleNumber}+1} in Prompt A{${cycleNumber}+1}.
    d. Fully populate the \`CYCLE {${cycleNumber}+1} CONTEXT\` section of the new Template A → bake Prompt A{${cycleNumber}+1}.
    e. Update \`scratchpad.md\` with key challenges, lessons learned, success criteria, progress, and delta notes.
    f. Verify \`scratchpad.md\` accurately reflects the latest state and commit changes if necessary.
    g. Blast Prompt A{${cycleNumber}+1} out as the final message of your response.
\`\`\`
`;
  },
  
  // 验证PlanResponse是否有效
  validate: (response: PlanResponse): boolean => {
    // 检查必要字段是否存在
    if (!response.analysis || !response.plan || !response.blockerSolutions || 
        !response.bestPractices || !response.executorChecklist) {
      return false;
    }
    
    // 验证plan是否符合要求（不超过8个步骤，第一步必须为Review scratchpad.md）
    if (response.plan.length > 8 || 
        !response.plan[0].toLowerCase().includes('review scratchpad.md')) {
      return false;
    }
    
    return true;
  }
};
```

#### 3. 实现Planner模式命令处理器

在CLI主程序中添加Planner模式支持:

```typescript
// src/cli-plan.ts
import { templateA } from './template-a';
import fs from 'fs';
import path from 'path';

export async function handlePlannerMode(args: {
  plannerPath: string,
  projectDoc?: string,
  saveResponse?: string,
  format?: 'json'|'markdown'
}) {
  // 1. 读取Template A请求文件
  const content = fs.readFileSync(args.plannerPath, 'utf8');
  const request = templateA.parse(content);
  
  // 2. 构建系统提示，提醒模型输出符合Template A格式
  const systemPrompt = `You are an expert software architect and planner. Your goal is to guide the Executor through a specific software task by analyzing requirements and creating a precise, actionable plan. Follow the Template A format EXACTLY in your response.`;
  
  // 3. 调用模型
  const modelResponse = await callModel(
    systemPrompt,
    content,
    args.projectDoc ? fs.readFileSync(args.projectDoc, 'utf8') : undefined
  );
  
  // 4. 如果指定了保存路径，保存原始响应
  if (args.saveResponse) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const savePath = args.saveResponse.replace('{timestamp}', timestamp);
    fs.writeFileSync(savePath, modelResponse);
  }
  
  // 5. 根据指定格式输出
  if (args.format === 'json') {
    // 提取响应各部分并转为JSON
    const extractedResponse = extractPlannerResponse(modelResponse, request.cycleNumber);
    process.stdout.write(JSON.stringify(extractedResponse, null, 2));
  } else {
    // 默认直接输出原始响应
    process.stdout.write(modelResponse);
  }
}

// 从模型响应中提取结构化的Planner响应
function extractPlannerResponse(response: string, cycleNumber: number): PlanResponse {
  // 使用正则表达式提取各部分
  // ...实现提取逻辑
  
  return {
    analysis: "...",
    plan: ["..."],
    blockerSolutions: "...",
    bestPractices: "...",
    recommendedTools: "...",
    executorChecklist: ["..."]
  };
}
```

#### 4. 与send_codex_plan_request.sh集成

优化`send_codex_plan_request.sh`脚本与新CLI标志配合:

```bash
#!/usr/bin/env bash
set -eo pipefail

# 查找最新的plan请求文件
LATEST_PLAN_REQUEST=$(ls -t .scratchpad_logs/*_plan_request.md 2>/dev/null | head -n 1)
if [[ -z "$LATEST_PLAN_REQUEST" || ! -f "$LATEST_PLAN_REQUEST" ]]; then
  echo "Error: No plan request file found in .scratchpad_logs/" >&2
  exit 1
fi

# 定义项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 生成时间戳和响应文件路径
TIMESTAMP=$(date +"%Y-%m-%dT%H_%M_%S")
SCRATCHPAD_PLAN_RESPONSE=".scratchpad_logs/${TIMESTAMP}_plan_response.md"

# 使用Planner模式调用codex
echo "Executing: codex --planner \"$LATEST_PLAN_REQUEST\" --project-doc \"$PROJECT_ROOT/scratchpad.md\""

# 调用codex并保存输出
codex --planner "$LATEST_PLAN_REQUEST" \
      --project-doc "$PROJECT_ROOT/scratchpad.md" \
      > "$SCRATCHPAD_PLAN_RESPONSE"

CODEX_EXIT_CODE=$?

echo "--------------------------------------------------"
echo "✅ Planner的响应已保存到: $SCRATCHPAD_PLAN_RESPONSE"
echo "--------------------------------------------------"

exit $CODEX_EXIT_CODE
```

### 测试与质量保证

为确保新功能的稳定性和兼容性:

1. **单元测试**
   - 测试Template A解析和渲染功能
   - 测试不同格式的请求文件
   - 测试边界情况（缺失字段、空字段等）

2. **集成测试**
   - 模拟Planner模式的完整工作流
   - 验证与send_codex_plan_request.sh的集成
   - 测试不同输出格式

3. **键盘输入改进**
   - 已修复multiline-editor组件的键盘处理
   - 使用React useRef跟踪submitHandled状态
   - 确保在复杂事件序列中onSubmit只被调用一次

### 未来工作

1. **高级集成**
   - 直接支持设计文档更新命令
   - 实现自动提交更改到Git的功能
   - 添加版本控制和记录功能

2. **改进错误处理**
   - 为格式错误的Template A文件提供详细诊断
   - 添加自动修复建议

3. **性能优化**
   - 减少启动时间和内存占用
   - 优化响应解析和渲染性能

---

> **End of Low-Level Design (M1).**  Implementations must not diverge from the interfaces and constants defined here.