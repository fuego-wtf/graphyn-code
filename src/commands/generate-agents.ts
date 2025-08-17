import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AgentFileGenerator } from '../services/agent-file-generator.js';
import { GraphynAPIClient } from '../api/client.js';
import { RepositoryContextExtractor } from '../services/repository-context-extractor.js';
import type { AgentConfig } from '../services/agent-file-generator.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface GenerateAgentsOptions {
  query?: string;
  clean?: boolean;
  interactive?: boolean;
}

export class GenerateAgentsCommand {
  private generator: AgentFileGenerator;
  private apiClient: GraphynAPIClient;
  private contextExtractor: RepositoryContextExtractor;

  constructor() {
    this.generator = new AgentFileGenerator();
    this.apiClient = new GraphynAPIClient();
    this.contextExtractor = new RepositoryContextExtractor();
  }

  async run(options: GenerateAgentsOptions = {}): Promise<void> {
    console.log(colors.bold('\n🤖 Generating Agent Files\n'));

    try {
      // Step 1: Clean old agents if requested
      if (options.clean) {
        const spinner = ora('Cleaning old agent files...').start();
        await this.generator.cleanupOldAgents();
        spinner.succeed('Old agent files cleaned');
      }

      // Step 2: Get the query
      let query = options.query;
      if (!query && options.interactive !== false) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'What would you like to build?',
            validate: (input) => input.trim().length > 0 || 'Please enter a query'
          }
        ]);
        query = response.query;
      }

      if (!query) {
        throw new Error('Query is required to generate agents');
      }

      // Step 3: Extract repository context
      const contextSpinner = ora('Analyzing repository context...').start();
      const repoContext = await this.contextExtractor.extractContext(query);
      contextSpinner.succeed('Repository context extracted');

      // Step 4: Call backend /ask endpoint
      const askSpinner = ora('Getting agent configurations from backend...').start();
      
      try {
        const response = await this.apiClient.ask({
          query,
          context: {
            repository: repoContext,
            workingDirectory: process.cwd(),
            gitBranch: await this.getGitBranch(),
            frameworks: repoContext.relevantFiles
              .map(f => this.detectFramework(f.path))
              .filter(Boolean)
          },
          mode: 'multi-agent'
        });

        askSpinner.succeed('Agent configurations received');

        // Step 5: Transform response to AgentConfig format
        const agents = this.transformResponseToAgents(response);

        if (agents.length === 0) {
          console.log(colors.warning('\n⚠️  No agents were configured by the backend'));
          return;
        }

        // Step 6: Allow user to review and modify agents
        if (options.interactive !== false) {
          const confirmed = await this.reviewAgents(agents);
          if (!confirmed) {
            console.log(colors.info('\nAgent generation cancelled'));
            return;
          }
        }

        // Step 7: Generate agent files
        const generateSpinner = ora('Generating agent files...').start();
        
        const userInstructions = await this.getUserInstructions(options.interactive);
        
        const files = await this.generator.generateAgentFiles(agents, {
          userInstructions,
          repositoryContext: {
            name: repoContext.repoName,
            frameworks: this.extractFrameworks(repoContext),
            language: this.detectPrimaryLanguage(repoContext),
            database: this.detectDatabase(repoContext)
          }
        });

        generateSpinner.succeed(`Generated ${files.length} agent files`);

        // Step 8: Show generated files
        console.log(colors.success('\n✅ Agent files generated successfully!\n'));
        console.log('Generated files:');
        files.forEach(file => {
          const relativePath = file.replace(process.cwd() + '/', '');
          console.log(colors.muted(`  • ${relativePath}`));
        });

        // Step 9: Show next steps
        this.showNextSteps();

      } catch (error) {
        askSpinner.fail('Failed to get agent configurations');
        
        // If backend fails, offer to generate example agents
        if (options.interactive !== false) {
          const useExample = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'useExample',
              message: 'Would you like to generate example agents instead?',
              default: true
            }
          ]);

          if (useExample.useExample) {
            await this.generateExampleAgents(query);
          }
        } else {
          throw error;
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(colors.error(`\n❌ Failed to generate agents: ${errorMessage}`));
      process.exit(1);
    }
  }

  /**
   * Transform backend response to AgentConfig format
   */
  private transformResponseToAgents(response: any): AgentConfig[] {
    // Handle different response formats from backend
    if (response.agents) {
      return response.agents;
    }

    if (response.tasks && Array.isArray(response.tasks)) {
      // Group tasks by agent
      const agentMap = new Map<string, AgentConfig>();
      
      response.tasks.forEach((task: any) => {
        const agentId = task.agent || 'developer';
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            id: agentId,
            name: this.getAgentName(agentId),
            role: this.getAgentRole(agentId),
            tasks: [],
            dependencies: task.deps || [],
            mcpTools: task.mcpTools || ['filesystem', 'graphyn-mcp']
          });
        }

        const agent = agentMap.get(agentId)!;
        agent.tasks.push({
          id: task.id,
          title: task.title || task.name,
          description: task.description || '',
          successCriteria: task.successCriteria || [],
          dependencies: task.deps
        });
      });

      return Array.from(agentMap.values());
    }

    // Fallback: create a single developer agent
    return [{
      id: 'developer',
      name: 'Full Stack Developer',
      role: 'a full stack developer',
      tasks: [{
        id: 'main',
        title: 'Implement requested feature',
        description: response.suggestion || response.message || '',
        successCriteria: []
      }],
      mcpTools: ['filesystem', 'github', 'graphyn-mcp']
    }];
  }

  /**
   * Get agent name from ID
   */
  private getAgentName(agentId: string): string {
    const names: Record<string, string> = {
      'architect': 'System Architect',
      'backend': 'Backend Developer',
      'frontend': 'Frontend Developer',
      'backend-developer': 'Backend Developer',
      'frontend-developer': 'Frontend Developer',
      'fullstack': 'Full Stack Developer',
      'devops': 'DevOps Engineer',
      'tester': 'QA Engineer',
      'designer': 'UI/UX Designer'
    };
    return names[agentId] || 'Developer';
  }

  /**
   * Get agent role description
   */
  private getAgentRole(agentId: string): string {
    const roles: Record<string, string> = {
      'architect': 'an expert system architect',
      'backend': 'a senior backend developer',
      'frontend': 'a senior frontend developer',
      'backend-developer': 'a senior backend developer',
      'frontend-developer': 'a senior frontend developer',
      'fullstack': 'a full stack developer',
      'devops': 'a DevOps engineer',
      'tester': 'a QA engineer',
      'designer': 'a UI/UX designer'
    };
    return roles[agentId] || 'a software developer';
  }

  /**
   * Allow user to review agents before generation
   */
  private async reviewAgents(agents: AgentConfig[]): Promise<boolean> {
    console.log(colors.highlight('\n📋 Agent Configuration:\n'));
    
    agents.forEach(agent => {
      console.log(colors.bold(`${agent.name} (${agent.id})`));
      console.log(colors.muted(`  Role: ${agent.role}`));
      console.log(colors.muted('  Tasks:'));
      agent.tasks.forEach(task => {
        console.log(colors.muted(`    • ${task.title}`));
      });
      if (agent.dependencies && agent.dependencies.length > 0) {
        console.log(colors.muted(`  Dependencies: ${agent.dependencies.join(', ')}`));
      }
      console.log();
    });

    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Generate these agent files?',
        default: true
      }
    ]);

    return response.confirm;
  }

  /**
   * Get additional instructions from user
   */
  private async getUserInstructions(interactive?: boolean): Promise<string | undefined> {
    if (interactive === false) {
      return undefined;
    }

    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'instructions',
        message: 'Any additional instructions for the agents? (optional)',
        default: ''
      }
    ]);

    return response.instructions || undefined;
  }

  /**
   * Generate example agents when backend is unavailable
   */
  private async generateExampleAgents(query: string): Promise<void> {
    console.log(colors.info('\n📝 Generating example agents...\n'));

    const exampleAgents: AgentConfig[] = [
      {
        id: 'architect',
        name: 'System Architect',
        role: 'an expert system architect',
        tasks: [
          {
            id: 'design',
            title: 'Design system architecture',
            description: `Design the architecture for: ${query}`,
            successCriteria: [
              'Create system design document',
              'Define component boundaries',
              'Specify data flow'
            ]
          }
        ],
        mcpTools: ['filesystem', 'graphyn-mcp']
      },
      {
        id: 'developer',
        name: 'Full Stack Developer',
        role: 'a full stack developer',
        tasks: [
          {
            id: 'implement',
            title: 'Implement the feature',
            description: `Implement: ${query}`,
            successCriteria: [
              'Code is working',
              'Tests are passing',
              'Documentation updated'
            ]
          }
        ],
        dependencies: ['architect'],
        mcpTools: ['filesystem', 'github', 'graphyn-mcp']
      }
    ];

    const files = await this.generator.generateAgentFiles(exampleAgents);
    
    console.log(colors.success('✅ Example agent files generated!'));
    files.forEach(file => {
      const relativePath = file.replace(process.cwd() + '/', '');
      console.log(colors.muted(`  • ${relativePath}`));
    });
  }

  /**
   * Show next steps after generation
   */
  private showNextSteps(): void {
    console.log(colors.highlight('\n📚 Next Steps:\n'));
    console.log('1. Review the generated agent files in .claude/agents/');
    console.log('2. Run ' + colors.bold('graphyn mcp config') + ' to configure MCP servers');
    console.log('3. Launch the orchestration with ' + colors.bold('graphyn orchestrate'));
    console.log('4. Agents will work in parallel via TMUX');
    console.log();
  }

  // Helper methods
  private async getGitBranch(): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch {
      return 'main';
    }
  }

  private detectFramework(filePath: string): string | null {
    if (filePath.includes('next.config')) return 'Next.js';
    if (filePath.includes('package.json')) return 'Node.js';
    if (filePath.includes('encore.app')) return 'Encore';
    if (filePath.includes('requirements.txt')) return 'Python';
    return null;
  }

  private extractFrameworks(context: any): string[] {
    const frameworks = new Set<string>();
    
    context.relevantFiles?.forEach((file: any) => {
      const framework = this.detectFramework(file.path);
      if (framework) frameworks.add(framework);
    });

    return Array.from(frameworks);
  }

  private detectPrimaryLanguage(context: any): string {
    const extensions = context.relevantFiles?.map((f: any) => 
      f.path.split('.').pop()
    );
    
    if (extensions?.includes('ts') || extensions?.includes('tsx')) return 'TypeScript';
    if (extensions?.includes('js') || extensions?.includes('jsx')) return 'JavaScript';
    if (extensions?.includes('py')) return 'Python';
    if (extensions?.includes('go')) return 'Go';
    if (extensions?.includes('rs')) return 'Rust';
    
    return 'TypeScript';
  }

  private detectDatabase(context: any): string | undefined {
    const files = context.relevantFiles?.map((f: any) => f.path) || [];
    
    if (files.some((f: string) => f.includes('prisma'))) return 'PostgreSQL (Prisma)';
    if (files.some((f: string) => f.includes('typeorm'))) return 'PostgreSQL (TypeORM)';
    if (files.some((f: string) => f.includes('mongoose'))) return 'MongoDB';
    if (files.some((f: string) => f.includes('postgres'))) return 'PostgreSQL';
    
    return undefined;
  }
}

// CLI export
export async function generateAgents(options: GenerateAgentsOptions = {}) {
  const command = new GenerateAgentsCommand();
  await command.run(options);
}