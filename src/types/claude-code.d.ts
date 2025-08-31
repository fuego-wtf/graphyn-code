/**
 * TypeScript definitions for Claude Code Task tool integration
 * These types define the interface between Clyde and Claude Code
 */

declare global {
  /**
   * The Claude Code Task tool function
   * Available when running within Claude Code environment
   */
  function Task(params: TaskParams): Promise<TaskResult>;

  interface TaskParams {
    /** Brief description of what this task accomplishes */
    description: string;
    
    /** Detailed prompt with context and requirements */
    prompt: string;
    
    /** The type of specialized agent to use for this task */
    subagent_type: AgentType;
  }

  interface TaskResult {
    /** The main result/output from the task execution */
    result?: string;
    
    /** Alternative output field */
    output?: string;
    
    /** Whether the task completed successfully */
    success?: boolean;
    
    /** Any error message if the task failed */
    error?: string;
    
    /** Additional metadata from task execution */
    metadata?: {
      agent_type?: string;
      execution_time?: number;
      [key: string]: any;
    };
  }

  type AgentType = 
    // General purpose agents
    | 'general-purpose'
    | 'coder'
    | 'reviewer'
    | 'tester'
    
    // Specialized development agents
    | 'system-architect'
    | 'backend-dev' 
    | 'frontend-dev'
    | 'mobile-dev'
    | 'devops-engineer'
    | 'cicd-engineer'
    
    // Analysis and optimization agents
    | 'code-analyzer'
    | 'perf-analyzer' 
    | 'security-analyst'
    | 'data-analyst'
    
    // Documentation and communication agents
    | 'api-docs'
    | 'technical-writer'
    | 'researcher'
    
    // Testing specialists
    | 'test-engineer'
    | 'qa-engineer'
    | 'tdd-london-swarm'
    
    // Domain-specific agents
    | 'ml-developer'
    | 'blockchain-dev'
    | 'gamedev'
    | 'ui-ux-designer'
    
    // Management and planning agents
    | 'planner'
    | 'project-manager'
    | 'release-manager';
}

export {}; // Make this a module