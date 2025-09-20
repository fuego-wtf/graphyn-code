/**
 * Security Agent - Real Claude CLI Integration
 *
 * Specializes in security analysis, vulnerability assessment, and secure code implementation
 * Uses real Claude Code CLI for actual security analysis and code generation
 */
import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
export class SecurityAgent extends ClaudeCodeAgent {
    constructor(id, workspaceDir) {
        const config = {
            id,
            type: 'security',
            specialization: 'Security Analysis & Implementation',
            capabilities: [
                'Vulnerability Assessment',
                'Security Code Review',
                'Authentication Security',
                'Encryption Implementation',
                'Access Control Design',
                'Security Testing',
                'Compliance Auditing',
                'Threat Modeling'
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
            timeout: 180000, // 3 minutes for comprehensive security analysis
            maxRetries: 2
        };
        super(config);
    }
    /**
     * Execute security analysis task with Claude CLI
     */
    async execute(task) {
        console.log(`[${this.config.id}] 🛡️ Starting security analysis task: ${task}`);
        try {
            // Create a proper Task object
            const taskObj = {
                id: `security-${Date.now()}`,
                type: 'security_analysis',
                description: task,
                requirements: this.parseSecurityRequirements(task),
                config: {
                    tools: this.config.tools
                }
            };
            // Execute with real Claude CLI
            const execution = await this.executeTask(taskObj);
            if (execution.status === 'completed') {
                const output = execution.output || 'Security analysis completed';
                console.log(`[${this.config.id}] ✅ Security task completed`);
                return this.formatSecurityOutput(output);
            }
            else {
                const error = execution.error || 'Unknown error occurred';
                console.log(`[${this.config.id}] ❌ Security task failed: ${error}`);
                throw new Error(`Security task failed: ${error}`);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`[${this.config.id}] ❌ Security agent error: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Build specialized security prompt for Claude
     */
    buildTaskPrompt(task) {
        return `You are a senior cybersecurity expert with expertise in:
- Application security and secure coding practices
- Vulnerability assessment and penetration testing
- Authentication and authorization security
- Cryptography and encryption implementation
- OWASP Top 10 and security compliance
- Threat modeling and risk assessment
- Security code review and static analysis
- Incident response and security monitoring

**Current Security Task:** ${task.description}

**Security Requirements Analysis:**
${task.requirements?.map(req => `• ${req}`).join('\n') || 'No specific security requirements provided'}

**Available Tools:** ${this.config.tools?.join(', ') || 'Standard tools'}

**Security Analysis Instructions:**
1. Conduct comprehensive security assessment
2. Identify potential vulnerabilities and security gaps
3. Analyze authentication and authorization mechanisms
4. Review data handling and encryption practices
5. Check for common security anti-patterns (OWASP Top 10)
6. Implement security improvements where needed
7. Generate security recommendations and remediation steps
8. Create or update security tests and validation

**Security Focus Areas:**
- Input validation and sanitization
- SQL injection and XSS prevention
- Authentication bypass vulnerabilities
- Insecure direct object references
- Security misconfiguration
- Sensitive data exposure
- Insufficient logging and monitoring

Please perform a thorough security analysis and provide actionable security improvements.`;
    }
    /**
     * Parse security requirements from task description
     */
    parseSecurityRequirements(task) {
        const requirements = [];
        const taskLower = task.toLowerCase();
        // Authentication security
        if (taskLower.includes('auth') || taskLower.includes('login') || taskLower.includes('password')) {
            requirements.push('Authentication security analysis');
            requirements.push('Password security validation');
            requirements.push('Session management review');
        }
        // API security
        if (taskLower.includes('api') || taskLower.includes('endpoint')) {
            requirements.push('API security assessment');
            requirements.push('Input validation analysis');
            requirements.push('Rate limiting evaluation');
        }
        // Database security
        if (taskLower.includes('database') || taskLower.includes('sql') || taskLower.includes('data')) {
            requirements.push('SQL injection vulnerability scan');
            requirements.push('Database access control review');
            requirements.push('Data encryption assessment');
        }
        // Web security
        if (taskLower.includes('web') || taskLower.includes('frontend') || taskLower.includes('xss')) {
            requirements.push('XSS vulnerability analysis');
            requirements.push('CSRF protection evaluation');
            requirements.push('Content Security Policy review');
        }
        // General vulnerability assessment
        if (taskLower.includes('scan') || taskLower.includes('vuln') || taskLower.includes('audit')) {
            requirements.push('Comprehensive vulnerability scan');
            requirements.push('Security code review');
            requirements.push('OWASP Top 10 assessment');
        }
        // Encryption and crypto
        if (taskLower.includes('encrypt') || taskLower.includes('crypto') || taskLower.includes('hash')) {
            requirements.push('Encryption implementation review');
            requirements.push('Cryptographic best practices audit');
            requirements.push('Key management assessment');
        }
        return requirements.length > 0 ? requirements : ['General security assessment'];
    }
    /**
     * Format Claude's output for security context with appropriate severity indicators
     */
    formatSecurityOutput(output) {
        const lines = output.split('\n').filter(line => line.trim());
        const formatted = [];
        formatted.push('🛡️ Security Analysis Results:');
        formatted.push('');
        for (const line of lines) {
            const lineLower = line.toLowerCase();
            // Critical security issues
            if (lineLower.includes('critical') || lineLower.includes('high risk') || lineLower.includes('severe')) {
                formatted.push(`🔴 CRITICAL: ${line}`);
            }
            // Medium security issues  
            else if (lineLower.includes('medium') || lineLower.includes('warning') || lineLower.includes('potential')) {
                formatted.push(`🟡 MEDIUM: ${line}`);
            }
            // Low security issues
            else if (lineLower.includes('low') || lineLower.includes('minor') || lineLower.includes('info')) {
                formatted.push(`🟢 LOW: ${line}`);
            }
            // Security improvements implemented
            else if (lineLower.includes('implemented') || lineLower.includes('fixed') || lineLower.includes('secured')) {
                formatted.push(`✅ SECURED: ${line}`);
            }
            // Security recommendations
            else if (lineLower.includes('recommend') || lineLower.includes('should') || lineLower.includes('consider')) {
                formatted.push(`📝 RECOMMENDATION: ${line}`);
            }
            // Tests and validation
            else if (lineLower.includes('test') || lineLower.includes('validation') || lineLower.includes('verify')) {
                formatted.push(`🧪 VALIDATION: ${line}`);
            }
            // Default security info
            else {
                formatted.push(`🔍 ${line}`);
            }
        }
        return formatted.join('\n');
    }
    /**
     * Check if security analysis is currently running
     */
    isRunning() {
        return this.currentTask !== null;
    }
    /**
     * Get current security task status
     */
    getCurrentTask() {
        return this.currentTask;
    }
}
//# sourceMappingURL=SecurityAgent.js.map