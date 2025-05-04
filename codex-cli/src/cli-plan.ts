/**
 * CLI entrypoint for 'codex plan' subcommand
 * 
 * This module implements the 'plan' subcommand that allows Codex to run in batch mode 
 * as a dedicated planner, processing Template A request files and generating responses.
 */

import fs from 'fs';
import path from 'path';
import { AgentLoop } from './utils/agent/agent-loop';
import { createInputItem } from './utils/input-utils';
import { initLogger } from './utils/logger/log';
import { templateA } from './template-a';
import { PlanRequest, PlanResponse } from './template-a/types';
import chalk from 'chalk';

/**
 * Run Codex in planner mode
 * @param options Options for planner mode
 */
export async function runPlannerMode({
  requestFile,
  projectDoc,
  strict = false,
  model,
  provider,
  apiKey,
  disableResponseStorage = false,
  reasoningEffort = 'high',
}: {
  requestFile: string;
  projectDoc?: string;
  strict?: boolean;
  model: string;
  provider: string;
  apiKey: string;
  disableResponseStorage?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<void> {
  // Initialize logger
  initLogger();
  
  console.log(`Processing plan request: ${requestFile}`);
  
  try {
    // Parse the Template A request file
    const request = templateA.parse(requestFile);
    
    // Create the input message for the agent
    let inputMessage = buildAgentPrompt(request);
    
    // Add project document if provided
    if (projectDoc) {
      try {
        const projectDocContent = fs.readFileSync(projectDoc, 'utf8');
        inputMessage = `${inputMessage}\n\n## Project Document\n${projectDocContent}`;
      } catch (err) {
        console.error(`Error reading project document: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Create agent loop
    const agentLoop = new AgentLoop({
      model,
      provider,
      apiKey,
      inputItems: [createInputItem(inputMessage)],
      disableResponseStorage,
      quiet: true,
      reasoningEffort,
    });
    
    // Run the agent loop
    const response = await agentLoop.run();
    const responseText = response.getFullResponse();
    
    // Extract the planner response section
    const plannerResponseSection = extractPlannerResponse(responseText, request.context.cycleNumber);
    
    if (!plannerResponseSection && strict) {
      console.error(chalk.red('Error: Failed to extract a valid planner response section'));
      process.exit(1);
    }
    
    // Output the response
    console.log(plannerResponseSection || responseText);
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

/**
 * Build the agent prompt from a plan request
 * @param request The parsed plan request
 * @returns The formatted prompt for the agent
 */
function buildAgentPrompt(request: PlanRequest): string {
  const { context, questions } = request;
  
  // Basic information about the request
  let prompt = `# Codex Planner: Template A Plan Request (Cycle ${context.cycleNumber})
  
You are acting as the Planner in a recursive Plan-Execute loop. Your task is to analyze the 
current state and generate a detailed plan for the Executor to follow. The Executor will 
follow your instructions explicitly, so be thorough, precise, and specific.

## Current Context
- Cycle Number: ${context.cycleNumber}
- Project: ${context.project}
- Previous Goal: ${context.previousGoal}
- Previous Outcome: ${context.previousOutcome}
- Current Blockers: ${context.currentBlockers}
- Next Goal: ${context.nextGoal}
- Time Box: ${context.timeBox}
`;

  // Add executor questions if any are provided
  if (
    questions.analysisAndJustification ||
    questions.plan ||
    questions.blockerSolutions ||
    questions.bestPracticesMentalModels ||
    questions.mcpTools
  ) {
    prompt += `
## Executor Questions
${questions.analysisAndJustification ? `- Analysis & Justification: ${questions.analysisAndJustification}` : ''}
${questions.plan ? `- Plan: ${questions.plan}` : ''}
${questions.blockerSolutions ? `- Blocker Solutions: ${questions.blockerSolutions}` : ''}
${questions.bestPracticesMentalModels ? `- Best Practices/Mental Models: ${questions.bestPracticesMentalModels}` : ''}
${questions.mcpTools ? `- MCP Tools: ${questions.mcpTools}` : ''}
`;
  }

  // Add instructions for the expected response format
  prompt += `
## Response Format
Generate a structured response that follows this exact format:

#### 📝 PLANNER RESPONSE FOR CYCLE ${context.cycleNumber} (filled by Planner, shipped to Executor)

1.  **ANALYSIS & JUSTIFICATION:** [Your detailed analysis based on current context]
2.  **PLAN (STRICTLY ≤ 8 ATOMIC ACTIONS; ACTION 1 MUST BE \`Review scratchpad.md\`):** [Your step-by-step plan for the Executor]
3.  **BLOCKER SOLUTIONS:** [Your proposals to address current blockers]
4.  **BEST PRACTICES / MENTAL MODELS:** [Relevant engineering principles and mental models]
5.  **RECOMMENDED MCP TOOL CALLS (via pluggedin_proxy):** [Tools from the available MCP tools that would help execute the PLAN]
6.  **EXECUTOR FOLLOW-UP CHECKLIST (to be executed at Cycle ${context.cycleNumber} conclusion):**
    
\`\`\`text
    a. Summarize the work done and fresh insights in the \`PREVIOUS OUTCOME\` field of Prompt A{n+1}.
    b. Refresh the \`CURRENT BLOCKERS\` list in Prompt A{n+1}.
    c. Set the \`NEXT GOAL\` for Cycle {n+1} in Prompt A{n+1}.
    d. Fully populate the \`CYCLE {n+1} CONTEXT\` section of the new Template A → bake Prompt A{n+1}.
    e. Update \`scratchpad.md\` with key challenges, lessons learned, success criteria, progress, and delta notes.
    f. Verify \`scratchpad.md\` accurately reflects the latest state and commit changes if necessary.
    g. Blast Prompt A{n+1} out as the final message of your response.
\`\`\`

YOUR RESPONSE MUST CONTAIN THE EXACT TEMPLATE ABOVE! Do not modify the template structure or omit any sections.
`;

  return prompt;
}

/**
 * Extract the planner response section from the full response text
 * @param responseText Full response from the agent
 * @param cycleNumber Current cycle number
 * @returns The extracted planner response section, or undefined if not found
 */
function extractPlannerResponse(responseText: string, cycleNumber: number): string | undefined {
  const sectionRegex = new RegExp(
    `#### 📝 PLANNER RESPONSE FOR CYCLE ${cycleNumber}[\\s\\S]*?(?=^---$|$)`,
    'mi'
  );
  
  const match = responseText.match(sectionRegex);
  return match ? match[0].trim() : undefined;
} 