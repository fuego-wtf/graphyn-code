import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import GraphynAPIClient from '../api-client';
import { loadAuth } from '../auth';

const client = new GraphynAPIClient();

export function createThreadsCommand(): Command {
  const threadsCommand = new Command('threads')
    .alias('thread')
    .description('Manage threads in the Graphyn platform');

  // List threads
  threadsCommand
    .command('list')
    .alias('ls')
    .description('List all threads')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching threads...').start();
      
      try {
        // Load authentication
        const auth = loadAuth();
        if (!auth?.apiKey) {
          spinner.fail('Authentication required. Run: graphyn auth');
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        const threads = await client.listThreads();
        
        spinner.succeed(`Found ${threads.length} threads`);
        
        if (options.json) {
          console.log(JSON.stringify(threads, null, 2));
          return;
        }
        
        if (threads.length === 0) {
          console.log(chalk.yellow('\n📭 No threads found. Create one with: graphyn threads create'));
          return;
        }
        
        console.log('\n' + chalk.bold('🧵 Your Threads:'));
        threads.forEach((thread, index) => {
          const createdAt = new Date(thread.created_at).toLocaleDateString();
          const typeColor = thread.type === 'testing' ? chalk.blue : chalk.green;
          
          console.log(`\n${chalk.gray(`${index + 1}.`)} ${chalk.bold(thread.name)}`);
          console.log(`   ${chalk.gray('ID:')} ${thread.id}`);
          console.log(`   ${chalk.gray('Type:')} ${typeColor(thread.type)}`);
          console.log(`   ${chalk.gray('Created:')} ${createdAt}`);
        });
        
      } catch (error) {
        spinner.fail(`Failed to fetch threads: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Create thread
  threadsCommand
    .command('create')
    .description('Create a new thread')
    .argument('<name>', 'Thread name')
    .option('--type <type>', 'Thread type (testing or builder)', 'testing')
    .option('--json', 'Output as JSON')
    .action(async (name, options) => {
      const spinner = ora('Creating thread...').start();
      
      try {
        // Validate type
        if (!['testing', 'builder'].includes(options.type)) {
          spinner.fail('Thread type must be "testing" or "builder"');
          process.exit(1);
        }
        
        // Load authentication
        const auth = loadAuth();
        if (!auth?.apiKey) {
          spinner.fail('Authentication required. Run: graphyn auth');
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        const thread = await client.createThread({
          name,
          type: options.type as 'testing' | 'builder'
        });
        
        spinner.succeed('Thread created successfully!');
        
        if (options.json) {
          console.log(JSON.stringify(thread, null, 2));
          return;
        }
        
        console.log(boxen(
          `${chalk.bold('🧵 Thread Created')}\n\n` +
          `${chalk.gray('Name:')} ${chalk.bold(thread.name)}\n` +
          `${chalk.gray('ID:')} ${thread.id}\n` +
          `${chalk.gray('Type:')} ${chalk.blue(thread.type)}`,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
          }
        ));
        
        console.log(chalk.dim(`\n💡 Start streaming: ${chalk.bold(`graphyn threads stream ${thread.id}`)}`));
        
      } catch (error) {
        spinner.fail(`Failed to create thread: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Get thread details
  threadsCommand
    .command('show')
    .description('Show thread details')
    .argument('<threadId>', 'Thread ID')
    .option('--json', 'Output as JSON')
    .action(async (threadId, options) => {
      const spinner = ora('Fetching thread details...').start();
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          spinner.fail('Authentication required. Run: graphyn auth');
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        const thread = await client.getThread(threadId);
        
        spinner.succeed('Thread details fetched');
        
        if (options.json) {
          console.log(JSON.stringify(thread, null, 2));
          return;
        }
        
        const createdAt = new Date(thread.created_at).toLocaleString();
        const updatedAt = new Date(thread.updated_at).toLocaleString();
        
        console.log(boxen(
          `${chalk.bold('🧵 Thread Details')}\n\n` +
          `${chalk.gray('Name:')} ${chalk.bold(thread.name)}\n` +
          `${chalk.gray('ID:')} ${thread.id}\n` +
          `${chalk.gray('Type:')} ${chalk.blue(thread.type)}\n` +
          `${chalk.gray('Organization:')} ${thread.organization_id}\n` +
          `${chalk.gray('Created:')} ${createdAt}\n` +
          `${chalk.gray('Updated:')} ${updatedAt}`,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue'
          }
        ));
        
      } catch (error) {
        spinner.fail(`Failed to fetch thread: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Stream thread
  threadsCommand
    .command('stream')
    .description('Stream real-time updates from a thread')
    .argument('<threadId>', 'Thread ID')
    .action(async (threadId) => {
      console.log(chalk.blue('🔄 Starting real-time stream...\n'));
      
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          console.log(chalk.red('❌ Authentication required. Run: graphyn auth'));
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        // Test thread exists first
        const spinner = ora('Connecting to thread...').start();
        await client.getThread(threadId);
        spinner.succeed(`Connected to thread: ${threadId}`);
        
        console.log(chalk.dim('Press Ctrl+C to stop streaming\n'));
        console.log(chalk.gray('─'.repeat(50)));
        
        const eventSource = client.streamThread(threadId);
        
        eventSource.onopen = () => {
          console.log(chalk.green('✅ Stream connected'));
        };
        
        eventSource.onmessage = (event) => {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`${chalk.gray(`[${timestamp}]`)} ${event.data}`);
        };
        
        eventSource.onerror = (error) => {
          console.log(chalk.red('❌ Stream error:'), error);
          eventSource.close();
          process.exit(1);
        };
        
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n\n🛑 Stopping stream...'));
          eventSource.close();
          process.exit(0);
        });
        
      } catch (error) {
        console.log(chalk.red(`❌ Failed to start stream: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Delete thread
  threadsCommand
    .command('delete')
    .alias('rm')
    .description('Delete a thread')
    .argument('<threadId>', 'Thread ID')
    .option('--confirm', 'Skip confirmation prompt')
    .action(async (threadId, options) => {
      try {
        const auth = loadAuth();
        if (!auth?.apiKey) {
          console.log(chalk.red('❌ Authentication required. Run: graphyn auth'));
          process.exit(1);
        }
        
        client.setToken(auth.apiKey);
        
        // Get thread details first
        const thread = await client.getThread(threadId);
        
        if (!options.confirm) {
          console.log(chalk.yellow(`⚠️  About to delete thread: ${chalk.bold(thread.name)}`));
          console.log(chalk.red('This action cannot be undone.'));
          console.log(chalk.dim('Use --confirm flag to skip this prompt'));
          process.exit(1);
        }
        
        const spinner = ora('Deleting thread...').start();
        await client.deleteThread(threadId);
        spinner.succeed(`Thread "${thread.name}" deleted successfully`);
        
      } catch (error) {
        console.log(chalk.red(`❌ Failed to delete thread: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return threadsCommand;
}