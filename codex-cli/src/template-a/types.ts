/**
 * Types for Template A parsing and rendering
 */

/**
 * Represents the CYCLE CONTEXT section of a Template A plan request
 */
export interface PlanRequestContext {
  cycleNumber: number;
  project: string;
  previousGoal: string;
  previousOutcome: string;
  currentBlockers: string;
  nextGoal: string;
  historyPath: string;
  timeBox: string;
  relevantArtifacts: string;
  scratchpadDelta: string;
  availableMcpTools: string;
}

/**
 * Represents the EXECUTOR QUESTIONS section of a Template A plan request
 */
export interface ExecutorQuestions {
  analysisAndJustification: string;
  plan: string;
  blockerSolutions: string;
  bestPracticesMentalModels: string;
  mcpTools: string;
}

/**
 * Represents a complete Template A plan request
 */
export interface PlanRequest {
  context: PlanRequestContext;
  questions: ExecutorQuestions;
}

/**
 * Represents the PLANNER RESPONSE section to be generated
 */
export interface PlanResponse {
  analysisAndJustification: string;
  plan: string;
  blockerSolutions: string;
  bestPracticesMentalModels: string;
  recommendedMcpTools: string;
  executorFollowUpChecklist: string;
} 