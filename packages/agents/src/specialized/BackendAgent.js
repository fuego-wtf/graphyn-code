/**
 * Backend Agent - Real Claude CLI Integration
 *
 * Specializes in backend development: APIs, databases, authentication, server-side logic
 * Uses real Claude Code CLI for actual code generation
 */
import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
export class BackendAgent extends ClaudeCodeAgent {
    constructor(id, workspaceDir) {
        const config = {
            id,
            type: 'backend',
            specialization: 'Backend Development',
            capabilities: [
                'API Development',
                'Database Design',
                'Authentication Systems',
                'Server Configuration',
                'Middleware Creation',
                'Testing Strategy',
                'Security Implementation'
            ],
            tools: [
                'fs.read',
                'fs.write',
                'fs.patch',
                'shell.exec',
                'git.status',
                'git.commit'
            ],
            workspaceDir,
            timeout: 120000, // 2 minutes for complex backend tasks
            maxRetries: 2
        };
        super(config);
    }
    /**
     * Execute backend development task with Claude CLI
     */
    async execute(task) {
        console.log(`[${this.config.id}] 🔧 Starting backend development task: ${task}`);
        try {
            // Create a proper Task object
            const taskObj = {
                id: `backend-${Date.now()}`,
                type: 'backend_development',
                description: task,
                requirements: this.parseTaskRequirements(task),
                config: {
                    tools: this.config.tools
                }
            };
            // Execute with real Claude CLI
            const execution = await this.executeTask(taskObj);
            if (execution.status === 'completed') {
                const output = execution.output || 'Task completed successfully';
                console.log(`[${this.config.id}] ✅ Backend task completed`);
                return this.formatBackendOutput(output);
            }
            else {
                const error = execution.error || 'Unknown error occurred';
                console.log(`[${this.config.id}] ❌ Backend task failed: ${error}`);
                throw new Error(`Backend task failed: ${error}`);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`[${this.config.id}] ❌ Backend agent error: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Build specialized backend prompt for Claude
     */
    buildTaskPrompt(task) {
        return `You are a senior backend developer with expertise in:
- REST API development and GraphQL
- Database design (SQL/NoSQL)
- Authentication and authorization (JWT, OAuth2)
- Server-side frameworks (Node.js, Express, Fastify)
- Microservices architecture
- Testing strategies (unit, integration, e2e)
- Security best practices

**Current Task:** ${task.description}

**Requirements Analysis:**
${task.requirements?.map(req => `• ${req}`).join('\n') || 'No specific requirements provided'}

**Available Tools:** ${this.config.tools?.join(', ') || 'Standard tools'}

**Instructions:**
1. Analyze the task and break down into implementation steps
2. Create/modify necessary backend files
3. Implement proper error handling and validation
4. Add appropriate logging and monitoring
5. Include security considerations
6. Write or update relevant tests
7. Provide clear summary of changes made

Please implement this backend task step by step, creating actual code files and explaining your approach.`;
    }
    /**
     * Parse task requirements from natural language
     */
    parseTaskRequirements(task) {
        const requirements = [];
        // Extract common backend patterns
        if (task.toLowerCase().includes('auth') || task.toLowerCase().includes('login')) {
            requirements.push('Authentication system required');
            requirements.push('JWT token handling');
            requirements.push('Password security');
        }
        if (task.toLowerCase().includes('api') || task.toLowerCase().includes('endpoint')) {
            requirements.push('REST API endpoints');
            requirements.push('Request validation');
            requirements.push('Response formatting');
        }
        if (task.toLowerCase().includes('database') || task.toLowerCase().includes('data')) {
            requirements.push('Database schema design');
            requirements.push('Data validation');
            requirements.push('Migration scripts');
        }
        if (task.toLowerCase().includes('test')) {
            requirements.push('Unit tests');
            requirements.push('API integration tests');
        }
        return requirements.length > 0 ? requirements : ['General backend development'];
    }
    /**
     * Format Claude's output for backend context
     */
    formatBackendOutput(output) {
        // Add backend-specific formatting
        const lines = output.split('\n').filter(line => line.trim());
        const formatted = [];
        formatted.push('🔧 Backend Development Results:');
        formatted.push('');
        for (const line of lines) {
            if (line.includes('Created') || line.includes('Modified') || line.includes('Added')) {
                formatted.push(`✅ ${line}`);
            }
            else if (line.includes('Error') || line.includes('Failed')) {
                formatted.push(`❌ ${line}`);
            }
            else if (line.includes('Test') || line.includes('Spec')) {
                formatted.push(`🧪 ${line}`);
            }
            else {
                formatted.push(`📝 ${line}`);
            }
        }
        return formatted.join('\n');
    }
    /**
     * Check if agent is currently running a task
     */
    isRunning() {
        return this.currentTask !== null;
    }
    /**
     * Get current task status
     */
    getCurrentTask() {
        return this.currentTask;
    }
}
//# sourceMappingURL=BackendAgent.js.map