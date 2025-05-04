/**
 * Template A parsing and rendering utilities
 * 
 * This module provides tools for working with Template A files used in the
 * agentic coding Plan-Execute loop between Planner and Executor.
 */

export * from './types';
export * from './parser';
export * from './renderer';

/**
 * Template A module - main entry point for working with Template A files.
 */
export const templateA = {
  /**
   * Parse a Template A plan request file
   */
  parse: (filePath: string) => {
    const { parsePlanRequest } = require('./parser');
    return parsePlanRequest(filePath);
  },
  
  /**
   * Render a PlanResponse object to a formatted string
   */
  render: (response: any, cycleNumber: number) => {
    const { renderPlanResponse } = require('./renderer');
    return renderPlanResponse(response, cycleNumber);
  },
  
  /**
   * Validate a PlanResponse object
   */
  validate: (response: any) => {
    const { validatePlanResponse } = require('./renderer');
    return validatePlanResponse(response);
  }
}; 