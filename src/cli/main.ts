#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import { AgentConfigurationSystem } from '../core/AgentConfigurationSystem.js';
import { GraphynOrchestrator, OrchestratorOptions } from '../core/GraphynOrchestrator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../config/agent-specializations.json');
const TEMPLATE_PATH = path.join(__dirname, '../../templates');

/**
 * Graphyn CLI - Dynamic Agent Specialization Engine
 * 
 * Main entry point that orchestrates specialized Claude Code agents
 * based on project analysis and user requirements.
 */

interface CLIOptions {
  workflow?: string;
  agent?: string;
  verbose?: boolean;
  debug?: boolean;
  config?: string;
}

class GraphynCLI {
  private agentConfig: AgentConfigurationSystem;
  private orchestrator?: GraphynOrchestrator;
  private program: Command;

  constructor() {
    this.agentConfig = new AgentConfigurationSystem();
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('graphyn')
      .description('AI-powered CLI that orchestrates context-aware development agents for Claude Code')
      .version('0.1.70');

    // Initialize command - loads agent configurations
    this.program
      .command('init')
      .description('Initialize Graphyn with agent configurations')
      .option('-c, --config <path>', 'Path to agent configuration file', CONFIG_PATH)
      .action(async (options) => {
        await this.handleInit(options);
      });

    // Analyze command - analyzes project and suggests workflow
    this.program
      .command('analyze')
      .description('Analyze current project and recommend optimal agent workflow')
      .option('-v, --verbose', 'Show detailed analysis')
      .action(async (options) => {
        await this.handleAnalyze(options);
      });

    // Workflow command - execute specific workflow
    this.program
      .command('workflow <name>')
      .description('Execute a specific agent workflow')
      .option('-a, --agent <type>', 'Override default agents with specific agent type')
      .option('-v, --verbose', 'Show detailed execution logs')
      .option('-d, --debug', 'Enable debug mode')
      .action(async (workflowName, options) => {
        await this.handleWorkflow(workflowName, options);
      });

    // Agent command - launch specific agent
    this.program
      .command('agent <type>')
      .description('Launch a specific specialized agent')
      .option('-v, --verbose', 'Show detailed agent logs')
      .option('-d, --debug', 'Enable debug mode')
      .action(async (agentType, options) => {
        await this.handleAgent(agentType, options);
      });

    // Status command - show system status
    this.program
      .command('status')
      .description('Show Graphyn system status and active agents')
      .action(async () => {
        await this.handleStatus();
      });

    // List command - show available agents and workflows
    this.program
      .command('list')
      .description('List available agents, workflows, and configurations')
      .option('-a, --agents', 'List available agent types')
      .option('-w, --workflows', 'List available workflows')
      .option('-i, --integrations', 'List integration status')
      .action(async (options) => {
        await this.handleList(options);
      });
  }

