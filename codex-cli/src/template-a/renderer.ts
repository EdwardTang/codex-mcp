import { PlanResponse } from './types';

/**
 * Render a PlanResponse object into a properly formatted Markdown string
 * @param response PlanResponse object to render
 * @param cycleNumber Current cycle number
 * @returns Formatted Markdown string for Template A response
 */
export function renderPlanResponse(response: PlanResponse, cycleNumber: number): string {
  return `#### 📝 PLANNER RESPONSE FOR CYCLE ${cycleNumber} (filled by Planner, shipped to Executor)

1.  **ANALYSIS & JUSTIFICATION:** ${response.analysisAndJustification}
2.  **PLAN (STRICTLY ≤ 8 ATOMIC ACTIONS; ACTION 1 MUST BE \`Review scratchpad.md\`):** ${response.plan}
3.  **BLOCKER SOLUTIONS:** ${response.blockerSolutions}
4.  **BEST PRACTICES / MENTAL MODELS:** ${response.bestPracticesMentalModels}
5.  **RECOMMENDED MCP TOOL CALLS (via pluggedin_proxy):** ${response.recommendedMcpTools}
6.  **EXECUTOR FOLLOW-UP CHECKLIST (to be executed at Cycle ${cycleNumber} conclusion):**
    
\`\`\`text
    a. Summarize the work done and fresh insights in the \`PREVIOUS OUTCOME\` field of Prompt A{n+1}.
    b. Refresh the \`CURRENT BLOCKERS\` list in Prompt A{n+1}.
    c. Set the \`NEXT GOAL\` for Cycle {n+1} in Prompt A{n+1}.
    d. Fully populate the \`CYCLE {n+1} CONTEXT\` section of the new Template A → bake Prompt A{n+1}.
    e. Update \`scratchpad.md\` with key challenges, lessons learned, success criteria, progress, and delta notes.
    f. Verify \`scratchpad.md\` accurately reflects the latest state and commit changes if necessary.
    g. Blast Prompt A{n+1} out as the final message of your response.
\`\`\`
`;
}

/**
 * Validate that a PlanResponse contains all required sections
 * @param response PlanResponse object to validate
 * @returns true if the response is valid, false otherwise
 */
export function validatePlanResponse(response: PlanResponse): boolean {
  // Check that all required sections are present and non-empty
  return !!(
    response.analysisAndJustification &&
    response.plan &&
    response.blockerSolutions &&
    response.bestPracticesMentalModels &&
    response.recommendedMcpTools &&
    response.executorFollowUpChecklist
  );
} 