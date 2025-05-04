import * as fs from 'node:fs';
import { PlanRequest, PlanRequestContext, ExecutorQuestions } from './types';

/**
 * Parse a Template A plan request file
 * @param filePath Path to the plan request file
 * @returns Parsed PlanRequest object
 */
export function parsePlanRequest(filePath: string): PlanRequest {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parsePlanRequestContent(content);
}

/**
 * Parse Template A plan request content
 * @param content Template A plan request content
 * @returns Parsed PlanRequest object
 */
export function parsePlanRequestContent(content: string): PlanRequest {
  // Extract the CYCLE CONTEXT section
  const contextMatch = content.match(
    /#### 📈 CYCLE \d+ CONTEXT.*?(?=---)/s
  );
  if (!contextMatch) {
    throw new Error('Failed to extract CYCLE CONTEXT section');
  }
  
  const context = parseContextSection(contextMatch[0]);
  
  // Extract the EXECUTOR QUESTIONS section
  const questionsMatch = content.match(
    /#### 📞 EXECUTOR ➡️ PLANNER QUESTIONS \/ REQUESTS.*?(?=---)/s
  );
  if (!questionsMatch) {
    throw new Error('Failed to extract EXECUTOR QUESTIONS section');
  }
  
  const questions = parseQuestionsSection(questionsMatch[0]);
  
  return {
    context,
    questions
  };
}

/**
 * Parse the context section of a Template A plan request
 * @param section Context section content
 * @returns Parsed PlanRequestContext object
 */
function parseContextSection(section: string): PlanRequestContext {
  // Extract values using regex patterns
  const cycleNumberMatch = section.match(/\[🔢 CYCLE_NUMBER\]\s*(.*?)(?=\[|$)/s);
  const projectMatch = section.match(/\[📂 PROJECT\]\s*(.*?)(?=\[|$)/s);
  const previousGoalMatch = section.match(/\[🗺️ PREVIOUS GOAL.*?\]\s*(.*?)(?=\[|$)/s);
  const previousOutcomeMatch = section.match(/\[✅ PREVIOUS OUTCOME.*?\]\s*(.*?)(?=\[|$)/s);
  const currentBlockersMatch = section.match(/\[🚧 CURRENT BLOCKERS\]\s*(.*?)(?=\[|$)/s);
  const nextGoalMatch = section.match(/\[🎯 NEXT GOAL.*?\]\s*(.*?)(?=\[|$)/s);
  const historyPathMatch = section.match(/\[📜 HISTORY PATH\]\s*(.*?)(?=\[|$)/s);
  const timeBoxMatch = section.match(/\[⏳ TIME BOX\]\s*(.*?)(?=\[|$)/s);
  const relevantArtifactsMatch = section.match(/\[📎 RELEVANT ARTIFACTS\]\s*(.*?)(?=\[|$)/s);
  const scratchpadDeltaMatch = section.match(/\[🗒️ SCRATCHPAD DELTA\]\s*(.*?)(?=\[|$)/s);
  const availableMcpToolsMatch = section.match(/\[🔍 AVAILABLE MCP TOOLS\]\s*(.*?)(?=\[|$)/s);
  
  // Get values or use default empty string
  const cycleNumber = cycleNumberMatch ? parseInt(cycleNumberMatch[1].trim()) : 0;
  const project = projectMatch ? projectMatch[1].trim() : '';
  const previousGoal = previousGoalMatch ? previousGoalMatch[1].trim() : '';
  const previousOutcome = previousOutcomeMatch ? previousOutcomeMatch[1].trim() : '';
  const currentBlockers = currentBlockersMatch ? currentBlockersMatch[1].trim() : '';
  const nextGoal = nextGoalMatch ? nextGoalMatch[1].trim() : '';
  const historyPath = historyPathMatch ? historyPathMatch[1].trim() : '';
  const timeBox = timeBoxMatch ? timeBoxMatch[1].trim() : '';
  const relevantArtifacts = relevantArtifactsMatch ? relevantArtifactsMatch[1].trim() : '';
  const scratchpadDelta = scratchpadDeltaMatch ? scratchpadDeltaMatch[1].trim() : '';
  const availableMcpTools = availableMcpToolsMatch ? availableMcpToolsMatch[1].trim() : '';
  
  return {
    cycleNumber,
    project,
    previousGoal,
    previousOutcome,
    currentBlockers,
    nextGoal,
    historyPath,
    timeBox,
    relevantArtifacts,
    scratchpadDelta,
    availableMcpTools
  };
}

/**
 * Parse the questions section of a Template A plan request
 * @param section Questions section content
 * @returns Parsed ExecutorQuestions object
 */
function parseQuestionsSection(section: string): ExecutorQuestions {
  // Extract values using regex patterns
  const analysisMatch = section.match(/\[❓ ANALYSIS & JUSTIFICATION\]\s*(.*?)(?=\[|$)/s);
  const planMatch = section.match(/\[❓ PLAN\]\s*(.*?)(?=\[|$)/s);
  const blockerSolutionsMatch = section.match(/\[❓ BLOCKER SOLUTIONS\]\s*(.*?)(?=\[|$)/s);
  const bestPracticesMatch = section.match(/\[❓ BEST PRACTICES \/MENTAL MODELS\]\s*(.*?)(?=\[|$)/s);
  const mcpToolsMatch = section.match(/\[❓ MCP TOOLS\]\s*(.*?)(?=\[|$)/s);
  
  // Get values or use default empty string
  const analysisAndJustification = analysisMatch ? analysisMatch[1].trim() : '';
  const plan = planMatch ? planMatch[1].trim() : '';
  const blockerSolutions = blockerSolutionsMatch ? blockerSolutionsMatch[1].trim() : '';
  const bestPracticesMentalModels = bestPracticesMatch ? bestPracticesMatch[1].trim() : '';
  const mcpTools = mcpToolsMatch ? mcpToolsMatch[1].trim() : '';
  
  return {
    analysisAndJustification,
    plan,
    blockerSolutions,
    bestPracticesMentalModels,
    mcpTools
  };
} 