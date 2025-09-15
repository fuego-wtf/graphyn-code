/**
 * Backend Specialist Agent
 * 
 * Specialized Claude Code agent for backend development tasks including:
 * - API design and implementation
 * - Database schema and operations
 * - Server-side architecture
 * - Authentication and authorization
 * - Performance optimization
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AgentTask, AgentExecutionResult, TaskContext } from '../ClaudeCodeAgentLauncher.js';

export interface BackendSpecialization {
  frameworks: string[];
  databases: string[];
  apiPatterns: string[];
  authMethods: string[];
  scalingStrategies: string[];
}

export interface BackendAgentConfig {
  workingDirectory: string;
  specialization: BackendSpecialization;
  allowedTools: string[];
  sessionTimeout: number;
  maxConcurrentTasks: number;
}

export class BackendAgent extends EventEmitter {
  private config: BackendAgentConfig;
  private process?: ChildProcess;
  private sessionId?: string;
  private currentTasks = new Set<string>();
  private isInitialized = false;

  constructor(config: BackendAgentConfig) {
    super();
    this.config = {
      allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'MultiEdit'],
      sessionTimeout: 300000, // 5 minutes
      maxConcurrentTasks: 2,
      ...config
    };
  }

  /**
   * Initialize backend agent with specialized capabilities
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const systemPrompt = this.buildBackendSystemPrompt();
    
    // Spawn headless Claude CLI process
    const args = [
      '-p', systemPrompt,
      '--output-format', 'json',
      '--allowedTools', this.config.allowedTools.join(','),
      '--no-interactive',
      '--append-system-prompt', this.buildSpecializationPrompt()
    ];

    this.process = spawn('claude', args, {
      cwd: this.config.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_AGENT_TYPE: 'backend_specialist',
        CLAUDE_SPECIALIZATION: JSON.stringify(this.config.specialization)
      }
    });

    // Setup process monitoring
    this.setupProcessHandlers();
    
    // Initialize session
    this.sessionId = await this.initializeSession();
    this.isInitialized = true;
    
    this.emit('initialized', { sessionId: this.sessionId });
  }

  /**
   * Execute backend-specific task
   */
  async executeTask(task: AgentTask): Promise<AgentExecutionResult> {
    if (!this.isInitialized || !this.process || !this.sessionId) {
      throw new Error('Backend agent not initialized');
    }

    if (this.currentTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error('Backend agent at maximum capacity');
    }

    this.currentTasks.add(task.id);
    this.emit('task_started', { taskId: task.id, agent: 'backend' });

    const startTime = Date.now();

    try {
      const prompt = this.buildTaskPrompt(task);
      const result = await this.sendTaskToAgent(task.id, prompt);

      const executionResult: AgentExecutionResult = {
        agentId: 'backend_specialist',
        taskId: task.id,
        success: true,
        output: result.output,
        artifacts: result.artifacts || [],
        duration: Date.now() - startTime,
        nextRecommendations: result.recommendations
      };

      this.emit('task_completed', executionResult);
      return executionResult;

    } catch (error) {
      const errorResult: AgentExecutionResult = {
        agentId: 'backend_specialist', 
        taskId: task.id,
        success: false,
        output: `Backend task failed: ${error}`,
        artifacts: [],
        duration: Date.now() - startTime
      };

      this.emit('task_failed', { taskId: task.id, error });
      return errorResult;

    } finally {
      this.currentTasks.delete(task.id);
    }
  }

  /**
   * Build backend-specific system prompt
   */
  private buildBackendSystemPrompt(): string {
    return `
You are a Backend Development Specialist, an expert in server-side development with deep knowledge of:

CORE EXPERTISE:
- API Design: RESTful, GraphQL, gRPC, WebSocket APIs
- Database Systems: PostgreSQL, MongoDB, Redis, MySQL, SQLite
- Backend Frameworks: Node.js, Express, FastAPI, Django, Spring Boot
- Authentication: JWT, OAuth2, SAML, session management
- Architecture: Microservices, monoliths, serverless, event-driven
- Performance: Caching, indexing, query optimization, load balancing
- Security: Input validation, SQL injection prevention, CORS, rate limiting

SPECIALIZATIONS:
- Frameworks: ${this.config.specialization.frameworks.join(', ')}
- Databases: ${this.config.specialization.databases.join(', ')}
- API Patterns: ${this.config.specialization.apiPatterns.join(', ')}
- Auth Methods: ${this.config.specialization.authMethods.join(', ')}
- Scaling: ${this.config.specialization.scalingStrategies.join(', ')}

TOOLS AVAILABLE: ${this.config.allowedTools.join(', ')}

When working on tasks:
1. Analyze requirements for backend implications
2. Consider security, performance, and scalability
3. Design robust data models and API contracts
4. Implement with error handling and logging
5. Write comprehensive tests
6. Document APIs and deployment procedures

Always provide structured JSON responses with results, artifacts, and next steps.
    `.trim();
  }

  /**
   * Build specialization-specific prompt additions
   */
  private buildSpecializationPrompt(): string {
    const frameworks = this.config.specialization.frameworks.length > 0 
      ? `Focus on ${this.config.specialization.frameworks.join(', ')} frameworks.` 
      : '';
    
    const databases = this.config.specialization.databases.length > 0
      ? `Prioritize ${this.config.specialization.databases.join(', ')} databases.`
      : '';

    return `
${frameworks}
${databases}

Working Directory: ${this.config.workingDirectory}
Agent Type: Backend Specialist
Max Concurrent Tasks: ${this.config.maxConcurrentTasks}
    `.trim();
  }

  /**
   * Build task-specific prompt for backend work
   */
  private buildTaskPrompt(task: AgentTask): string {
    const backendContext = this.extractBackendContext(task.context);
    
    return `
BACKEND DEVELOPMENT TASK:

Task: ${task.title}
Description: ${task.description}
Requirements: ${task.requirements.join(', ')}

BACKEND-SPECIFIC CONSIDERATIONS:
${backendContext}

EXECUTION REQUIREMENTS:
1. Analyze for database schema implications
2. Design secure API endpoints
3. Implement proper error handling
4. Add input validation and sanitization
5. Consider performance and caching needs
6. Write unit and integration tests
7. Document API specifications

Please execute this backend development task using your specialized expertise.
Respond with structured JSON containing your implementation, tests, documentation, and recommendations.
    `.trim();
  }

  /**
   * Extract backend-specific context from task
   */
  private extractBackendContext(context: TaskContext): string {
    const contextParts = [];

    if (context.relevantFiles.some(f => f.includes('package.json') || f.includes('requirements.txt'))) {
      contextParts.push('- Review existing dependencies and suggest optimizations');
    }

    if (context.relevantFiles.some(f => f.includes('.sql') || f.includes('schema') || f.includes('model'))) {
      contextParts.push('- Analyze database schema and relationships');
    }

    if (context.relevantFiles.some(f => f.includes('api') || f.includes('route') || f.includes('controller'))) {
      contextParts.push('- Review API structure and suggest improvements');
    }

    if (context.constraints.some(c => c.includes('security'))) {
      contextParts.push('- Implement security best practices and threat mitigation');
    }

    if (context.constraints.some(c => c.includes('performance'))) {
      contextParts.push('- Optimize for performance and scalability');
    }

    return contextParts.length > 0 ? contextParts.join('\n') : '- Apply general backend best practices';
  }

  /**
   * Send task to Claude CLI process and await response
   */
  private async sendTaskToAgent(
    taskId: string, 
    prompt: string
  ): Promise<{ output: string; artifacts?: string[]; recommendations?: string[] }> {
    
    if (!this.process || !this.sessionId) {
      throw new Error('Backend agent not ready');
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      const timeout = setTimeout(() => {
        reject(new Error(`Backend task ${taskId} execution timeout`));
      }, this.config.sessionTimeout);

      const dataHandler = (data: Buffer) => {
        outputBuffer += data.toString();
        
        try {
          const response = JSON.parse(outputBuffer);
          
          if (response.type === 'task_completed' || response.status === 'completed') {
            clearTimeout(timeout);
            this.process!.stdout?.off('data', dataHandler);
            resolve({
              output: response.output || response.result,
              artifacts: response.artifacts,
              recommendations: response.recommendations
            });
          }
        } catch (error) {
          // Continue waiting for complete response
        }
      };

      this.process.stdout?.on('data', dataHandler);

      // Send task to agent
      const taskMessage = {
        type: 'execute_task',
        session_id: this.sessionId,
        task: {
          id: taskId,
          prompt: prompt,
          specialization: 'backend',
          timestamp: Date.now()
        }
      };

      this.process.stdin?.write(JSON.stringify(taskMessage) + '\n');
    });
  }

  /**
   * Initialize agent session
   */
  private async initializeSession(): Promise<string> {
    if (!this.process) {
      throw new Error('Backend agent process not started');
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Backend agent initialization timeout'));
      }, 30000);

      const dataHandler = (data: Buffer) => {
        outputBuffer += data.toString();
        
        try {
          const response = JSON.parse(outputBuffer);
          if (response.session_id || response.sessionId) {
            clearTimeout(timeout);
            this.process!.stdout?.off('data', dataHandler);
            resolve(response.session_id || response.sessionId);
          }
        } catch (error) {
          // Continue waiting
        }
      };

      this.process.stdout?.on('data', dataHandler);

      // Send initialization
      this.process.stdin?.write(JSON.stringify({
        type: 'initialization',
        agent_type: 'backend_specialist',
        capabilities: this.config.specialization,
        timestamp: Date.now()
      }) + '\n');
    });
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.on('error', (error) => {
      this.emit('process_error', { agent: 'backend', error });
    });

    this.process.on('exit', (code) => {
      this.emit('process_exited', { agent: 'backend', code });
      this.cleanup();
    });

    this.process.stderr?.on('data', (data) => {
      this.emit('process_stderr', { agent: 'backend', data: data.toString() });
    });
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      type: 'backend_specialist',
      initialized: this.isInitialized,
      sessionId: this.sessionId,
      activeTasks: this.currentTasks.size,
      maxCapacity: this.config.maxConcurrentTasks,
      specialization: this.config.specialization,
      processActive: this.process && !this.process.killed
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.isInitialized = false;
    this.sessionId = undefined;
    this.currentTasks.clear();
    this.emit('cleaned_up');
  }
}
