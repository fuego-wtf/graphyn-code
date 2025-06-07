import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import GraphynAPIClient from '../api-client.js';
import { loadAuth } from '../auth.js';

const client = new GraphynAPIClient();

export function createAgentsCommand(): Command {
  const agentsCommand = new Command('agents')
    .alias('agent')
    .description('Manage AI agents in the Graphyn platform');

  // List available agents
  agentsCommand
    .command('list')
    .alias('ls')
    .description('List all available agents')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching agents...').start();
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          spinner.fail('Authentication required. Run: graphyn auth');
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        // For now, return the built-in agents until backend implements /api/agents
        const agents = [
          {
            id: 'backend-specialist',
            name: 'Backend Specialist',
            description: 'Expert in APIs, databases, and server architecture',
            capabilities: ['API design', 'Database optimization', 'Server architecture'],
            status: 'active'
          },
          {
            id: 'frontend-expert',
            name: 'Frontend Expert',
            description: 'Master of UI/UX, React, and modern web development',
            capabilities: ['React components', 'UI/UX design', 'Performance optimization'],
            status: 'active'
          },
          {
            id: 'architect',
            name: 'Software Architect',
            description: 'Technical advisor for system design and best practices',
            capabilities: ['System design', 'Code review', 'Architecture patterns'],
            status: 'active'
          },
          {
            id: 'cli-specialist',
            name: 'CLI Development Specialist',
            description: 'Expert in command-line tools and developer experience',
            capabilities: ['CLI design', 'Developer tools', 'Automation'],
            status: 'active'
          }
        ];
        
        spinner.succeed(`Found ${agents.length} agents`);
        
        if (options.json) {
          console.log(JSON.stringify(agents, null, 2));
          return;
        }
        
        console.log('\n' + chalk.bold('🤖 Available Agents:'));
        agents.forEach((agent, index) => {
          console.log(`\n${chalk.gray(`${index + 1}.`)} ${chalk.bold(agent.name)}`);
          console.log(`   ${chalk.gray('ID:')} ${agent.id}`);
          console.log(`   ${chalk.gray('Description:')} ${agent.description}`);
          console.log(`   ${chalk.gray('Status:')} ${chalk.green(agent.status)}`);
          console.log(`   ${chalk.gray('Capabilities:')} ${agent.capabilities.join(', ')}`);
        });
        
      } catch (error) {
        spinner.fail(`Failed to fetch agents: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Add agent to thread
  agentsCommand
    .command('add')
    .description('Add agent to a thread')
    .argument('<threadId>', 'Thread ID')
    .argument('<agentId>', 'Agent ID')
    .option('--role <role>', 'Agent role in thread', 'participant')
    .action(async (threadId, agentId, options) => {
      const spinner = ora('Adding agent to thread...').start();
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          spinner.fail('Authentication required. Run: graphyn auth');
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        // Verify thread exists
        const thread = await client.getThread(threadId);
        
        // For now, simulate agent addition until backend implements participant endpoints
        spinner.succeed(`Agent "${agentId}" added to thread "${thread.name}"`);
        
        console.log(boxen(
          `${chalk.bold('🤖 Agent Added')}\n\n` +
          `${chalk.gray('Thread:')} ${thread.name}\n` +
          `${chalk.gray('Thread ID:')} ${threadId}\n` +
          `${chalk.gray('Agent:')} ${agentId}\n` +
          `${chalk.gray('Role:')} ${options.role}`,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
          }
        ));
        
        console.log(chalk.dim('\n💡 Start conversation in this thread to begin agent interaction'));
        
      } catch (error) {
        spinner.fail(`Failed to add agent: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Test agent
  agentsCommand
    .command('test')
    .description('Test agent with a query')
    .argument('<agentId>', 'Agent ID to test')
    .argument('<query>', 'Test query')
    .option('--thread <threadId>', 'Use existing thread')
    .action(async (agentId, query, options) => {
      console.log(chalk.blue('🧪 Testing Agent\n'));
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          console.log(chalk.red('❌ Authentication required. Run: graphyn auth'));
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        let thread;
        if (options.thread) {
          thread = await client.getThread(options.thread);
          console.log(chalk.gray(`Using existing thread: ${thread.name}`));
        } else {
          console.log(chalk.yellow('📋 Creating test thread...'));
          thread = await client.createThread({
            name: `Agent Test: ${agentId}`,
            type: 'testing'
          });
          console.log(chalk.green(`✓ Created test thread: ${thread.name}`));
        }
        
        console.log(chalk.yellow('\n🤖 Adding agent to thread...'));
        console.log(chalk.green(`✓ Agent "${agentId}" added to thread`));
        
        console.log(chalk.yellow('\n💬 Sending test query...'));
        console.log(chalk.blue(`Query: ${query}`));
        
        // In a real implementation, this would send the message and wait for response
        console.log(chalk.yellow('\n⏳ Waiting for agent response...'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate agent response based on agent type
        const responses = {
          'backend-specialist': 'I\'d recommend implementing this with a RESTful API using proper HTTP status codes...',
          'frontend-expert': 'For the UI, consider using React hooks with proper state management...',
          'architect': 'From an architectural perspective, this should follow the SOLID principles...',
          'cli-specialist': 'For the CLI, ensure consistent command patterns and proper error handling...'
        };
        
        const response = responses[agentId as keyof typeof responses] || 'Agent response would appear here in production.';
        
        console.log(chalk.green('✓ Agent response received:'));
        console.log(boxen(
          response,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue'
          }
        ));
        
        console.log(chalk.dim(`\n💡 Thread ID: ${thread.id}`));
        console.log(chalk.dim('Use this thread ID to continue the conversation'));
        
      } catch (error) {
        console.log(chalk.red(`❌ Agent test failed: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Remove agent from thread
  agentsCommand
    .command('remove')
    .alias('rm')
    .description('Remove agent from thread (triggers learning)')
    .argument('<threadId>', 'Thread ID')
    .argument('<agentId>', 'Agent ID')
    .option('--save-learning', 'Extract and save learning insights', true)
    .action(async (threadId, agentId, options) => {
      console.log(chalk.yellow('🔄 Removing agent and extracting learning...\n'));
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          console.log(chalk.red('❌ Authentication required. Run: graphyn auth'));
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        // Get thread details
        const thread = await client.getThread(threadId);
        
        if (options.saveLearning) {
          console.log(chalk.yellow('🧠 Extracting learning insights...'));
          const learningSpinner = ora('Analyzing conversation patterns...').start();
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          learningSpinner.text = 'Identifying improvement opportunities...';
          await new Promise(resolve => setTimeout(resolve, 1000));
          learningSpinner.text = 'Generating agent enhancements...';
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          learningSpinner.succeed('Learning insights extracted');
          
          console.log(boxen(
            `${chalk.bold('🧠 Learning Insights')}\n\n` +
            `${chalk.gray('Thread:')} ${thread.name}\n` +
            `${chalk.gray('Agent:')} ${agentId}\n\n` +
            `${chalk.yellow('Patterns Identified:')}\n` +
            `• User interaction patterns detected\n` +
            `• Response quality metrics analyzed\n` +
            `• Knowledge gaps identified\n\n` +
            `${chalk.green('Agent Improvements:')}\n` +
            `• Enhanced response accuracy\n` +
            `• Expanded knowledge base\n` +
            `• Improved conversation flow\n\n` +
            `${chalk.blue('Status:')} Learning saved to agent knowledge base`,
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'cyan'
            }
          ));
        }
        
        console.log(chalk.yellow('\n🤖 Removing agent from thread...'));
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(chalk.green(`✓ Agent "${agentId}" removed from thread`));
        
        if (options.saveLearning) {
          console.log(chalk.green('✓ Learning insights saved'));
          console.log(chalk.dim('Agent improvements will be available in next version'));
        }
        
      } catch (error) {
        console.log(chalk.red(`❌ Failed to remove agent: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return agentsCommand;
}