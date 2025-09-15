/**
 * Security Expert Agent
 * 
 * Specialized Claude Code agent for cybersecurity tasks including:
 * - Vulnerability assessment and threat modeling
 * - Security best practices implementation
 * - Authentication and authorization systems
 * - Code security reviews and penetration testing
 * - Compliance and regulatory requirements
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AgentTask, AgentExecutionResult, TaskContext } from '../ClaudeCodeAgentLauncher.js';

export interface SecuritySpecialization {
  threatModeling: string[];
  vulnerabilityTypes: string[];
  authenticationMethods: string[];
  complianceFrameworks: string[];
  securityTools: string[];
}

export interface SecurityAgentConfig {
  workingDirectory: string;
  specialization: SecuritySpecialization;
  allowedTools: string[];
  sessionTimeout: number;
  maxConcurrentTasks: number;
  securityLevel: 'basic' | 'advanced' | 'enterprise';
}

export class SecurityAgent extends EventEmitter {
  private config: SecurityAgentConfig;
  private process?: ChildProcess;
  private sessionId?: string;
  private currentTasks = new Set<string>();
  private isInitialized = false;

  constructor(config: SecurityAgentConfig) {
    super();
    this.config = {
      allowedTools: ['Read', 'Grep', 'Bash', 'WebSearch'],
      sessionTimeout: 300000, // 5 minutes
      maxConcurrentTasks: 3,
      securityLevel: 'advanced',
      ...config
    };
  }

  /**
   * Initialize security agent with specialized capabilities
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const systemPrompt = this.buildSecuritySystemPrompt();
    
    // Spawn headless Claude CLI process with security focus
    const args = [
      '-p', systemPrompt,
      '--output-format', 'json',
      '--allowedTools', this.config.allowedTools.join(','),
      '--no-interactive',
      '--append-system-prompt', this.buildSecuritySpecializationPrompt()
    ];

    this.process = spawn('claude', args, {
      cwd: this.config.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_AGENT_TYPE: 'security_expert',
        CLAUDE_SECURITY_LEVEL: this.config.securityLevel,
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
   * Execute security-specific task
   */
  async executeTask(task: AgentTask): Promise<AgentExecutionResult> {
    if (!this.isInitialized || !this.process || !this.sessionId) {
      throw new Error('Security agent not initialized');
    }

    if (this.currentTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error('Security agent at maximum capacity');
    }

    this.currentTasks.add(task.id);
    this.emit('task_started', { taskId: task.id, agent: 'security' });

    const startTime = Date.now();

    try {
      const prompt = this.buildSecurityTaskPrompt(task);
      const result = await this.sendTaskToAgent(task.id, prompt);

      const executionResult: AgentExecutionResult = {
        agentId: 'security_expert',
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
        agentId: 'security_expert',
        taskId: task.id,
        success: false,
        output: `Security task failed: ${error}`,
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
   * Build security-specific system prompt
   */
  private buildSecuritySystemPrompt(): string {
    return `
You are a Cybersecurity Expert, a specialist in application security with comprehensive knowledge of:

CORE SECURITY EXPERTISE:
- Threat Modeling: STRIDE, PASTA, attack trees, risk assessment
- Vulnerability Assessment: OWASP Top 10, CVE analysis, penetration testing
- Authentication: Multi-factor auth, SSO, OAuth2, JWT, SAML
- Authorization: RBAC, ABAC, policy engines, privilege escalation
- Cryptography: Encryption, hashing, digital signatures, key management
- Secure Development: Secure coding practices, SAST/DAST, code review
- Compliance: GDPR, HIPAA, SOC2, PCI-DSS, ISO27001
- Network Security: Firewalls, VPNs, intrusion detection, DDoS protection

SPECIALIZATIONS:
- Threat Modeling: ${this.config.specialization.threatModeling.join(', ')}
- Vulnerabilities: ${this.config.specialization.vulnerabilityTypes.join(', ')}
- Authentication: ${this.config.specialization.authenticationMethods.join(', ')}
- Compliance: ${this.config.specialization.complianceFrameworks.join(', ')}
- Security Tools: ${this.config.specialization.securityTools.join(', ')}

SECURITY LEVEL: ${this.config.securityLevel.toUpperCase()}
TOOLS AVAILABLE: ${this.config.allowedTools.join(', ')}

When performing security analysis:
1. Identify potential attack vectors and threat models
2. Assess current security posture and vulnerabilities
3. Recommend security controls and mitigations
4. Implement defense-in-depth strategies
5. Ensure compliance with relevant frameworks
6. Provide security testing and validation procedures
7. Document security architecture and incident response

Always prioritize security by design and provide actionable security recommendations.
    `.trim();
  }

  /**
   * Build security specialization prompt additions
   */
  private buildSecuritySpecializationPrompt(): string {
    const level = this.config.securityLevel;
    const requirements = this.getSecurityRequirementsByLevel(level);
    
    return `
SECURITY LEVEL REQUIREMENTS (${level.toUpperCase()}):
${requirements.join('\n')}

Working Directory: ${this.config.workingDirectory}
Agent Type: Security Expert
Max Concurrent Tasks: ${this.config.maxConcurrentTasks}
Security Focus Areas: ${this.config.specialization.threatModeling.join(', ')}
    `.trim();
  }

  /**
   * Get security requirements based on level
   */
  private getSecurityRequirementsByLevel(level: string): string[] {
    switch (level) {
      case 'enterprise':
        return [
          '- Implement zero-trust architecture principles',
          '- Conduct comprehensive threat modeling',
          '- Ensure compliance with enterprise frameworks',
          '- Perform advanced penetration testing',
          '- Design incident response procedures'
        ];
      case 'advanced':
        return [
          '- Apply security best practices and standards',
          '- Implement robust authentication and authorization',
          '- Conduct security code reviews',
          '- Perform vulnerability assessments',
          '- Design secure system architecture'
        ];
      default:
        return [
          '- Follow basic security principles',
          '- Implement input validation and sanitization',
          '- Use secure authentication methods',
          '- Apply OWASP guidelines',
          '- Ensure data protection'
        ];
    }
  }

  /**
   * Build task-specific prompt for security work
   */
  private buildSecurityTaskPrompt(task: AgentTask): string {
    const securityContext = this.extractSecurityContext(task.context);
    const threatModel = this.generateThreatModel(task);
    
    return `
SECURITY ASSESSMENT TASK:

Task: ${task.title}
Description: ${task.description}
Requirements: ${task.requirements.join(', ')}

SECURITY CONTEXT:
${securityContext}

THREAT MODEL CONSIDERATIONS:
${threatModel}

SECURITY EXECUTION REQUIREMENTS:
1. Identify potential security vulnerabilities
2. Assess authentication and authorization mechanisms
3. Review data protection and privacy compliance
4. Analyze attack surfaces and entry points
5. Recommend security controls and mitigations
6. Design security testing strategies
7. Document security findings and remediation steps

Security Level: ${this.config.securityLevel.toUpperCase()}

Please perform this security analysis using your expert knowledge and provide:
- Detailed security assessment
- Vulnerability findings with CVSS scores where applicable
- Specific remediation recommendations
- Security testing procedures
- Compliance gap analysis

Respond with structured JSON containing your security analysis, findings, recommendations, and action items.
    `.trim();
  }

  /**
   * Extract security-specific context from task
   */
  private extractSecurityContext(context: TaskContext): string {
    const contextParts = [];

    if (context.relevantFiles.some(f => f.includes('auth') || f.includes('login') || f.includes('token'))) {
      contextParts.push('- Authentication/authorization system detected - perform security review');
    }

    if (context.relevantFiles.some(f => f.includes('user') || f.includes('account') || f.includes('profile'))) {
      contextParts.push('- User management system detected - assess access controls');
    }

    if (context.relevantFiles.some(f => f.includes('api') || f.includes('endpoint') || f.includes('route'))) {
      contextParts.push('- API endpoints detected - analyze for injection and access control vulnerabilities');
    }

    if (context.relevantFiles.some(f => f.includes('database') || f.includes('sql') || f.includes('query'))) {
      contextParts.push('- Database access detected - check for SQL injection and data protection');
    }

    if (context.constraints.some(c => c.includes('compliance') || c.includes('regulation'))) {
      contextParts.push('- Compliance requirements detected - perform regulatory gap analysis');
    }

    if (context.constraints.some(c => c.includes('security') || c.includes('secure'))) {
      contextParts.push('- Explicit security requirements - perform comprehensive security analysis');
    }

    return contextParts.length > 0 ? contextParts.join('\n') : '- General security assessment and hardening recommendations';
  }

  /**
   * Generate threat model for the task
   */
  private generateThreatModel(task: AgentTask): string {
    const threats = [];

    // Analyze task description for threat indicators
    const description = task.description.toLowerCase();
    
    if (description.includes('auth') || description.includes('login')) {
      threats.push('- Authentication bypass and credential attacks');
      threats.push('- Session management vulnerabilities');
    }

    if (description.includes('api') || description.includes('endpoint')) {
      threats.push('- API abuse and injection attacks');
      threats.push('- Unauthorized access and data exposure');
    }

    if (description.includes('database') || description.includes('data')) {
      threats.push('- Data breaches and unauthorized data access');
      threats.push('- SQL injection and NoSQL injection attacks');
    }

    if (description.includes('user') || description.includes('input')) {
      threats.push('- Input validation bypass and XSS attacks');
      threats.push('- Privilege escalation and access control bypass');
    }

    if (threats.length === 0) {
      threats.push('- General application security threats');
      threats.push('- Configuration and deployment vulnerabilities');
    }

    return threats.join('\n');
  }

  /**
   * Send task to Claude CLI process and await response
   */
  private async sendTaskToAgent(
    taskId: string, 
    prompt: string
  ): Promise<{ output: string; artifacts?: string[]; recommendations?: string[] }> {
    
    if (!this.process || !this.sessionId) {
      throw new Error('Security agent not ready');
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      const timeout = setTimeout(() => {
        reject(new Error(`Security task ${taskId} execution timeout`));
      }, this.config.sessionTimeout);

      const dataHandler = (data: Buffer) => {
        outputBuffer += data.toString();
        
        try {
          const response = JSON.parse(outputBuffer);
          
          if (response.type === 'security_analysis_completed' || response.status === 'completed') {
            clearTimeout(timeout);
            this.process!.stdout?.off('data', dataHandler);
            resolve({
              output: response.output || response.analysis,
              artifacts: response.artifacts,
              recommendations: response.recommendations || response.mitigations
            });
          }
        } catch (error) {
          // Continue waiting for complete response
        }
      };

      this.process.stdout?.on('data', dataHandler);

      // Send security task to agent
      const taskMessage = {
        type: 'execute_security_task',
        session_id: this.sessionId,
        task: {
          id: taskId,
          prompt: prompt,
          specialization: 'security',
          security_level: this.config.securityLevel,
          timestamp: Date.now()
        }
      };

      this.process.stdin?.write(JSON.stringify(taskMessage) + '\n');
    });
  }

  /**
   * Initialize security agent session
   */
  private async initializeSession(): Promise<string> {
    if (!this.process) {
      throw new Error('Security agent process not started');
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Security agent initialization timeout'));
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

      // Send security agent initialization
      this.process.stdin?.write(JSON.stringify({
        type: 'security_initialization',
        agent_type: 'security_expert',
        security_level: this.config.securityLevel,
        specializations: this.config.specialization,
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
      this.emit('process_error', { agent: 'security', error });
    });

    this.process.on('exit', (code) => {
      this.emit('process_exited', { agent: 'security', code });
      this.cleanup();
    });

    this.process.stderr?.on('data', (data) => {
      this.emit('process_stderr', { agent: 'security', data: data.toString() });
    });
  }

  /**
   * Get security agent status
   */
  getStatus() {
    return {
      type: 'security_expert',
      initialized: this.isInitialized,
      sessionId: this.sessionId,
      activeTasks: this.currentTasks.size,
      maxCapacity: this.config.maxConcurrentTasks,
      securityLevel: this.config.securityLevel,
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
