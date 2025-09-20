/**
 * Base Claude Code Agent - Foundation for all specialized agents
 * Provides real Claude CLI integration with process spawning and session management
 */
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
/**
 * Base Claude Code Agent class
 * Handles real Claude CLI integration with proper process management
 */
export class ClaudeCodeAgent extends EventEmitter {
    config;
    currentTask = null;
    claudeProcess = null;
    messageHistory = [];
    sessionId;
    workspaceReady = false;
    constructor(config) {
        super();
        this.config = config;
        this.sessionId = `${config.id}-${Date.now()}`;
    }
    /**
     * Initialize the agent workspace and prepare for task execution
     */
    async initialize() {
        try {
            // Create isolated workspace directory
            if (this.config.workspaceDir) {
                await fs.mkdir(this.config.workspaceDir, { recursive: true });
                // Create agent context file
                const contextPath = path.join(this.config.workspaceDir, 'CLAUDE.md');
                const contextContent = this.generateAgentContext();
                await fs.writeFile(contextPath, contextContent);
            }
            this.workspaceReady = true;
            this.emit('initialized', { agentId: this.config.id, workspaceDir: this.config.workspaceDir });
        }
        catch (error) {
            const err = error;
            this.emit('error', {
                agentId: this.config.id,
                error: `Initialization failed: ${err.message}`
            });
            throw error;
        }
    }
    /**
     * Execute a task using Claude Code CLI
     */
    async executeTask(task) {
        if (!this.workspaceReady) {
            await this.initialize();
        }
        const execution = {
            taskId: task.id,
            agentId: this.config.id,
            status: 'pending',
            startTime: new Date()
        };
        this.currentTask = execution;
        this.emit('taskStarted', execution);
        try {
            execution.status = 'running';
            this.emit('taskProgress', { ...execution, status: 'running' });
            // Prepare Claude prompt with agent specialization context
            const prompt = this.buildTaskPrompt(task);
            // Execute with Claude CLI
            const response = await this.executeWithClaudeCLI(prompt, task.config?.tools || this.config.tools);
            if (response.success) {
                execution.status = 'completed';
                execution.output = response.content;
                execution.metrics = {
                    tokensUsed: response.tokensUsed,
                    duration: response.duration,
                    toolsUsed: response.toolsUsed
                };
            }
            else {
                execution.status = 'failed';
                execution.error = response.error;
            }
        }
        catch (error) {
            execution.status = 'failed';
            execution.error = error instanceof Error ? error.message : String(error);
            this.emit('error', { agentId: this.config.id, taskId: task.id, error: execution.error });
        }
        finally {
            execution.endTime = new Date();
            this.currentTask = null;
            this.emit('taskCompleted', execution);
        }
        return execution;
    }
    /**
     * Execute streaming task with real-time output
     */
    async *executeTaskStream(task) {
        if (!this.workspaceReady) {
            await this.initialize();
        }
        const execution = {
            taskId: task.id,
            agentId: this.config.id,
            status: 'running',
            startTime: new Date()
        };
        this.currentTask = execution;
        yield { type: 'progress', data: { status: 'started', agentId: this.config.id } };
        try {
            const prompt = this.buildTaskPrompt(task);
            // Use streaming Claude CLI execution
            for await (const chunk of this.executeStreamingClaudeCLI(prompt, task.config?.tools || this.config.tools)) {
                yield { type: 'output', data: chunk };
            }
            execution.status = 'completed';
            execution.endTime = new Date();
            yield { type: 'completed', data: execution };
        }
        catch (error) {
            execution.status = 'failed';
            execution.error = error instanceof Error ? error.message : String(error);
            execution.endTime = new Date();
            yield { type: 'error', data: execution };
        }
        finally {
            this.currentTask = null;
        }
    }
    /**
     * Execute prompt with Claude CLI using single-shot mode
     */
    async executeWithClaudeCLI(prompt, tools = []) {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const args = [
                '-p', prompt,
                '--output-format', 'json'
            ];
            // Add tools if specified
            if (tools.length > 0) {
                args.push('--allowedTools', tools.join(','));
            }
            // Add workspace directory if available
            if (this.config.workspaceDir) {
                args.push('--cwd', this.config.workspaceDir);
            }
            const claudeProcess = spawn('claude', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
                }
            });
            let output = '';
            let errorOutput = '';
            claudeProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            claudeProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            claudeProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                if (code === 0) {
                    try {
                        // Parse JSON output from Claude CLI
                        const result = JSON.parse(output.trim());
                        resolve({
                            success: true,
                            content: result.content || result.response || output,
                            tokensUsed: result.usage?.total_tokens || 0,
                            duration,
                            toolsUsed: result.tools_used || []
                        });
                    }
                    catch (parseError) {
                        // Fallback to raw output if JSON parsing fails
                        resolve({
                            success: true,
                            content: output,
                            duration,
                            tokensUsed: 0
                        });
                    }
                }
                else {
                    resolve({
                        success: false,
                        error: errorOutput || `Claude CLI exited with code ${code}`,
                        duration
                    });
                }
            });
            claudeProcess.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Failed to spawn Claude CLI: ${error.message}`,
                    duration: Date.now() - startTime
                });
            });
            // Handle timeout
            const timeout = this.config.timeout || 60000; // 60 seconds default
            setTimeout(() => {
                if (claudeProcess.pid) {
                    claudeProcess.kill();
                    resolve({
                        success: false,
                        error: `Claude CLI timed out after ${timeout}ms`,
                        duration: Date.now() - startTime
                    });
                }
            }, timeout);
        });
    }
    /**
     * Execute streaming Claude CLI with real-time output
     */
    async *executeStreamingClaudeCLI(prompt, tools = []) {
        const args = [
            '-p', prompt,
            '--output-format', 'stream-json',
            '--verbose'
        ];
        if (tools.length > 0) {
            args.push('--allowedTools', tools.join(','));
        }
        if (this.config.workspaceDir) {
            args.push('--cwd', this.config.workspaceDir);
        }
        const claudeProcess = spawn('claude', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
            }
        });
        let buffer = '';
        for await (const chunk of claudeProcess.stdout) {
            buffer += chunk.toString();
            // Process complete JSON lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        if (data.content) {
                            yield data.content;
                        }
                    }
                    catch {
                        // Skip malformed JSON lines
                    }
                }
            }
        }
    }
    /**
     * Build a specialized prompt for the task
     */
    buildTaskPrompt(task) {
        const context = this.generateAgentContext();
        return `${context}

