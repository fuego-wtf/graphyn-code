/**
 * Claude Code Wrapper
 * Direct integration with Claude Code CLI using `claude -p "prompt"`
 */
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { findClaude } from '../utils/claude-detector.js';
import { debug } from '../utils/debug.js';

export interface ClaudeSession {
  id: string;
  process: ChildProcess;
  status: 'starting' | 'ready' | 'busy' | 'completed' | 'failed';
  output: string;
  error: string;
}

export interface ClaudeQuery {
  prompt: string;
  context?: string;
  timeout?: number;
}

export class ClaudeCodeWrapper extends EventEmitter {
  private claudePath: string | null = null;
  private activeSessions = new Map<string, ClaudeSession>();

  constructor() {
    super();
    this.initializeClaude();
  }

  private async initializeClaude(): Promise<void> {
    try {
      const claudeResult = await findClaude();
      if (claudeResult.found && claudeResult.path) {
        this.claudePath = claudeResult.path;
        debug('Claude Code found at:', this.claudePath);
      } else {
        throw new Error('Claude Code not found. Please install Claude Code.');
      }
    } catch (error) {
      debug('Error finding Claude Code:', error);
      throw error;
    }
  }

  /**
   * Execute a single query with Claude Code
   */
  async executeQuery(query: ClaudeQuery): Promise<string> {
    if (!this.claudePath) {
      await this.initializeClaude();
    }

    return new Promise((resolve, reject) => {
      const sessionId = this.generateSessionId();
      debug('Executing Claude query:', sessionId, query.prompt.substring(0, 100));

      // Build the full prompt with context
      let fullPrompt = query.prompt;
      if (query.context) {
        fullPrompt = `${query.context}\n\n${query.prompt}`;
      }

      // Spawn Claude Code process
      const claudeProcess = spawn(this.claudePath!, ['-p', fullPrompt], {
        stdio: 'pipe'
      });

      const session: ClaudeSession = {
        id: sessionId,
        process: claudeProcess,
        status: 'starting',
        output: '',
        error: ''
      };

      this.activeSessions.set(sessionId, session);
      session.status = 'ready';

      // Collect output
      claudeProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        session.output += chunk;
        this.emit('output', { sessionId, chunk, type: 'stdout' });
      });

      claudeProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        session.error += chunk;
        this.emit('output', { sessionId, chunk, type: 'stderr' });
      });

      // Handle completion
      claudeProcess.on('close', (code) => {
        session.status = code === 0 ? 'completed' : 'failed';
        
        if (code === 0) {
          this.emit('query_completed', { sessionId, output: session.output });
          resolve(session.output);
        } else {
          const error = new Error(`Claude Code exited with code ${code}: ${session.error}`);
          this.emit('query_failed', { sessionId, error: error.message });
          reject(error);
        }

        this.activeSessions.delete(sessionId);
      });

      claudeProcess.on('error', (err) => {
        session.status = 'failed';
        this.emit('query_failed', { sessionId, error: err.message });
        reject(err);
        this.activeSessions.delete(sessionId);
      });

      // Set timeout if specified
      if (query.timeout) {
        setTimeout(() => {
          if (session.status === 'ready' || session.status === 'busy') {
            claudeProcess.kill('SIGTERM');
            reject(new Error(`Claude query timed out after ${query.timeout}ms`));
          }
        }, query.timeout);
      }
    });
  }

  /**
   * Execute multiple queries in parallel
   */
  async executeParallelQueries(queries: ClaudeQuery[]): Promise<string[]> {
    debug('Executing', queries.length, 'parallel Claude queries');
    
    const promises = queries.map(query => this.executeQuery(query));
    return Promise.all(promises);
  }

  /**
   * Execute queries with specific agent contexts
   */
  async executeAgentQuery(agentType: string, query: string, projectContext?: string): Promise<string> {
    const agentPrompt = this.getAgentPrompt(agentType);
    
    let fullContext = agentPrompt;
    if (projectContext) {
      fullContext += `\n\n# Project Context\n${projectContext}`;
    }
    
    return this.executeQuery({
      prompt: query,
      context: fullContext,
      timeout: 120000 // 2 minutes timeout for agent queries
    });
  }

  private getAgentPrompt(agentType: string): string {
    const agentPrompts: Record<string, string> = {
      'system-architect': `You are a system architect expert. Your role is to design high-level system architecture, make technology decisions, and create technical specifications. Focus on:
- Overall system design and structure
- Technology stack recommendations  
- Scalability and performance considerations
- Security architecture
- Integration patterns
- Database design`,

      'backend-dev': `You are a backend development expert. Your role is to implement server-side logic, APIs, and data systems. Focus on:
- REST API design and implementation
- Database schemas and queries
- Authentication and authorization
- Server configuration
- Performance optimization
- Error handling and logging`,

      'frontend-dev': `You are a frontend development expert. Your role is to create user interfaces and client-side functionality. Focus on:
- React/Vue/Angular component development
- Responsive UI design
- State management
- API integration
- User experience optimization
- Accessibility`,

      'tester': `You are a testing expert. Your role is to ensure code quality through comprehensive testing. Focus on:
- Unit test creation
- Integration test design
- Test automation
- Quality assurance
- Bug detection and reporting
- Performance testing`,

      'reviewer': `You are a code review expert. Your role is to ensure code quality and best practices. Focus on:
- Code quality assessment
- Best practices enforcement
- Security vulnerability detection
- Performance optimization suggestions
- Documentation review
- Architecture compliance`,

      'deployer': `You are a deployment and DevOps expert. Your role is to handle CI/CD and infrastructure. Focus on:
- CI/CD pipeline setup
- Container configuration
- Cloud deployment
- Infrastructure as code
- Monitoring setup
- Security configuration`
    };

    return agentPrompts[agentType] || `You are a software development expert specializing in ${agentType}.`;
  }

  /**
   * Get status of all active sessions
   */
  getActiveSessions(): ClaudeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Kill all active sessions
   */
  killAllSessions(): void {
    for (const session of this.activeSessions.values()) {
      session.process.kill('SIGTERM');
    }
    this.activeSessions.clear();
  }

  private generateSessionId(): string {
    return `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}