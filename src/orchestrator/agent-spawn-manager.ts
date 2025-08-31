/**
 * Agent Spawn Manager
 * Manages the creation, configuration, and lifecycle of Claude Code agent sessions
 */
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { ClaudeCodeWrapper, ClaudeQuery } from './claude-wrapper.js';
import { debug } from '../utils/debug.js';

export interface AgentSession {
  id: string;
  agent: string; // 'backend', 'frontend', etc.
  status: 'initializing' | 'ready' | 'busy' | 'completed' | 'failed' | 'terminated';
  workspaceId: string;
  context: string;
  currentTask?: string;
  output: string;
}

export interface WorkspaceContext {
  repository: string;
  framework?: string;
  language?: string;
  dependencies?: string[];
  sharedContext: string;
  agentContexts: Map<string, string>;
}

export class AgentSpawnManager extends EventEmitter {
  private activeAgents = new Map<string, AgentSession>();
  private workspaces = new Map<string, WorkspaceContext>();
  private claudeWrapper: ClaudeCodeWrapper;

  constructor() {
    super();
    this.claudeWrapper = new ClaudeCodeWrapper();
    this.setupClaudeWrapperEvents();
  }

  private setupClaudeWrapperEvents(): void {
    this.claudeWrapper.on('output', (data) => {
      this.emit('agent_output', data);
    });

    this.claudeWrapper.on('query_completed', (data) => {
      // Find the agent session and update it
      for (const [sessionId, session] of this.activeAgents.entries()) {
        if (session.status === 'busy') {
          session.status = 'completed';
          session.output = data.output;
          this.emit('agent_task_completed', {
            sessionId,
            output: data.output,
            task: session.currentTask
          });
          break;
        }
      }
    });

    this.claudeWrapper.on('query_failed', (data) => {
      // Find the agent session and update it
      for (const [sessionId, session] of this.activeAgents.entries()) {
        if (session.status === 'busy') {
          session.status = 'failed';
          this.emit('agent_task_failed', {
            sessionId,
            error: data.error,
            task: session.currentTask
          });
          break;
        }
      }
    });
  }

  /**
   * Prepare workspace for multi-agent collaboration
   */
  async prepareWorkspace(repository: string): Promise<string> {
    const workspaceId = this.generateWorkspaceId();
    debug('Preparing workspace:', workspaceId, repository);

    // Analyze repository context
    const sharedContext = await this.analyzeRepository(repository);
    
    // Create agent-specific contexts
    const agentContexts = new Map<string, string>();
    
    const workspace: WorkspaceContext = {
      repository,
      sharedContext,
      agentContexts
    };

    this.workspaces.set(workspaceId, workspace);
    return workspaceId;
  }

  /**
   * Spawn a Claude Code session for specific agent
   */
  async spawnAgent(agent: string, workspaceId: string): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const sessionId = this.generateSessionId(agent);
    debug('Spawning agent session:', sessionId, agent);

