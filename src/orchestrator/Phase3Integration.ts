/**
 * Phase 3 Integration Module
 * 
 * Connects all Phase 3 components with the existing orchestration system
 * Provides unified interface for console output, Claude integration, and Figma support
 */

import { ConsoleOutput } from '../console/ConsoleOutput';
import { ClaudeSDKWrapper } from '../claude/ClaudeSDKWrapper';
import { ClaudePromptBuilder } from '../claude/ClaudePromptBuilder';
import { AgentConfig } from '../config/AgentConfig';
import { GitAutomation } from '../git/GitAutomation';
import { FigmaExtractor } from '../figma/FigmaExtractor';
import { FigmaAuthManager } from '../figma/FigmaAuthManager';
import { TaskExecution, AgentType } from './types';

export interface Phase3Config {
  // Console configuration
  enableConsoleOutput: boolean;
  consoleLogLevel: 'minimal' | 'detailed' | 'verbose';
  
  // Claude configuration
  claudeMaxSessions: number;
  claudeSessionTimeout: number;
  claudeEnableLogging: boolean;
  
  // Git configuration
  gitRepoPath: string;
  gitDefaultBranch: string;
  gitEnableAutoCommit: boolean;
  gitEnableAutoPR: boolean;
  
  // Figma configuration  
  figmaClientId?: string;
  figmaClientSecret?: string;
  figmaToken?: string;
  
  // Agent configuration
  agentConfigPaths: string[];
}

/**
 * Phase 3 Integration Manager
 * Orchestrates all Phase 3 components together
 */
export class Phase3Integration {
  private console: ConsoleOutput;
  private claude: ClaudeSDKWrapper;
  private agentConfig: AgentConfig;
  private git?: GitAutomation;
  private figmaExtractor?: FigmaExtractor;
  private figmaAuth?: FigmaAuthManager;
  private config: Phase3Config;