# Current Task
**Task ID:** ${task.id}
**Description:** ${task.description}
**Priority:** ${task.priority}
${task.workspace ? `**Workspace:** ${task.workspace}` : ''}

# Instructions
${task.description}

Please execute this task according to your specialization and capabilities. Use the appropriate tools and provide detailed output about your progress and results.

${task.config?.additionalInstructions || ''}`;
    }
    /**
     * Generate agent-specific context for Claude
     */
    generateAgentContext() {
        return `# ${this.config.specialization} Agent Context

**Agent ID:** ${this.config.id}
**Type:** ${this.config.type}
**Specialization:** ${this.config.specialization}

## Capabilities
${this.config.capabilities.map(cap => `- ${cap}`).join('\n')}

## Available Tools
${(this.config.tools || []).map(tool => `- ${tool}`).join('\n')}

## Working Directory
${this.config.workspaceDir || process.cwd()}

## Session ID
${this.sessionId}

---

You are a specialized AI agent with expertise in ${this.config.specialization}. Use your capabilities and available tools to complete tasks efficiently and accurately. Always provide clear progress updates and detailed results.`;
    }
    /**
     * Get current agent status
     */
    getStatus() {
        return {
            id: this.config.id,
            type: this.config.type,
            status: this.currentTask ? 'busy' : 'idle',
            capabilities: this.config.capabilities,
            metadata: {
                specialization: this.config.specialization,
                workspaceDir: this.config.workspaceDir,
                sessionId: this.sessionId,
                workspaceReady: this.workspaceReady
            },
            lastActive: new Date(),
            currentTask: this.currentTask?.taskId
        };
    }
    /**
     * Clean up agent resources
     */
    async cleanup() {
        if (this.claudeProcess && !this.claudeProcess.killed) {
            this.claudeProcess.kill();
        }
        this.messageHistory = [];
        this.currentTask = null;
        this.workspaceReady = false;
        this.emit('cleanup', { agentId: this.config.id });
    }
    /**
     * Check if agent can handle a specific task
     */
    canHandleTask(task) {
        // Check if agent type matches or is general
        if (this.config.type !== task.agentType && this.config.type !== 'general') {
            return false;
        }
        // Check if agent is available
        if (this.currentTask) {
            return false;
        }
        // Additional capability matching could be added here
        return true;
    }
}
//# sourceMappingURL=ClaudeCodeAgent.js.map