    try {
      // Generate agent-specific context
      const agentContext = await this.generateAgentContext(agent, workspace);

      // Create agent session
      const session: AgentSession = {
        id: sessionId,
        agent,
        status: 'ready',
        workspaceId,
        context: agentContext,
        output: ''
      };

      this.activeAgents.set(sessionId, session);

      this.emit('agent_spawned', { sessionId, agent });
      return sessionId;

    } catch (error) {
      this.emit('agent_spawn_error', { agent, error });
      throw error;
    }
  }

  /**
   * Send task to specific agent session
   */
  async sendTask(sessionId: string, task: string): Promise<string> {
    const session = this.activeAgents.get(sessionId);
    if (!session) {
      throw new Error(`Agent session ${sessionId} not found`);
    }

    if (session.status !== 'ready' && session.status !== 'completed') {
      throw new Error(`Agent session ${sessionId} is not ready (status: ${session.status})`);
    }

    debug('Sending task to agent:', sessionId, task);
    session.status = 'busy';
    session.currentTask = task;

    try {
      // Execute task using Claude Code wrapper
      const result = await this.claudeWrapper.executeAgentQuery(
        session.agent,
        task,
        session.context
      );

      session.status = 'completed';
      session.output = result;
      
      this.emit('agent_task_completed', {
        sessionId,
        output: result,
        task
      });

      return result;

    } catch (error) {
      session.status = 'failed';
      this.emit('agent_task_failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        task
      });
      throw error;
    }
  }

  /**
   * Get status of all active agents
   */
  getActiveAgents(): AgentSession[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Get specific agent session
   */
  getAgent(sessionId: string): AgentSession | null {
    return this.activeAgents.get(sessionId) || null;
  }

  /**
   * Terminate specific agent session
   */
  async terminateAgent(sessionId: string): Promise<void> {
    const session = this.activeAgents.get(sessionId);
    if (!session) return;

    debug('Terminating agent session:', sessionId);
    session.status = 'terminated';

    this.activeAgents.delete(sessionId);
    this.emit('agent_terminated', { sessionId });
  }

  /**
   * Clean up workspace and all associated agents
   */
  async cleanup(workspaceId: string): Promise<void> {
    debug('Cleaning up workspace:', workspaceId);

    // Terminate all agents in this workspace
    const workspaceAgents = Array.from(this.activeAgents.values())
      .filter(session => session.workspaceId === workspaceId);

    await Promise.all(
      workspaceAgents.map(session => this.terminateAgent(session.id))
    );

    // Kill any active Claude Code sessions
    this.claudeWrapper.killAllSessions();

    // Remove workspace
    this.workspaces.delete(workspaceId);
  }

  // Removed initializeClaude - now handled by ClaudeCodeWrapper

  private async analyzeRepository(repository: string): Promise<string> {
    // Use existing repository analyzer
    const { RepositoryAnalyzerService } = await import('../services/repository-analyzer.js');
    const analyzer = new RepositoryAnalyzerService();
    
    try {
      const analysis = await analyzer.analyze(repository, 'summary');
      return this.formatRepositoryContext(analysis);
    } catch (error) {
      debug('Error analyzing repository:', error);
      return `Repository at ${repository}`;
    }
  }

  private formatRepositoryContext(analysis: any): string {
    return `# Repository Context

**Project**: ${analysis.name}
**Type**: ${analysis.type}
**Language**: ${analysis.language}${analysis.framework ? ` (${analysis.framework})` : ''}

**Structure**:
- ${analysis.structure.directories.length} directories
- ${Object.keys(analysis.structure.files).length} file types

**Key Files**: ${Object.entries(analysis.structure.files)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 5)
  .map(([ext, count]) => `${ext} (${count})`)
  .join(', ')}

${analysis.packages && analysis.packages.length > 0 ? 
  `**Packages**: ${analysis.packages.slice(0, 10).join(', ')}${analysis.packages.length > 10 ? ` and ${analysis.packages.length - 10} more` : ''}` : 
  ''
}`;
  }

  private async generateAgentContext(agent: string, workspace: WorkspaceContext): Promise<string> {
    const agentPrompts = {
      backend: 'You are a backend development expert. Focus on server-side logic, databases, APIs, and backend architecture.',
      frontend: 'You are a frontend development expert. Focus on user interfaces, React components, styling, and user experience.',
      architect: 'You are a system architecture expert. Focus on overall system design, technology decisions, and architectural patterns.',
      design: 'You are a design system expert. Focus on UI/UX design, component libraries, and design patterns.',
      cli: 'You are a CLI development expert. Focus on command-line tools, developer experience, and automation.'
    };

    const basePrompt = agentPrompts[agent as keyof typeof agentPrompts] || 'You are a software development expert.';

    return `${basePrompt}

${workspace.sharedContext}

**Your Role**: As the ${agent} agent in this multi-agent system, you should:
1. Focus on tasks specifically related to ${agent} development
2. Communicate with other agents when dependencies exist
3. Provide detailed progress updates
4. Ask for clarification when needed

**Working Directory**: ${workspace.repository}

**Instructions**: You will receive specific tasks. For each task:
- Analyze the requirements carefully
- Break down complex tasks into smaller steps
- Execute the work methodically
- Report progress and results clearly
- Coordinate with other agents as needed

Ready to receive tasks.`;
  }

  // Old methods removed - now handled by ClaudeCodeWrapper

  private generateWorkspaceId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(agent: string): string {
    return `agent_${agent}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}