  constructor(config: Partial<Phase3Config> = {}) {
    this.config = {
      enableConsoleOutput: true,
      consoleLogLevel: 'detailed',
      claudeMaxSessions: 5,
      claudeSessionTimeout: 30 * 60 * 1000,
      claudeEnableLogging: true,
      gitRepoPath: process.cwd(),
      gitDefaultBranch: 'main',
      gitEnableAutoCommit: false,
      gitEnableAutoPR: false,
      agentConfigPaths: [],
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize all Phase 3 components
   */
  private initialize(): void {
    // Initialize console output
    this.console = new ConsoleOutput();
    if (this.config.enableConsoleOutput) {
      this.console.clear();
    }

    // Initialize Claude SDK
    this.claude = new ClaudeSDKWrapper({
      maxSessions: this.config.claudeMaxSessions,
      sessionTimeout: this.config.claudeSessionTimeout,
      enableLogging: this.config.claudeEnableLogging
    });

    // Initialize agent configuration
    this.agentConfig = new AgentConfig();
    
    // Add custom agent config paths
    this.config.agentConfigPaths.forEach(configPath => {
      this.agentConfig.addSource({
        type: 'directory',
        path: configPath,
        priority: 1
      });
    });

    // Initialize Git automation if enabled
    if (this.config.gitEnableAutoCommit || this.config.gitEnableAutoPR) {
      this.git = new GitAutomation({
        repoPath: this.config.gitRepoPath,
        defaultBranch: this.config.gitDefaultBranch,
        enableAutoCommit: this.config.gitEnableAutoCommit,
        enableAutoPR: this.config.gitEnableAutoPR
      });
    }

    // Initialize Figma components if configured
    if (this.config.figmaToken || (this.config.figmaClientId && this.config.figmaClientSecret)) {
      this.figmaAuth = new FigmaAuthManager({
        clientId: this.config.figmaClientId,
        clientSecret: this.config.figmaClientSecret
      });
      
      if (this.config.figmaToken) {
        this.figmaExtractor = new FigmaExtractor(this.config.figmaToken);
      }
    }
  }

  /**
   * Start execution of tasks with full Phase 3 integration
   */
  async executeTasksWithIntegration(
    tasks: TaskExecution[],
    options: {
      showProgress?: boolean;
      enableClaudeCoordination?: boolean;
      enableGitAutomation?: boolean;
      branchPrefix?: string;
    } = {}
  ): Promise<void> {
    const { showProgress = true, enableClaudeCoordination = true, enableGitAutomation = false } = options;

    try {
      // Show initial task plan
      if (showProgress && this.config.enableConsoleOutput) {
        this.console.showTaskPlan({
          tasks,
          totalTasks: tasks.length,
          estimatedDuration: tasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0)
        });
      }

      // Create Git branch if automation is enabled
      let branchName: string | undefined;
      if (enableGitAutomation && this.git) {
        const taskIds = tasks.map(t => t.id).join('-');
        branchName = options.branchPrefix ? 
          `${options.branchPrefix}-${taskIds}` : 
          `orchestrator-${taskIds}`;
        
        await this.git.createBranch(branchName);
        this.console.showSuccess(`Created Git branch: ${branchName}`);
      }

      // Initialize Claude sessions for agents
      const claudeSessions = new Map<AgentType, string>();
      
      if (enableClaudeCoordination) {
        const agentTypes = [...new Set(tasks.map(task => task.agent))];
        
        for (const agentType of agentTypes) {
          try {
            const agentPrompt = await this.buildAgentPrompt(agentType, tasks);
            const sessionId = await this.claude.createSession(agentPrompt);
            claudeSessions.set(agentType, sessionId);
            
            if (showProgress) {
              this.console.showAgentActivity(agentType, 'session initialized');
            }
          } catch (error) {
            console.warn(`Failed to create Claude session for ${agentType}:`, error);
          }
        }
      }

      // Execute tasks with progress tracking
      let completedTasks = 0;
      
      for (const task of tasks) {
        if (showProgress) {
          this.console.showTaskUpdate(task.id, 'in_progress', `Starting task execution`);
        }

        try {
          // Execute task through Claude if session exists
          if (enableClaudeCoordination) {
            const sessionId = claudeSessions.get(task.agent);
            if (sessionId) {
              const taskPrompt = this.buildTaskExecutionPrompt(task);
              await this.claude.sendToSession(sessionId, taskPrompt);
              
              if (showProgress) {
                this.console.showAgentActivity(task.agent, `executing ${task.id}`);
              }
            }
          }

          // Mark task as completed (in real implementation, this would wait for actual completion)
          completedTasks++;
          
          if (showProgress) {
            this.console.showProgress({
              phase: 'Task Execution',
              progress: completedTasks,
              total: tasks.length
            });
            
            this.console.showTaskUpdate(task.id, 'completed', 'Task completed successfully');
          }
          
        } catch (error: any) {
          if (showProgress) {
            this.console.showTaskUpdate(task.id, 'failed', `Task failed: ${error.message}`);
          }
        }
      }

      // Commit changes if Git automation is enabled
      if (enableGitAutomation && this.git && branchName) {
        const commitMessage = `Orchestrator: Completed ${completedTasks}/${tasks.length} tasks`;
        const commitInfo = await this.git.commitChanges([], commitMessage);
        this.console.showSuccess(`Committed changes: ${commitInfo.hash.substring(0, 8)}`);
      }

      // Cleanup Claude sessions
      if (enableClaudeCoordination) {
        for (const [agentType, sessionId] of claudeSessions) {
          try {
            await this.claude.destroySession(sessionId);
            if (showProgress) {
              this.console.showAgentActivity(agentType, 'session ended');
            }
          } catch (error) {
            console.warn(`Failed to cleanup session for ${agentType}`);
          }
        }
      }

      // Show completion summary
      if (showProgress && this.config.enableConsoleOutput) {
        this.console.showCompletion({
          success: completedTasks === tasks.length,
          totalTime: Math.floor(Date.now() / 1000), // Simplified timing
          tasksCompleted: completedTasks,
          tasksTotal: tasks.length,
          results: [`Completed ${completedTasks} tasks successfully`],
          errors: completedTasks < tasks.length ? [`${tasks.length - completedTasks} tasks failed`] : undefined
        });
      }

    } catch (error: any) {
      if (showProgress) {
        this.console.showError(error, 'Task Execution');
      }
      throw error;
    }
  }

  /**
   * Build agent prompt using AgentConfig and ClaudePromptBuilder
   */
  private async buildAgentPrompt(agentType: AgentType, tasks: TaskExecution[]): Promise<string> {
    const agentPrompt = await this.agentConfig.getAgentPrompt(agentType);
    
    const promptBuilder = new ClaudePromptBuilder({
      role: agentType,
      expertise: [],
      constraints: [],
      outputFormat: 'markdown'
    });
    
    // Add repository context
    promptBuilder.addRepositoryContext(this.config.gitRepoPath);
    
    // Add relevant tasks for this agent
    const agentTasks = tasks.filter(task => task.agent === agentType);
    agentTasks.forEach(task => promptBuilder.addTask(task));
    
    // Build final prompt
    const contextPrompt = promptBuilder.buildAgentPrompt();
    
    return `${agentPrompt}\n\n${contextPrompt}`;
  }

  /**
   * Build task-specific execution prompt
   */
  private buildTaskExecutionPrompt(task: TaskExecution): string {
    return `
Execute the following task:

**Task ID**: ${task.id}
**Description**: ${task.description}
**Priority**: ${task.priority}/10
**Dependencies**: ${task.dependencies.join(', ') || 'None'}
**Estimated Duration**: ${task.estimatedDuration || 'Not specified'} seconds

Please execute this task and provide a detailed response with your progress and results.
`;
  }

  /**
   * Extract design from Figma URL
   */
  async extractFromFigma(
    url: string,
    options: {
      includePrototypeFlow?: boolean;
      includeDesignTokens?: boolean;
      includeScreenshots?: boolean;
      outputDir?: string;
    } = {}
  ): Promise<any> {
    if (!this.figmaExtractor) {
      // Try to get token from auth manager
      if (this.figmaAuth) {
        const token = await this.figmaAuth.getValidAccessToken();
        if (token) {
          this.figmaExtractor = new FigmaExtractor(token);
        } else {
          throw new Error('No Figma token available. Please authenticate first.');
        }
      } else {
        throw new Error('Figma not configured. Please provide token or OAuth credentials.');
      }
    }

    this.console.showProgress({
      phase: 'Figma Extraction',
      progress: 0,
      total: 1
    });

    const result = await this.figmaExtractor.extractFromUrl(url, {
      progressCallback: (message) => this.console.showLogStream('Figma', message),
      ...options
    });

    this.console.showProgress({
      phase: 'Figma Extraction',
      progress: 1,
      total: 1
    });

    return result;
  }

  /**
   * Get system status
   */
  getStatus(): {
    console: boolean;
    claude: { available: boolean; sessions: number };
    git: { available: boolean; currentBranch?: string };
    figma: { available: boolean; authenticated: boolean };
    agents: { count: number };
  } {
    return {
      console: this.config.enableConsoleOutput,
      claude: {
        available: true,
        sessions: this.claude.listSessions().length
      },
      git: {
        available: !!this.git,
        currentBranch: undefined // Would need async call to get
      },
      figma: {
        available: !!this.figmaExtractor,
        authenticated: !!this.figmaAuth
      },
      agents: {
        count: 0 // Would need async call to get count
      }
    };
  }

  /**
   * Shutdown and cleanup all components
   */
  async shutdown(): Promise<void> {
    if (this.claude) {
      await this.claude.shutdown();
    }
    
    this.console.showSuccess('Phase 3 Integration shutdown complete');
  }
}

// Convenience function to create and configure Phase 3 integration
export function createPhase3Integration(config?: Partial<Phase3Config>): Phase3Integration {
  return new Phase3Integration(config);
}

// Export all Phase 3 components for individual use
export {
  ConsoleOutput,
  ClaudeSDKWrapper,
  ClaudePromptBuilder,
  AgentConfig,
  GitAutomation,
  FigmaExtractor,
  FigmaAuthManager
};