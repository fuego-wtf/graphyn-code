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
    const analyzer = new RepositoryAnalyzerService();
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
    const response = await this.apiClient.post<AskResponse>('/api/ask', request);
    return response;
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
    // This will block until the user exits the tmux session
    await this.cockpit.launchCockpit({
      tasks: tasks as any,
      agents: agentConfigs,
      repoContext: repoContext,
      workDir: workDir,
    });

    // Clean up after tmux session ends
    await this.cockpit.cleanup();

    console.log(chalk.green('\n✅ Cockpit session ended.'));
  }
}