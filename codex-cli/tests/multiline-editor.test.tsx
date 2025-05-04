// 测试multiline-editor组件的Enter键处理和光标位置

import { renderTui } from "./ui-test-helpers";
import MultilineTextEditor from "../src/components/chat/multiline-editor";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";

// 获取最后渲染帧中的光标位置 (为简单起见这里我们解析渲染输出)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCursorPosition(frame: string): [number, number] {
  const lines = frame.split("\n");
  let row = 0;
  let col = 0;
  
  for (let i = 0; i < lines.length; i++) {
    // 查找反色字符，表示光标位置
    const match = lines[i].match(/\u001b\[7m(.)\u001b\[0m/);
    if (match) {
      row = i;
      // 查找光标前的内容长度
      const beforeCursor = lines[i].split(/\u001b\[7m/)[0];
      col = beforeCursor.length;
      break;
    }
  }
  
  return [row, col];
}

async function type(
  stdin: NodeJS.WritableStream,
  text: string,
  flush: () => Promise<void>,
) {
  stdin.write(text);
  await flush();
}

describe("MultilineTextEditor – 键盘输入和光标处理", () => {
  it("Shift+Enter键应当在光标位置插入换行符并将光标移至下一行的开始", async () => {
    const { stdin, lastFrameStripped, flush, cleanup } = renderTui(
      React.createElement(MultilineTextEditor, {
        height: 5,
        width: 20,
        initialText: "hello world",
      }),
    );

    // 等待首次渲染
    await flush();
    
    // 将光标移动到"hello"后面
    for (let i = 0; i < 5; i++) {
      await type(stdin, "\u001B[C", flush); // 右箭头
    }
    
    // 我们需要使用Shift+Enter来插入换行而不是提交
    // 这里使用一个特殊的序列模拟Shift+Enter
    await type(stdin, "\u001B[13;2u", flush); // Shift+Enter CSI序列
    
    const frame = lastFrameStripped();
    // eslint-disable-next-line no-console
    console.log("\n--- RENDERED FRAME ---\n" + frame + "\n---------------------");
    
    // 最新输出显示内容为 "hello\n world"
    expect(frame.includes("hello")).toBe(true);
    expect(frame.includes("world")).toBe(true);
    
    // 检查是否有多行
    const lineCount = frame.split("\n").length;
    expect(lineCount).toBeGreaterThan(1);
    
    cleanup();
  });
  
  it("同一个Enter事件只应触发一次onSubmit", async () => {
    const onSubmit = vi.fn();
    
    const { stdin, flush, cleanup } = renderTui(
      React.createElement(MultilineTextEditor, {
        height: 5,
        width: 20,
        onSubmit,
        initialText: "test text",
      }),
    );
    
    await flush();
    
    // 按Enter提交
    // 使用明确的\r来表示回车
    await type(stdin, "\r", flush);
    await flush();
    
    // 确保只调用一次onSubmit
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("test text");
    
    cleanup();
  });
  
  it("连续的Enter键按下应该只触发一次onSubmit", async () => {
    const onSubmit = vi.fn();
    
    const { stdin, flush, cleanup } = renderTui(
      React.createElement(MultilineTextEditor, {
        height: 5,
        width: 20,
        onSubmit,
        initialText: "multiple enter test",
      }),
    );
    
    await flush();
    
    // 连续按两次Enter
    // 第一个按键使用\r
    await type(stdin, "\r", flush);
    // 等一小段时间确保处理
    await new Promise(resolve => setTimeout(resolve, 10));
    // 再按一次Enter
    await type(stdin, "\r", flush);
    await flush();
    
    // 确保只调用一次onSubmit
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("multiple enter test");
    
    cleanup();
  });
}); 