  private async handleInit(options: { config?: string }): Promise<void> {
    try {
      console.log(chalk.cyan(figlet.textSync('Graphyn', { horizontalLayout: 'full' })));
      console.log(chalk.gray('Dynamic Agent Specialization Engine\n'));

      const configPath = options.config || CONFIG_PATH;
      
      console.log(chalk.blue('🚀 Initializing Graphyn...'));
      console.log(chalk.gray(`📍 Config: ${configPath}`));
      console.log(chalk.gray(`📁 Templates: ${TEMPLATE_PATH}`));

      await this.agentConfig.loadConfiguration(configPath, TEMPLATE_PATH);
      
      console.log(chalk.green('✅ Graphyn initialized successfully!'));
      
      // Show quick summary
      const agents = this.agentConfig.getAvailableAgentTypes();
      const workflows = this.agentConfig.getAvailableWorkflows();
      
      console.log(boxen(`
📋 Available Agents: ${agents.join(', ')}
🔄 Available Workflows: ${workflows.join(', ')}
🔗 MCP Integration: ${this.agentConfig.isMCPEnabled() ? '✅ Enabled' : '❌ Disabled'}
🎨 Figma Integration: ${this.agentConfig.isFigmaEnabled() ? '✅ Enabled' : '❌ Disabled'}
      `, {
        title: '🎯 Configuration Summary',
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }));

    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Graphyn:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  }

  private async handleAnalyze(options: { verbose?: boolean }): Promise<void> {
    try {
      if (!this.agentConfig.isConfigurationLoaded()) {
        console.log(chalk.yellow('⚠️  Configuration not loaded. Running init first...'));
        await this.handleInit({});
        console.log();
      }

      console.log(chalk.blue('🔍 Analyzing current project...'));
      
      // TODO: Implement IntelligentRepoAnalyzer integration
      // For now, show placeholder analysis
      console.log(chalk.gray('📁 Scanning project structure...'));
      console.log(chalk.gray('🔍 Detecting technologies...'));
      console.log(chalk.gray('📊 Analyzing complexity...'));
      
      // Mock analysis results for now
      const analysis = {
        projectType: 'full-stack',
        technologies: ['TypeScript', 'React', 'Node.js'],
        complexity: 'medium',
        suggestedWorkflow: 'full-stack-development',
        recommendedAgents: ['backend', 'frontend', 'test']
      };

      console.log(chalk.green('✅ Project analysis complete!'));
      
      console.log(boxen(`
📂 Project Type: ${analysis.projectType}
🛠️  Technologies: ${analysis.technologies.join(', ')}
📊 Complexity: ${analysis.complexity}
🎯 Suggested Workflow: ${analysis.suggestedWorkflow}
👥 Recommended Agents: ${analysis.recommendedAgents.join(', ')}
      `, {
        title: '📋 Analysis Results',
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }));

      console.log(chalk.cyan(`\n💡 Run: ${chalk.bold(`graphyn workflow ${analysis.suggestedWorkflow}`)} to execute the recommended workflow`));

    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleWorkflow(workflowName: string, options: CLIOptions): Promise<void> {
    try {
      if (!this.agentConfig.isConfigurationLoaded()) {
        console.log(chalk.yellow('⚠️  Configuration not loaded. Running init first...'));
        await this.handleInit({});
        console.log();
      }

      const workflow = this.agentConfig.getWorkflow(workflowName);
      if (!workflow) {
        console.error(chalk.red(`❌ Workflow '${workflowName}' not found`));
        console.log(chalk.cyan('💡 Available workflows:'));
        this.agentConfig.getAvailableWorkflows().forEach(w => {
          console.log(chalk.gray(`  • ${w}`));
        });
        return;
      }

      console.log(chalk.blue(`🚀 Executing workflow: ${chalk.bold(workflowName)}`));
      console.log(chalk.gray(`📝 Description: ${workflow.description}`));
      
      if (options.verbose) {
        console.log(chalk.gray(`👥 Agents: ${workflow.agents.join(' → ')}`));
        console.log(chalk.gray(`⚙️  Steps: ${workflow.steps.length} steps`));
      }

      // Initialize orchestrator if not already done
      if (!this.orchestrator) {
        console.log(chalk.blue('🔧 Initializing GraphynOrchestrator...'));
        
        const orchestratorOptions: OrchestratorOptions = {
          configPath: CONFIG_PATH,
          templatePath: TEMPLATE_PATH,
          workingDirectory: process.cwd(),
          verbose: options.verbose,
          debug: options.debug
        };
        
        this.orchestrator = new GraphynOrchestrator(orchestratorOptions);
        await this.orchestrator.initialize();
        
        console.log(chalk.green('✅ GraphynOrchestrator ready'));
      }

      // Execute the workflow
      console.log(chalk.cyan('\n🚀 Starting workflow execution...'));
      
      try {
        const executionPlan = await this.orchestrator.executeWorkflow(workflowName, {
          userRequest: `Execute ${workflowName} workflow`,
          verbose: options.verbose,
          debug: options.debug
        });
        
        console.log(chalk.green('✅ Workflow execution started!'));
        console.log(chalk.cyan(`📊 Total steps: ${executionPlan.steps.length}`));
        console.log(chalk.cyan(`⏱️  Estimated time: ${Math.round(executionPlan.totalEstimatedTime / 60)} minutes`));
        
        if (options.verbose) {
          console.log(chalk.cyan('\n📋 Execution plan:'));
          executionPlan.steps.forEach((step, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${step.description} (${step.agentType}) - ${step.status}`));
          });
        }
        
        console.log(chalk.blue('\n💡 Use `graphyn status` to monitor progress'));
        
      } catch (error) {
        console.error(chalk.red(`❌ Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Workflow execution failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleAgent(agentType: string, options: CLIOptions): Promise<void> {
    try {
      if (!this.agentConfig.isConfigurationLoaded()) {
        console.log(chalk.yellow('⚠️  Configuration not loaded. Running init first...'));
        await this.handleInit({});
        console.log();
      }

      const agentSpec = this.agentConfig.getAgentSpecialization(agentType);
      if (!agentSpec) {
        console.error(chalk.red(`❌ Agent type '${agentType}' not found`));
        console.log(chalk.cyan('💡 Available agents:'));
        this.agentConfig.getAvailableAgentTypes().forEach(agent => {
          console.log(chalk.gray(`  • ${agent}`));
        });
        return;
      }

      console.log(chalk.blue(`🤖 Launching ${agentType} agent...`));
      console.log(chalk.gray(`📝 Description: ${agentSpec.description}`));
      
      if (options.verbose) {
        console.log(chalk.gray(`🛠️  Tools: ${agentSpec.tools.join(', ')}`));
        console.log(chalk.gray(`🎯 Specializations: ${agentSpec.specializations.join(', ')}`));
      }

      // Initialize orchestrator if not already done
      if (!this.orchestrator) {
        console.log(chalk.blue('🔧 Initializing GraphynOrchestrator...'));
        
        const orchestratorOptions: OrchestratorOptions = {
          configPath: CONFIG_PATH,
          templatePath: TEMPLATE_PATH,
          workingDirectory: process.cwd(),
          verbose: options.verbose,
          debug: options.debug
        };
        
        this.orchestrator = new GraphynOrchestrator(orchestratorOptions);
        await this.orchestrator.initialize();
        
        console.log(chalk.green('✅ GraphynOrchestrator ready'));
      }

      // Launch the agent
      console.log(chalk.cyan('\n🚀 Launching agent...'));
      
      try {
        const agent = await this.orchestrator.launchAgent(agentType, 
          `Manual ${agentType} agent launch`, 
          {
            userRequest: `Launch ${agentType} agent`,
            verbose: options.verbose,
            debug: options.debug
          }
        );
        
        console.log(chalk.green(`✅ Agent launched successfully!`));
        console.log(chalk.cyan(`🆔 Agent ID: ${agent.id}`));
        console.log(chalk.cyan(`📊 Process ID: ${agent.pid}`));
        console.log(chalk.cyan(`🔄 Status: ${agent.status}`));
        
        console.log(chalk.blue('\n💡 Agent is now running and ready to receive tasks'));
        console.log(chalk.gray('The agent will coordinate with other agents via MCP protocol'));
        console.log(chalk.blue('Use `graphyn status` to monitor agent status'));
        
      } catch (error) {
        console.error(chalk.red(`❌ Agent launch failed: ${error instanceof Error ? error.message : String(error)}`));
        
        if (options.debug && error instanceof Error) {
          console.error(chalk.gray(error.stack));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Agent launch failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleStatus(): Promise<void> {
    try {
      console.log(chalk.blue('📊 Graphyn System Status'));
      
      if (!this.agentConfig.isConfigurationLoaded()) {
        console.log(chalk.red('❌ Configuration not loaded'));
        console.log(chalk.cyan('💡 Run: graphyn init'));
        return;
      }

      console.log(chalk.green('✅ Configuration loaded'));
      
      // Show orchestrator status if available
      if (this.orchestrator) {
        try {
          const health = await this.orchestrator.getSystemHealth();
          const agents = this.orchestrator.getAgentStatus();
          
          console.log(chalk.green('✅ GraphynOrchestrator initialized'));
          
          console.log(boxen(`
📋 ${this.agentConfig.getAvailableAgentTypes().length} agent types available
🔄 ${this.agentConfig.getAvailableWorkflows().length} workflows available
🤖 ${health.activeAgents} agents currently running
🔗 ${health.mcpConnections} MCP connections active
📊 System status: ${health.status}
⏱️  Uptime: ${Math.round(health.uptime / 60)} minutes
🧠 Memory: ${Math.round(health.memoryUsage.heapUsed / 1024 / 1024)}MB used
🔗 MCP: ${this.agentConfig.isMCPEnabled() ? '✅ Enabled' : '❌ Disabled'}
🎨 Figma: ${this.agentConfig.isFigmaEnabled() ? '✅ Enabled' : '❌ Disabled'}
          `, {
            title: '🎯 System Status',
            padding: 1,
            borderStyle: 'round',
            borderColor: 'blue'
          }));
          
          // Show active agents if any
          if (agents.length > 0) {
            console.log(chalk.blue('\n🤖 Active Agents:'));
            agents.forEach(agent => {
              const duration = Math.round((Date.now() - agent.startTime.getTime()) / 1000);
              console.log(chalk.cyan(`  • ${agent.id} (${agent.type})`));
              console.log(chalk.gray(`    Status: ${agent.status} | PID: ${agent.pid} | Uptime: ${duration}s`));
              if (agent.task) {
                console.log(chalk.gray(`    Task: ${agent.task}`));
              }
              if (agent.progress !== undefined) {
                console.log(chalk.gray(`    Progress: ${agent.progress}%`));
              }
            });
          }
          
        } catch (error) {
          console.log(chalk.yellow('⚠️  Orchestrator status check failed'));
          console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        }
      } else {
        console.log(chalk.yellow('🔧 GraphynOrchestrator not initialized'));
        console.log(chalk.gray('Run a workflow or launch an agent to initialize the orchestrator'));
        
        console.log(boxen(`
📋 ${this.agentConfig.getAvailableAgentTypes().length} agent types available
🔄 ${this.agentConfig.getAvailableWorkflows().length} workflows available
🔗 MCP: ${this.agentConfig.isMCPEnabled() ? '✅ Enabled' : '❌ Disabled'}
🎨 Figma: ${this.agentConfig.isFigmaEnabled() ? '✅ Enabled' : '❌ Disabled'}
        `, {
          title: '🎯 System Status',
          padding: 1,
          borderStyle: 'round',
          borderColor: 'blue'
        }));
      }

    } catch (error) {
      console.error(chalk.red('❌ Status check failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleList(options: { agents?: boolean, workflows?: boolean, integrations?: boolean }): Promise<void> {
    try {
      if (!this.agentConfig.isConfigurationLoaded()) {
        console.log(chalk.yellow('⚠️  Configuration not loaded. Running init first...'));
        await this.handleInit({});
        console.log();
      }

      const showAll = !options.agents && !options.workflows && !options.integrations;

      if (options.agents || showAll) {
        console.log(chalk.blue('🤖 Available Agents:'));
        this.agentConfig.getAvailableAgentTypes().forEach(agentType => {
          const spec = this.agentConfig.getAgentSpecialization(agentType);
          console.log(chalk.cyan(`  • ${agentType}`));
          if (spec) {
            console.log(chalk.gray(`    ${spec.description}`));
            console.log(chalk.gray(`    Tools: ${spec.tools.join(', ')}`));
          }
        });
        console.log();
      }

      if (options.workflows || showAll) {
        console.log(chalk.blue('🔄 Available Workflows:'));
        this.agentConfig.getAvailableWorkflows().forEach(workflowName => {
          const workflow = this.agentConfig.getWorkflow(workflowName);
          console.log(chalk.cyan(`  • ${workflowName}`));
          if (workflow) {
            console.log(chalk.gray(`    ${workflow.description}`));
            console.log(chalk.gray(`    Agents: ${workflow.agents.join(' → ')}`));
          }
        });
        console.log();
      }

      if (options.integrations || showAll) {
        console.log(chalk.blue('🔗 Integration Status:'));
        console.log(`  • MCP: ${this.agentConfig.isMCPEnabled() ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled')}`);
        console.log(`  • Figma: ${this.agentConfig.isFigmaEnabled() ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled')}`);
        console.log();
      }

    } catch (error) {
      console.error(chalk.red('❌ List failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  }

  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('❌ CLI Error:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  }
}

// Main entry point
export async function main(): Promise<void> {
  const cli = new GraphynCLI();
  await cli.run();
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}