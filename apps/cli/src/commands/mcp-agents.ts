/**
 * MCP Agents Command - Start and manage MCP-coordinated agents
 * 
 * Provides CLI interface for starting, monitoring, and managing
 * MCP-integrated agents as specified in DELIVERY.md workflow
 */

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { MCPAgentManager, type MCPManagerConfig } from '@graphyn/agents';
import { UserDataManager } from '@graphyn/core';

export interface MCPAgentsOptions {
  sessionId?: string;
  mcpServerUrl?: string;
  workspaceDir?: string;
  agents?: string;
  maxAgents?: number;
  autoScale?: boolean;
  daemon?: boolean;
  verbose?: boolean;
}

/**
 * Create MCP agents command
 */
export function createMCPAgentsCommand(): Command {
  const command = new Command('mcp-agents')
    .description('Start and manage MCP-coordinated agents')
    .alias('agents')
    .option('-s, --session-id <id>', 'Session ID for coordination')
    .option('-u, --mcp-server-url <url>', 'MCP server URL', 'ws://localhost:3001')
    .option('-w, --workspace-dir <dir>', 'Workspace directory', process.cwd())
    .option('-a, --agents <types>', 'Agent types to start (comma-separated)', 'figma,devops')
    .option('-m, --max-agents <num>', 'Maximum concurrent agents', '4')
    .option('--auto-scale', 'Enable automatic agent scaling')
    .option('-d, --daemon', 'Run as background daemon')
    .option('-v, --verbose', 'Verbose logging')
    .action(async (options: MCPAgentsOptions) => {
      try {
        await handleMCPAgentsCommand(options);
      } catch (error) {
        console.error(chalk.red('❌ MCP agents command failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('status')
    .description('Show status of running MCP agents')
    .option('-s, --session-id <id>', 'Session ID to check')
    .action(async (options) => {
      await showAgentsStatus(options);
    });

  command
    .command('stop')
    .description('Stop MCP agents')
    .option('-s, --session-id <id>', 'Session ID to stop')
    .option('-f, --force', 'Force stop without confirmation')
    .action(async (options) => {
      await stopAgents(options);
    });

  command
    .command('scale')
    .description('Scale agents up or down')
    .option('-s, --session-id <id>', 'Session ID')
    .option('-t, --type <type>', 'Agent type to scale')
    .option('-c, --count <num>', 'Target agent count')
    .action(async (options) => {
      await scaleAgents(options);
    });

  return command;
}

/**
 * Handle main MCP agents command
 */
async function handleMCPAgentsCommand(options: MCPAgentsOptions): Promise<void> {
  console.log(chalk.blue('🤖 Starting MCP Agent Coordination System'));

  // Generate or use provided session ID
  const sessionId = options.sessionId || `mcp-session-${uuidv4().substring(0, 8)}`;
  
  // Parse agent types
  const enabledAgentTypes = options.agents?.split(',').map(s => s.trim()) || ['figma', 'devops'];
  const maxConcurrentAgents = parseInt(String(options.maxAgents || '4'));

  console.log(chalk.gray(`Session ID: ${sessionId}`));
  console.log(chalk.gray(`Workspace: ${options.workspaceDir}`));
  console.log(chalk.gray(`MCP Server: ${options.mcpServerUrl}`));
  console.log(chalk.gray(`Agent Types: ${enabledAgentTypes.join(', ')}`));

  // Create manager configuration
  const config: MCPManagerConfig = {
    sessionId,
    mcpServerUrl: options.mcpServerUrl,
    workspaceDir: options.workspaceDir,
    enabledAgentTypes,
    maxConcurrentAgents
  };

  // Initialize UserDataManager for session tracking
  const userDataManager = new UserDataManager();
  
  try {
    // Create and start agent manager
    console.log(chalk.blue('📡 Initializing MCP Agent Manager...'));
    const agentManager = new MCPAgentManager(config);

    // Start agents
    console.log(chalk.blue('🚀 Starting agents...'));
    await agentManager.start();

    // Store session info (using session path for now)
    const sessionPath = await userDataManager.getSessionPath(sessionId);
    console.log(chalk.gray(`Session data path: ${sessionPath}`));

    const status = agentManager.getStatus();
    console.log(chalk.green('✅ MCP Agent Manager started successfully!'));
    console.log(chalk.gray(`Total agents: ${status.totalAgents}`));
    console.log(chalk.gray(`Agent types: ${JSON.stringify(status.agentsByType)}`));

    if (options.daemon) {
      // Run as daemon
      console.log(chalk.blue('🔄 Running in daemon mode...'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
      
      // Set up graceful shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n🛑 Shutting down MCP agents...'));
        await agentManager.stop();
        console.log(chalk.green('✅ MCP agents stopped'));
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep process alive and show periodic status
      const showStatus = async () => {
        if (options.verbose) {
          const currentStatus = agentManager.getStatus();
          const health = await agentManager.healthCheck();
          
          console.log(chalk.blue(`[${new Date().toISOString()}] Agent Status:`));
          console.log(chalk.gray(`  Total: ${currentStatus.totalAgents}`));
          console.log(chalk.gray(`  By Status: ${JSON.stringify(currentStatus.agentsByStatus)}`));
          console.log(chalk.gray(`  Healthy: ${health.healthy ? '✅' : '❌'}`));
          
          if (!health.healthy) {
            console.log(chalk.yellow(`  Issues: ${health.issues.join(', ')}`));
          }
        }
      };

      // Show status every 30 seconds in verbose mode
      if (options.verbose) {
        setInterval(showStatus, 30000);
      }

      // Keep process alive
      return new Promise(() => {}); // Never resolves, keeps process running

    } else {
      // Interactive mode
      await runInteractiveMode(agentManager, sessionId);
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to start MCP agents:'), error);
    throw error;
  }
}

/**
 * Run interactive mode for agent management
 */
async function runInteractiveMode(agentManager: MCPAgentManager, sessionId: string): Promise<void> {
  console.log(chalk.blue('🎮 Entering interactive mode'));
  console.log(chalk.gray('Available commands: status, health, scale, stop, quit'));

  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📊 Show status', value: 'status' },
            { name: '🔍 Health check', value: 'health' },
            { name: '📈 Scale agents', value: 'scale' },
            { name: '🛑 Stop agents', value: 'stop' },
            { name: '❌ Quit', value: 'quit' }
          ]
        }
      ]);

      switch (action) {
        case 'status':
          await showManagerStatus(agentManager);
          break;
        
        case 'health':
          await showHealthCheck(agentManager);
          break;
          
        case 'scale':
          await interactiveScale(agentManager);
          break;
          
        case 'stop':
          await agentManager.stop();
          console.log(chalk.green('✅ Agents stopped'));
          return;
          
        case 'quit':
          return;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
    }
  }
}

/**
 * Show agent manager status
 */
async function showManagerStatus(agentManager: MCPAgentManager): Promise<void> {
  const status = agentManager.getStatus();
  const agents = agentManager.getAllAgents();

  console.log(chalk.blue('\n📊 Agent Manager Status:'));
  console.log(chalk.gray(`  Session: ${status.sessionId}`));
  console.log(chalk.gray(`  Started: ${status.isStarted ? '✅' : '❌'}`));
  console.log(chalk.gray(`  Total Agents: ${status.totalAgents}`));
  
  console.log(chalk.blue('\n📈 Agents by Type:'));
  for (const [type, count] of Object.entries(status.agentsByType)) {
    console.log(chalk.gray(`  ${type}: ${count}`));
  }

  console.log(chalk.blue('\n🔄 Agents by Status:'));
  for (const [statusType, count] of Object.entries(status.agentsByStatus)) {
    const emoji = statusType === 'idle' ? '💤' : statusType === 'busy' ? '⚡' : statusType === 'error' ? '❌' : '❓';
    console.log(chalk.gray(`  ${emoji} ${statusType}: ${count}`));
  }

  console.log(chalk.blue('\n👥 Individual Agents:'));
  agents.forEach(agent => {
    const statusEmoji = agent.status === 'idle' ? '💤' : agent.status === 'busy' ? '⚡' : '❌';
    console.log(chalk.gray(`  ${statusEmoji} ${agent.id} (${agent.type}) - ${agent.status}${agent.currentTask ? ` [${agent.currentTask}]` : ''}`));
  });
}

/**
 * Show health check results
 */
async function showHealthCheck(agentManager: MCPAgentManager): Promise<void> {
  console.log(chalk.blue('🔍 Running health check...'));
  
  const health = await agentManager.healthCheck();
  
  console.log(chalk.blue(`\n🏥 Overall Health: ${health.healthy ? chalk.green('✅ Healthy') : chalk.red('❌ Issues Detected')}`));
  
  if (!health.healthy) {
    console.log(chalk.red('\n⚠️ Issues:'));
    health.issues.forEach(issue => {
      console.log(chalk.red(`  • ${issue}`));
    });
  }

  console.log(chalk.blue('\n👤 Agent Health:'));
  for (const [agentId, agentHealth] of Object.entries(health.agentHealth)) {
    const healthEmoji = agentHealth.healthy ? '✅' : '❌';
    console.log(chalk.gray(`  ${healthEmoji} ${agentId}: ${agentHealth.healthy ? 'Healthy' : agentHealth.issues.join(', ')}`));
  }
}

/**
 * Interactive agent scaling
 */
async function interactiveScale(agentManager: MCPAgentManager): Promise<void> {
  const status = agentManager.getStatus();
  const agentTypes = Object.keys(status.agentsByType);

  if (agentTypes.length === 0) {
    console.log(chalk.yellow('⚠️ No agent types available for scaling'));
    return;
  }

  const { agentType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentType',
      message: 'Which agent type to scale?',
      choices: agentTypes.map(type => ({
        name: `${type} (current: ${status.agentsByType[type] || 0})`,
        value: type
      }))
    }
  ]);

  const currentCount = status.agentsByType[agentType] || 0;
  
  const { targetCount } = await inquirer.prompt([
    {
      type: 'number',
      name: 'targetCount',
      message: `Target count for ${agentType} agents:`,
      default: currentCount,
      validate: (value) => (value !== undefined && value >= 0) || 'Count must be non-negative'
    }
  ]);

  console.log(chalk.blue(`📈 Scaling ${agentType} from ${currentCount} to ${targetCount}...`));
  
  try {
    await agentManager.scaleAgents(agentType, targetCount);
    console.log(chalk.green(`✅ Successfully scaled ${agentType} agents to ${targetCount}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to scale agents: ${error}`));
  }
}

/**
 * Show agents status (subcommand)
 */
async function showAgentsStatus(options: { sessionId?: string }): Promise<void> {
  console.log(chalk.blue('📊 Agent Status'));
  
  if (options.sessionId) {
    const userDataManager = new UserDataManager();
    try {
      const sessionPath = await userDataManager.getSessionPath(options.sessionId);
      console.log(chalk.gray(`Session: ${options.sessionId}`));
      console.log(chalk.gray(`Session Path: ${sessionPath}`));
      console.log(chalk.yellow('⚠️ Session data retrieval to be implemented'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to get session status: ${error}`));
    }
  } else {
    console.log(chalk.yellow('⚠️ No session ID provided. Use --session-id to check specific session'));
  }
}

/**
 * Stop agents (subcommand)
 */
async function stopAgents(options: { sessionId?: string; force?: boolean }): Promise<void> {
  if (!options.sessionId) {
    console.error(chalk.red('❌ Session ID required to stop agents'));
    return;
  }

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Stop MCP agents for session ${options.sessionId}?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Operation cancelled'));
      return;
    }
  }

  console.log(chalk.blue(`🛑 Stopping MCP agents for session: ${options.sessionId}`));
  console.log(chalk.yellow('⚠️ This command requires the agent manager to implement remote stop capability'));
  console.log(chalk.gray('For now, stop the agents using the interactive mode or by killing the process'));
}

/**
 * Scale agents (subcommand)
 */
async function scaleAgents(options: { sessionId?: string; type?: string; count?: string }): Promise<void> {
  if (!options.sessionId || !options.type || !options.count) {
    console.error(chalk.red('❌ Session ID, agent type, and count are required'));
    return;
  }

  const targetCount = parseInt(options.count);
  if (isNaN(targetCount) || targetCount < 0) {
    console.error(chalk.red('❌ Invalid count. Must be a non-negative number'));
    return;
  }

  console.log(chalk.blue(`📈 Scaling ${options.type} agents to ${targetCount} for session: ${options.sessionId}`));
  console.log(chalk.yellow('⚠️ This command requires the agent manager to implement remote scaling'));
  console.log(chalk.gray('For now, use the interactive mode to scale agents'));
}

export default createMCPAgentsCommand;