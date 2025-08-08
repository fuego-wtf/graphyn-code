import { GraphynAPIClient } from '../api-client.js';
import { TMUXCockpitOrchestrator } from '../utils/tmux-cockpit-orchestrator.js';
import { RepositoryContextExtractor, ExtractedContext } from './repository-context-extractor.js';
import { RepositoryAnalyzerService } from './repository-analyzer.js';
import { ClaudeAgentLauncher } from './claude-agent-launcher.js';
import type { AgentConfig } from '../types/agent.js';
import chalk from 'chalk';

export interface AskRequest {
  query: string;
  repositoryContext: ExtractedContext;
  userContext: {
    organizationId?: string;
    previousInteractions?: string[];
  };
}

export interface AskResponse {
  agents: AgentResponse[];
  orchestrationPlan: string;
  estimatedTime: number;
  threadId: string;
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  role: string;
  emoji: string;
  prompt: string;
  tasks: AgentTask[];
  dependencies: string[];
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export class AskService {
  private contextExtractor: RepositoryContextExtractor;
  private agentLauncher: ClaudeAgentLauncher;
  private cockpit: TMUXCockpitOrchestrator;

  constructor(private apiClient: GraphynAPIClient) {
    const analyzer = new RepositoryAnalyzerService(apiClient);
    this.contextExtractor = new RepositoryContextExtractor(analyzer);
    this.agentLauncher = new ClaudeAgentLauncher();
    this.cockpit = new TMUXCockpitOrchestrator();
  }

  async processQuery(query: string, workDir: string = process.cwd()): Promise<AskResponse> {
    console.log(chalk.blue('\n🧠 Processing your request with Graphyn AI...\n'));
    
    // Step 1: Extract repository context
    console.log(chalk.gray('📊 Analyzing your codebase...'));
    const context = await this.contextExtractor.extractContext(query, workDir);
    
    // Step 2: Prepare request
    const request: AskRequest = {
      query,
      repositoryContext: context,
      userContext: {
        // Organization ID will be inferred from auth token
      },
    };
    
    // Step 3: Send to backend
    console.log(chalk.gray('🤖 Consulting AI agents...'));
    const response = await this.sendAskRequest(request);
    
    // Step 4: Display orchestration plan
    this.displayOrchestrationPlan(response);
    
    return response;
  }

  private async sendAskRequest(request: AskRequest): Promise<AskResponse> {
    try {
      const response = await this.apiClient.post<AskResponse>('/api/ask', request);
      return response;
    } catch (error) {
      // If backend endpoint doesn't exist yet, return mock response
      console.log(chalk.yellow('⚠️  Using mock response (backend endpoint not implemented)'));
      return this.getMockResponse(request);
    }
  }

  private displayOrchestrationPlan(response: AskResponse): void {
    console.log(chalk.green('\n✨ AI Team Assembled!\n'));
    
    console.log(chalk.bold('🎯 Orchestration Plan:'));
    console.log(response.orchestrationPlan);
    console.log();
    
    console.log(chalk.bold('👥 Agents Selected:'));
    response.agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.emoji} ${agent.agentName} - ${agent.role}`);
      console.log(`   Tasks: ${agent.tasks.length}`);
    });
    
    console.log();
    console.log(chalk.gray(`⏱️  Estimated time: ${response.estimatedTime} minutes`));
  }

  async launchAgents(response: AskResponse, workDir: string): Promise<void> {
    console.log(chalk.blue('\n🚀 Launching AI agents...\n'));

    // Transform response into orchestrator-friendly structures
    const agentConfigs: AgentConfig[] = response.agents.map(agent => ({
      id: agent.agentId,
      name: agent.agentName,
      emoji: agent.emoji,
      role: agent.role,
      systemPrompt: agent.prompt,
      capabilities: [],
    }));

    // Flatten tasks and attach assigned agent name
    const tasks = response.agents.flatMap(agent =>
      agent.tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assigned_agent: agent.agentName,
        dependencies: (t as any).dependencies || agent.dependencies || [],
        estimated_complexity: t.estimatedComplexity || 'medium',
        acceptance_criteria: t.acceptanceCriteria || [],
      }))
    );

    // Build minimal repo context from extractor analysis already performed
    const repoContext = { framework: 'unknown', language: 'unknown' } as any;

    // Launch tmux cockpit with one pane per agent; orchestrator handles scheduling
    await this.cockpit.launchCockpit({
      tasks: tasks as any,
      agents: agentConfigs,
      repoContext: repoContext,
      workDir: workDir,
    });

    // Wait for completion (or user exits tmux)
    await this.cockpit.waitForCompletion().catch(() => {});
    await this.cockpit.cleanup();

    console.log(chalk.green('✅ Agents completed.'));
  }

  private getMockResponse(request: AskRequest): AskResponse {
    const { query, repositoryContext } = request;
    
    // Analyze query to determine agent types
    const agents: AgentResponse[] = [];
    
    // Always include an architect agent
    agents.push({
      agentId: 'architect-001',
      agentName: 'System Architect',
      role: 'Design and plan the implementation',
      emoji: '🏗️',
      prompt: this.generateArchitectPrompt(query, repositoryContext),
      tasks: [
        {
          id: 'arch-task-1',
          title: 'Design system architecture',
          description: 'Create high-level design for the requested feature',
          acceptanceCriteria: [
            'Define component structure',
            'Identify integration points',
            'Document data flow',
          ],
          estimatedComplexity: 'high',
        },
      ],
      dependencies: [],
    });
    
    // Add backend agent if needed
    if (query.match(/api|backend|server|database|auth/i)) {
      agents.push({
        agentId: 'backend-001',
        agentName: 'Backend Developer',
        role: 'Implement server-side logic',
        emoji: '⚙️',
        prompt: this.generateBackendPrompt(query, repositoryContext),
        tasks: [
          {
            id: 'backend-task-1',
            title: 'Implement API endpoints',
            description: 'Create necessary API routes and handlers',
            acceptanceCriteria: [
              'RESTful API design',
              'Input validation',
              'Error handling',
            ],
            estimatedComplexity: 'medium',
          },
        ],
        dependencies: ['architect-001'],
      });
    }
    
    // Add frontend agent if needed
    if (query.match(/ui|frontend|component|page|view/i)) {
      agents.push({
        agentId: 'frontend-001',
        agentName: 'Frontend Developer',
        role: 'Build user interface',
        emoji: '🎨',
        prompt: this.generateFrontendPrompt(query, repositoryContext),
        tasks: [
          {
            id: 'frontend-task-1',
            title: 'Create UI components',
            description: 'Build responsive and accessible UI',
            acceptanceCriteria: [
              'Responsive design',
              'Accessibility compliance',
              'Framework best practices',
            ],
            estimatedComplexity: 'medium',
          },
        ],
        dependencies: ['architect-001'],
      });
    }
    
    return {
      agents,
      orchestrationPlan: this.generateOrchestrationPlan(query, agents),
      estimatedTime: agents.length * 15,
      threadId: `thread-${Date.now()}`,
    };
  }

  private generateArchitectPrompt(query: string, context: ExtractedContext): string {
    return `You are a System Architect specializing in ${context.framework} applications.

Your task: ${query}

Repository Context:
- Framework: ${context.framework}
- Language: ${context.language}
- Key Dependencies: ${Object.keys(context.dependencies).slice(0, 5).join(', ')}

Relevant Files:
${context.relevantFiles.slice(0, 3).map(f => `- ${f.path}: ${f.reason}`).join('\n')}

Please design a comprehensive solution that:
1. Follows existing patterns in the codebase
2. Integrates smoothly with current architecture
3. Maintains consistency with project conventions
4. Considers scalability and maintainability`;
  }

  private generateBackendPrompt(query: string, context: ExtractedContext): string {
    return `You are a Backend Developer expert in ${context.framework} and ${context.language}.

Your task: ${query}

Repository Context:
- Framework: ${context.framework}
- Existing patterns: ${context.patterns.join(', ')}

Focus on:
1. RESTful API design
2. Data validation and security
3. Database integration
4. Error handling
5. Testing`;
  }

  private generateFrontendPrompt(query: string, context: ExtractedContext): string {
    return `You are a Frontend Developer specializing in ${context.framework}.

Your task: ${query}

Repository Context:
- UI Framework: ${context.framework}
- Design patterns: ${context.patterns.filter(p => p.includes('component')).join(', ')}

Focus on:
1. Component architecture
2. State management
3. Responsive design
4. Accessibility
5. Performance optimization`;
  }

  private generateOrchestrationPlan(query: string, agents: AgentResponse[]): string {
    const steps = [
      '1. Architect analyzes requirements and creates system design',
      ...agents.slice(1).map((agent, index) => 
        `${index + 2}. ${agent.agentName} implements ${agent.role.toLowerCase()}`
      ),
      `${agents.length + 1}. All agents review and integrate their work`,
    ];
    
    return steps.join('\n');
  }
}