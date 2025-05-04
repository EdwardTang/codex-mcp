import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parsePlanRequestContent } from '../src/template-a/parser';
import { renderPlanResponse, validatePlanResponse } from '../src/template-a/renderer';
import { templateA } from '../src/template-a';
import { PlanResponse } from '../src/template-a/types';

describe('Template A Parser', () => {
  it('parses a Template A plan request content correctly', () => {
    const fixturePath = path.join(__dirname, '__fixtures__/template-a/sample-plan-request.md');
    const content = fs.readFileSync(fixturePath, 'utf-8');
    
    const result = parsePlanRequestContent(content);
    
    // Check parsed context
    expect(result.context.cycleNumber).toBe(1);
    expect(result.context.project).toBe('test-project');
    expect(result.context.previousGoal).toBe('Initial goal');
    expect(result.context.previousOutcome).toBe('Completed initial setup');
    expect(result.context.currentBlockers).toBe('Test blocker 1, Test blocker 2');
    expect(result.context.nextGoal).toBe('Implement feature X');
    expect(result.context.historyPath).toBe('.specstory/history/test.md');
    expect(result.context.timeBox).toBe('1 hour');
    expect(result.context.relevantArtifacts).toBe('file1.ts, file2.ts');
    expect(result.context.scratchpadDelta).toBe('Updated progress section');
    expect(result.context.availableMcpTools).toBe('.cursor/available_mcp_tools.md');
    
    // Check parsed questions
    expect(result.questions.analysisAndJustification).toBe('Please analyze approach X');
    expect(result.questions.plan).toBe('Need detailed steps for feature X');
    expect(result.questions.blockerSolutions).toBe('How to solve blocker 1?');
    expect(result.questions.bestPracticesMentalModels).toBe('Best practices for feature X');
    expect(result.questions.mcpTools).toBe('Recommend tools for implementation');
  });
  
  it('uses templateA.parse to parse a Template A plan request file', () => {
    const fixturePath = path.join(__dirname, '__fixtures__/template-a/sample-plan-request.md');
    
    const result = templateA.parse(fixturePath);
    
    expect(result.context.cycleNumber).toBe(1);
    expect(result.context.project).toBe('test-project');
    // Only checking a few fields since the full parsing is covered in the previous test
  });
});

describe('Template A Renderer', () => {
  it('renders a PlanResponse object correctly', () => {
    const response: PlanResponse = {
      analysisAndJustification: 'Test analysis',
      plan: 'Test plan',
      blockerSolutions: 'Test blocker solutions',
      bestPracticesMentalModels: 'Test best practices',
      recommendedMcpTools: 'Test recommended tools',
      executorFollowUpChecklist: 'Test checklist',
    };
    
    const result = renderPlanResponse(response, 2);
    
    // Test that the rendered output contains all required sections
    expect(result).toContain('#### 📝 PLANNER RESPONSE FOR CYCLE 2');
    expect(result).toContain('**ANALYSIS & JUSTIFICATION:** Test analysis');
    expect(result).toContain('**PLAN (STRICTLY ≤ 8 ATOMIC ACTIONS; ACTION 1 MUST BE `Review scratchpad.md`):** Test plan');
    expect(result).toContain('**BLOCKER SOLUTIONS:** Test blocker solutions');
    expect(result).toContain('**BEST PRACTICES / MENTAL MODELS:** Test best practices');
    expect(result).toContain('**RECOMMENDED MCP TOOL CALLS (via pluggedin_proxy):** Test recommended tools');
    expect(result).toContain('**EXECUTOR FOLLOW-UP CHECKLIST (to be executed at Cycle 2 conclusion):**');
  });
  
  it('uses templateA.render to render a PlanResponse', () => {
    const response: PlanResponse = {
      analysisAndJustification: 'Test analysis',
      plan: 'Test plan',
      blockerSolutions: 'Test blocker solutions',
      bestPracticesMentalModels: 'Test best practices',
      recommendedMcpTools: 'Test recommended tools',
      executorFollowUpChecklist: 'Test checklist',
    };
    
    const result = templateA.render(response, 2);
    
    expect(result).toContain('#### 📝 PLANNER RESPONSE FOR CYCLE 2');
    expect(result).toContain('**ANALYSIS & JUSTIFICATION:** Test analysis');
  });
  
  it('validates a PlanResponse correctly', () => {
    const validResponse: PlanResponse = {
      analysisAndJustification: 'Test analysis',
      plan: 'Test plan',
      blockerSolutions: 'Test blocker solutions',
      bestPracticesMentalModels: 'Test best practices',
      recommendedMcpTools: 'Test recommended tools',
      executorFollowUpChecklist: 'Test checklist',
    };
    
    const invalidResponse = {
      analysisAndJustification: 'Test analysis',
      plan: 'Test plan',
      // Missing sections
      bestPracticesMentalModels: 'Test best practices',
    } as PlanResponse;
    
    expect(validatePlanResponse(validResponse)).toBe(true);
    expect(validatePlanResponse(invalidResponse)).toBe(false);
    
    // Test using templateA.validate
    expect(templateA.validate(validResponse)).toBe(true);
    expect(templateA.validate(invalidResponse)).toBe(false);
  });
}); 