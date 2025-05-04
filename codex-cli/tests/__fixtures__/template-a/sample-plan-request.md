## Template A1 — Plan-and-Execute Cycle

---
#### 📈 CYCLE 1 CONTEXT (filled by Executor, served to Planner)

[🔢 CYCLE_NUMBER] 1
[📂 PROJECT] test-project
[🗺️ PREVIOUS GOAL (Cycle 0)] Initial goal
[✅ PREVIOUS OUTCOME (Cycle 0)] Completed initial setup
[🚧 CURRENT BLOCKERS] Test blocker 1, Test blocker 2
[🎯 NEXT GOAL (Cycle 1)] Implement feature X
[📜 HISTORY PATH] .specstory/history/test.md
[⏳ TIME BOX] 1 hour
[📎 RELEVANT ARTIFACTS] file1.ts, file2.ts
[🗒️ SCRATCHPAD DELTA] Updated progress section
[🔍 AVAILABLE MCP TOOLS] .cursor/available_mcp_tools.md
---
#### 📞 EXECUTOR ➡️ PLANNER QUESTIONS / REQUESTS (optional, filled by Executor)
[❓ ANALYSIS & JUSTIFICATION] Please analyze approach X
[❓ PLAN] Need detailed steps for feature X
[❓ BLOCKER SOLUTIONS] How to solve blocker 1?
[❓ BEST PRACTICES /MENTAL MODELS] Best practices for feature X
[❓ MCP TOOLS] Recommend tools for implementation
---
#### 📝 PLANNER RESPONSE FOR CYCLE 1 (filled by Planner, shipped to Executor)

1.  **ANALYSIS & JUSTIFICATION:** This is just a placeholder.
2.  **PLAN (STRICTLY ≤ 8 ATOMIC ACTIONS; ACTION 1 MUST BE `Review scratchpad.md`):** This is just a placeholder.
3.  **BLOCKER SOLUTIONS:** This is just a placeholder.
4.  **BEST PRACTICES / MENTAL MODELS:** This is just a placeholder.
5.  **RECOMMENDED MCP TOOL CALLS (via pluggedin_proxy):** This is just a placeholder.
6.  **EXECUTOR FOLLOW-UP CHECKLIST (to be executed at Cycle 1 conclusion):**
    
```text
    a. Summarize the work done and fresh insights in the `PREVIOUS OUTCOME` field of Prompt A{n+1}.
    b. Refresh the `CURRENT BLOCKERS` list in Prompt A{n+1}.
    c. Set the `NEXT GOAL` for Cycle {n+1} in Prompt A{n+1}.
    d. Fully populate the `CYCLE {n+1} CONTEXT` section of the new Template A → bake Prompt A{n+1}.
    e. Update `scratchpad.md` with key challenges, lessons learned, success criteria, progress, and delta notes.
    f. Verify `scratchpad.md` accurately reflects the latest state and commit changes if necessary.
    g. Blast Prompt A{n+1} out as the final message of your response.
```
--- 