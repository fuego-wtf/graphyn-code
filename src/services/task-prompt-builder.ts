import type { TaskGenerationParams, RepositoryContext } from './claude-task-generator.js';
import type { AgentConfig } from '../types/agent.js';

export class TaskPromptBuilder {
  buildPrompt(params: TaskGenerationParams): string {
    const { userQuery, agents, repoContext } = params;
    
    return `# Task Generation Request

You are a technical project manager breaking down a development request into specific tasks for an AI development team.

## User Request
"${userQuery}"

## Available Agents
${this.formatAgents(agents)}

## Repository Context
${this.formatRepoContext(repoContext)}

## Instructions
1. Analyze the user request and repository context carefully
2. Break the request down into 3-8 specific, actionable tasks
3. Each task should be assigned to the most suitable agent based on their role and skills
4. Identify task dependencies (which tasks must be completed before others)
5. Ensure tasks are concrete, measurable, and achievable
6. Consider the existing codebase patterns and conventions
7. Tasks should build upon existing code rather than rewriting everything

## Important Guidelines
- Tasks should be specific enough to be actionable but not overly prescriptive
- Consider the skills and capabilities of each agent when assigning tasks
- Ensure proper task sequencing based on dependencies
- Include acceptance criteria that can be verified
- Break down complex features into smaller, manageable tasks
- Consider existing code patterns and frameworks in the repository

## Output Format
You MUST return ONLY a valid JSON array. Do not include any other text, explanations, or markdown formatting outside the JSON.

The JSON structure MUST be:
\`\`\`json
[
  {
    "id": "task_1",
    "title": "Short descriptive title (max 60 chars)",
    "description": "Detailed description of what needs to be done, including specific files or components to modify",
    "assigned_agent": "agent_name (must match one of the available agents EXACTLY)",
    "dependencies": ["task_id1", "task_id2"],
    "estimated_complexity": "low|medium|high",
    "acceptance_criteria": [
      "Specific criterion 1",
      "Specific criterion 2"
    ]
  }
]
\`\`\`

CRITICAL: 
- The "assigned_agent" field MUST be one of the agent names listed above (case-sensitive)
- Return the JSON array wrapped in \`\`\`json\`\`\` code blocks
- Do not include any text outside the code blocks
- Ensure the JSON is valid and can be parsed

## Example Output
For a request "Add user authentication to my Next.js app", you might generate:
\`\`\`json
[
  {
    "id": "task_1",
    "title": "Design authentication database schema",
    "description": "Create database schema for user authentication including users table, sessions table, and any necessary indexes. Consider using the existing Prisma setup if available.",
    "assigned_agent": "backend",
    "dependencies": [],
    "estimated_complexity": "medium",
    "acceptance_criteria": [
      "Schema includes users table with email, hashed password, created_at",
      "Sessions table with token, user_id, expires_at",
      "Proper indexes for performance",
      "Schema is compatible with existing database setup"
    ]
  },
  {
    "id": "task_2",
    "title": "Implement authentication API endpoints",
    "description": "Create REST API endpoints for user registration, login, logout, and session validation. Use existing API patterns found in the codebase.",
    "assigned_agent": "backend",
    "dependencies": ["task_1"],
    "estimated_complexity": "high",
    "acceptance_criteria": [
      "POST /api/auth/register endpoint works",
      "POST /api/auth/login returns JWT token",
      "POST /api/auth/logout invalidates session",
      "Middleware for protected routes",
      "Proper error handling and validation"
    ]
  },
  {
    "id": "task_3",
    "title": "Create authentication UI components",
    "description": "Build React components for login form, registration form, and password reset. Follow the existing component patterns and styling conventions.",
    "assigned_agent": "frontend",
    "dependencies": [],
    "estimated_complexity": "medium",
    "acceptance_criteria": [
      "Login form with email/password fields",
      "Registration form with validation",
      "Password reset flow",
      "Responsive design matching app style",
      "Proper form validation and error states"
    ]
  },
  {
    "id": "task_4",
    "title": "Integrate auth UI with backend API",
    "description": "Connect the authentication UI components to the backend API endpoints, implement client-side session management and protected route handling.",
    "assigned_agent": "frontend",
    "dependencies": ["task_2", "task_3"],
    "estimated_complexity": "medium",
    "acceptance_criteria": [
      "Login/logout flow works end-to-end",
      "JWT token stored securely",
      "Protected routes redirect to login",
      "User context available throughout app",
      "Proper error handling for API failures"
    ]
  }
]
\`\`\`

Now generate tasks for the given request. Return ONLY the JSON array wrapped in \`\`\`json\`\`\` code blocks, no additional text or explanation outside the code blocks.`;
  }

  private formatAgents(agents: AgentConfig[]): string {
    if (!agents || agents.length === 0) {
      return '- **backend** (Backend Developer)\n  - Emoji: 🔧\n  - Skills: General backend development\n  - Capabilities: API development, database, server-side logic';
    }
    
    return agents.map((agent, index) => {
      const skills = 'Not specified';
      
      // Ensure capabilities is always an array
      const capabilities = Array.isArray(agent.capabilities) 
        ? agent.capabilities 
        : (agent.capabilities ? [agent.capabilities] : []);
      
      return `- **${agent.name}** (${agent.role}) [USE THIS EXACT NAME: "${agent.name}"]
  - Emoji: ${agent.emoji || '🤖'}
  - Skills: ${skills}
  - Capabilities: ${capabilities.join(', ') || 'General development'}`;
    }).join('\n');
  }

  private formatRepoContext(context: RepositoryContext): string {
    const sections: string[] = [];
    
    if (context.framework) {
      sections.push(`**Framework**: ${context.framework}`);
    }
    
    if (context.language) {
      sections.push(`**Language**: ${context.language}`);
    }
    
    if (context.detected_stack && context.detected_stack.length > 0) {
      sections.push(`**Detected Stack**: ${context.detected_stack.join(', ')}`);
    }
    
    if (context.dependencies && Object.keys(context.dependencies).length > 0) {
      const majorDeps = Object.entries(context.dependencies)
        .slice(0, 10)
        .map(([name, version]) => `${name}@${version}`)
        .join(', ');
      sections.push(`**Key Dependencies**: ${majorDeps}`);
    }
    
    if (context.patterns && context.patterns.length > 0) {
      sections.push(`**Code Patterns**: ${context.patterns.join(', ')}`);
    }
    
    if (context.structure) {
      const structureItems = [];
      if (context.structure.hasTests) structureItems.push('Has tests');
      if (context.structure.hasCI) structureItems.push('Has CI/CD');
      if (context.structure.hasDocs) structureItems.push('Has documentation');
      
      if (structureItems.length > 0) {
        sections.push(`**Project Structure**: ${structureItems.join(', ')}`);
      }
    }
    
    return sections.length > 0 
      ? sections.join('\n')
      : 'No specific context available';
  }

  buildRegenerationPrompt(
    params: TaskGenerationParams, 
    previousTasks: any[], 
    feedback: string
  ): string {
    const basePrompt = this.buildPrompt(params);
    
    const regenerationSection = `

## Previous Task Generation
The following tasks were generated but need revision:
\`\`\`json
${JSON.stringify(previousTasks, null, 2)}
\`\`\`

## User Feedback
${feedback}

## Instructions for Regeneration
1. Consider the user's feedback carefully
2. Maintain any tasks that don't need changes
3. Modify tasks based on the feedback
4. Ensure the new task list addresses all concerns
5. Keep the same output format

Generate an improved task list based on this feedback.`;

    return basePrompt + regenerationSection;
  }
}