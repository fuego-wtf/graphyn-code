import { promises as fs } from 'fs';
import * as path from 'path';
import { exec, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import chalk from 'chalk';


import { GraphynAPIClient } from '../api/client.js';
import { createThreadSSEClient } from '../utils/sse-client.js';
import { RepositoryAnalyzer } from '../services/repository-analyzer.js';
import open from 'open';
import { createInterface } from 'readline';

const execAsync = promisify(exec);


function createProgressBar(current: number, total: number, length: number = 20): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * length);
  const empty = length - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    // Use the /api/status endpoint from the API gateway (doesn't require auth)
    const response = await fetch('http://localhost:4000/api/status', {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    // Backend is healthy if it responds with 200 OK and has expected status data
    if (response.ok) {
      try {
        const data = await response.json() as any;
        // Verify it's the expected status endpoint response
        return data.status && data.version && typeof data.uptime === 'number';
      } catch {
        // If JSON parsing fails, still consider it healthy if response was OK
        return true;
      }
    }
    
    // If we get a 500 error, the backend is running but has internal issues
    // This means the service is technically running but not fully healthy
    if (response.status === 500) {
      console.log(`\n⚠️  Backend responding with error ${response.status} - service running but unhealthy`);
      try {
        const errorData = await response.text();
        console.log(`   Error: ${errorData}`);
      } catch {}
      return false;
    }
    
    return false;
  } catch (error) {
    // Network errors mean the backend is not running at all
    return false;
  }
}

async function checkFrontendHealth(): Promise<boolean> {
  try {
    // Check if frontend is responding
    const response = await fetch('http://localhost:3000', {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    
    // Frontend is healthy if it responds with any 2xx status
    return response.ok;
  } catch (error) {
    return false;
  }
}

export interface OrchestrateOptions {
  query: string;
  repository: string;
  dev?: boolean;
  interactive?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  prompt: string;
  estimated_time?: string;
  dependencies?: string[];
}

export interface AgentTeam {
  threadId: string;
  agents: {
    name: string;
    role: string;
    capabilities: string[];
  }[];
}

export async function orchestrateCommand(options: OrchestrateOptions): Promise<void> {
  // Set up cleanup handler for process interruption
  const cleanupHandler = () => {
    console.log('\n🛑 Process interrupted, cleaning up...');
    cleanupSessionWorktrees(options.repository).finally(() => {
      process.exit(0);
    });
  };
  
  process.once('SIGINT', cleanupHandler);
  process.once('SIGTERM', cleanupHandler);
  
  try {
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    GRAPHYN ORCHESTRATION                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    
    // Set local API URL for dev mode
    if (options.dev) {
      process.env.GRAPHYN_API_URL = 'http://localhost:4000';
      process.env.NODE_ENV = 'development';
      console.log(`🔧 Dev mode enabled - using API: http://localhost:4000`);
    }
    
    // 1. Check backend health
    process.stdout.write('Checking backend... ');
    const backendHealthy = await checkBackendHealth();
    if (!backendHealthy) {
      console.log('✗ FAILED');
      console.log('\n⚠️  Backend health check failed');
      console.log('The backend service might be:');
      console.log('  - Not running: cd ../backyard && encore run');
      console.log('  - Running but unhealthy: check backend logs for errors');
      console.log('  - Missing required dependencies: check monitoring service');
      console.log('\n🛑 Cannot continue without backend. Please start the backend service.');
      return;
    }
    console.log('✓ HEALTHY');
    
    // 1.5. Check frontend health in dev mode
    if (options.dev) {
      process.stdout.write('Checking frontend... ');
      const frontendHealthy = await checkFrontendHealth();
      if (!frontendHealthy) {
        console.log('✗ FAILED');
        console.log('\n⚠️  Frontend not running at localhost:3000');
        console.log('Please run: ./scripts/dev.sh');
        console.log('\n🛑 Cannot continue without frontend. Please start the frontend service.');
        return;
      }
      console.log('✓ HEALTHY');
    }
    
    // 2. Check authentication
    process.stdout.write('Checking authentication... ');
    
    let isAuthenticated = false;
    
    try {
      isAuthenticated = false; // Auth disabled
    } catch (error) {
      // Handle keychain errors gracefully
      const errorMsg = (error as any).message || (error as any).toString();
      if (errorMsg.includes('keychain') || 
          errorMsg.includes('SecKeychainSearchCopyNext') ||
          errorMsg.includes('specified item could not be found')) {
        console.log('✗ KEYCHAIN ERROR');
        isAuthenticated = false;
      } else {
        console.log(`✗ FAILED - ${errorMsg}`);
        console.log('\nAuthentication check failed. Please try again.');
        return;
      }
    }
    
    if (!isAuthenticated) {
      console.log('✗ FAILED');
      
      // Authentication disabled - skip auth check
      console.log('⚠️ Authentication disabled - continuing in offline mode');
    } else {
      console.log('✓ AUTHENTICATED');
    }

    const apiClient = new GraphynAPIClient();

    // 3. Find or create agent team for this repository
    process.stdout.write('Setting up agent team... ');
    const agentTeam = await findOrCreateAgentTeam(options.repository, apiClient);
    console.log(`✓ READY (${agentTeam.agents.length} agents)`);

    // 4. Send query to thread and receive tasks
    process.stdout.write('Generating tasks... ');
    const tasks = await receiveTasksFromThread(agentTeam.threadId, options.query, apiClient);
    console.log(`✓ GENERATED (${tasks.length} tasks)`);

    // 5. Show tasks for approval (if interactive)
    let approvedTasks = tasks;
    if (options.interactive !== false) {
      console.log(''); // Add spacing before task selection
      approvedTasks = await selectTasks(tasks);
    }

    if (approvedTasks.length === 0) {
      console.log('\n⚠ No tasks selected. Exiting.\n');
      return;
    }

    // 6. Execute tasks with real-time streaming and feedback
    console.log('\n⚙️  Setting up agents...');
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    EXECUTING TASKS                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    
    await executeTasksWithStreaming(approvedTasks, options.repository, options.query);
    
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                     EXECUTION COMPLETE                          │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');

    // Clean up session worktrees
    console.log('\n🧹 Cleaning up...');
    await cleanupSessionWorktrees(options.repository);

  } catch (error) {
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                         ERROR                                   │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.error('\n' + (error instanceof Error ? (error as any).message : error) + '\n');
    
    // Clean up worktrees even on error
    try {
      await cleanupSessionWorktrees(options.repository);
    } catch (cleanupError) {
      console.error('Failed to cleanup worktrees:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }
    
    process.exit(1);
  }
}

async function findOrCreateAgentTeam(repoPath: string, apiClient: GraphynAPIClient): Promise<AgentTeam> {
  // 1. Get repository context
  const analyzer = new RepositoryAnalyzer();
  const repoContext = await analyzer.analyze(repoPath);
  const repoName = path.basename(repoPath);

  // 2. Check for existing agent team thread
  console.log(chalk.gray(`🔗 Listing existing threads...`));
  const threads = await apiClient.listThreads();
  console.log(chalk.gray(`🔍 Found ${threads.length} threads`));
  
  const existingThread = threads.find(thread => 
    thread.metadata?.repository?.path === repoPath ||
    thread.name?.includes(`Agent Team: ${repoName}`)
  );

  if (existingThread) {
    // Extract agent team from thread metadata
    const agents = existingThread.metadata?.agents || [];
    return {
      threadId: existingThread.id,
      agents
    };
  }

  // 3. Create new agent team builder thread
  console.log('Creating new agent team for repository...');
  const builderThread = await apiClient.createThread({
    name: `Agent Team: ${repoName}`,
    metadata: { 
      repository: {
        path: repoPath,
        name: repoName,
        language: repoContext.language,
        framework: repoContext.framework,
        packages: repoContext.packages,
        type: repoContext.type,
        structure: repoContext.structure
      }
    }
  });

  // 4. Request agent team creation
  const teamPrompt = `Analyze this ${repoContext.language} repository and create a specialized coding agent team:

Repository: ${repoName}
Language: ${repoContext.language}
Framework: ${repoContext.framework || 'None detected'}
Type: ${repoContext.type}
Packages: ${repoContext.packages?.join(', ') || 'None'}

File Structure:
${repoContext.structure.directories.slice(0, 20).join('\n')}

Create 3-5 specialized agents that can work together on this codebase. Respond with JSON:
{
  "agents": [
    {
      "name": "agent-name",
      "role": "Human-readable role",
      "capabilities": ["capability1", "capability2"],
      "expertise": "What this agent excels at"
    }
  ]
}`;

  await apiClient.sendMessage(builderThread.id, teamPrompt);

  // 5. Wait for team configuration response
  const teamConfig = await waitForTeamConfig(builderThread.id, apiClient);

  // 6. Update thread metadata with agent team
  await apiClient.updateThread(builderThread.id, {
    metadata: {
      ...builderThread.metadata,
      agents: teamConfig.agents
    }
  });

  return {
    threadId: builderThread.id,
    agents: teamConfig.agents
  };
}

async function waitForTeamConfig(threadId: string, apiClient: GraphynAPIClient): Promise<{ agents: any[] }> {
  return new Promise((resolve, reject) => {
    console.log(chalk.gray(`🔗 Connecting to SSE stream for thread: ${threadId}`));
    
    const timeout = setTimeout(() => {
      console.log(chalk.red(`⏰ Timeout after 30 seconds waiting for agent team configuration`));
      console.log(chalk.gray(`   Thread ID: ${threadId}`));
      console.log(chalk.gray(`   Expected event: message.created with agents array`));
      reject(new Error('Timeout waiting for agent team configuration'));
    }, 30000); // 30 second timeout

    const sseClient = createThreadSSEClient(threadId);
    let messageCount = 0;
    
    sseClient.on('connect', () => {
      console.log(chalk.green(`✅ SSE connection established for thread: ${threadId}`));
    });
    
    sseClient.on('message', (event) => {
      messageCount++;
      console.log(chalk.gray(`📥 Received SSE message ${messageCount}: ${event.type}`));
      
      try {
        if (event.type === 'message.created' && event.data.participant_type === 'agent' && event.data.content) {
          const content = event.data.content;
          console.log(chalk.gray(`💬 Agent message content length: ${content.length} characters`));
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            console.log(chalk.gray(`📊 Found JSON in response, attempting to parse...`));
            try {
              const teamConfig = JSON.parse(jsonMatch[0]);
              if (teamConfig.agents && Array.isArray(teamConfig.agents)) {
                console.log(chalk.green(`✅ Successfully parsed agent team: ${teamConfig.agents.length} agents`));
                clearTimeout(timeout);
                sseClient.close();
                resolve(teamConfig);
                return;
              } else {
                console.log(chalk.yellow(`⚠️  JSON parsed but no valid agents array found`));
                console.log(chalk.gray(`   Keys found: ${Object.keys(teamConfig).join(', ')}`));
              }
            } catch (parseError) {
              console.log(chalk.yellow(`⚠️  Failed to parse JSON: ${(parseError as any).message}`));
              console.log(chalk.gray(`   JSON preview: ${jsonMatch[0].substring(0, 100)}...`));
            }
          } else {
            console.log(chalk.yellow(`⚠️  No JSON found in message content`));
            console.log(chalk.gray(`   Content preview: ${content.substring(0, 100)}...`));
          }
        } else {
          console.log(chalk.gray(`📝 Event type: ${event.type}, participant: ${event.data.participant_type}, has content: ${!!event.data.content}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Error processing message: ${(error as any).message}`));
      }
    });

    sseClient.on('error', (error) => {
      console.log(chalk.red(`🚨 SSE connection error: ${(error as any).message}`));
      clearTimeout(timeout);
      reject(error);
    });

    sseClient.on('disconnect', () => {
      console.log(chalk.yellow(`🔌 SSE connection disconnected for thread: ${threadId}`));
    });
    
    // Start the connection
    sseClient.connect().catch((error) => {
      console.log(chalk.red(`❌ Failed to connect SSE: ${(error as any).message}`));
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function receiveTasksFromThread(threadId: string, query: string, apiClient: GraphynAPIClient): Promise<Task[]> {

  // Send the task generation query
  const taskPrompt = `Break down this request into specific, actionable tasks for our agent team:

REQUEST: "${query}"

Create 3-7 tasks that can be worked on in parallel. Each task should:
- Be specific and actionable
- Assigned to the most appropriate agent
- Include clear success criteria
- Have dependencies if needed

Respond with JSON:
{
  "tasks": [
    {
      "id": "task-001",
      "title": "Brief task title",
      "description": "Detailed description",
      "agent": "agent-name",
      "prompt": "Specific prompt for Claude CLI",
      "estimated_time": "30 minutes",
      "dependencies": []
    }
  ]
}`;

  await apiClient.sendMessage(threadId, taskPrompt);

  // Wait for task generation response
  return new Promise((resolve, reject) => {
    console.log(chalk.gray(`🔗 Connecting to SSE stream for task generation, thread: ${threadId}`));
    
    const timeout = setTimeout(() => {
      console.log(chalk.red(`⏰ Timeout after 60 seconds waiting for task generation`));
      console.log(chalk.gray(`   Thread ID: ${threadId}`));
      console.log(chalk.gray(`   Expected event: message.created with tasks array`));
      reject(new Error('Timeout waiting for task generation'));
    }, 60000); // 60 second timeout

    const sseClient = createThreadSSEClient(threadId);
    let messageCount = 0;
    
    sseClient.on('connect', () => {
      console.log(chalk.green(`✅ SSE connection established for task generation, thread: ${threadId}`));
    });
    
    sseClient.on('message', (event) => {
      messageCount++;
      console.log(chalk.gray(`📥 Task gen - received SSE message ${messageCount}: ${event.type}`));
      
      try {
        if (event.type === 'message.created' && event.data.participant_type === 'agent' && event.data.content) {
          const content = event.data.content;
          console.log(chalk.gray(`💬 Task gen - agent message content length: ${content.length} characters`));
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            console.log(chalk.gray(`📊 Found JSON in task generation response, attempting to parse...`));
            try {
              const taskResponse = JSON.parse(jsonMatch[0]);
              if (taskResponse.tasks && Array.isArray(taskResponse.tasks)) {
                console.log(chalk.green(`✅ Successfully parsed tasks: ${taskResponse.tasks.length} tasks`));
                clearTimeout(timeout);
                sseClient.close();
                resolve(taskResponse.tasks);
                return;
              } else {
                console.log(chalk.yellow(`⚠️  JSON parsed but no valid tasks array found`));
                console.log(chalk.gray(`   Keys found: ${Object.keys(taskResponse).join(', ')}`));
              }
            } catch (parseError) {
              console.log(chalk.yellow(`⚠️  Failed to parse task JSON: ${(parseError as any).message}`));
              console.log(chalk.gray(`   JSON preview: ${jsonMatch[0].substring(0, 100)}...`));
            }
          } else {
            console.log(chalk.yellow(`⚠️  No JSON found in task generation message content`));
            console.log(chalk.gray(`   Content preview: ${content.substring(0, 100)}...`));
          }
        } else {
          console.log(chalk.gray(`📝 Task gen - event type: ${event.type}, participant: ${event.data.participant_type}, has content: ${!!event.data.content}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Error processing task generation message: ${(error as any).message}`));
      }
    });

    sseClient.on('error', (error) => {
      console.log(chalk.red(`🚨 SSE connection error for task generation: ${(error as any).message}`));
      clearTimeout(timeout);
      reject(error);
    });

    sseClient.on('disconnect', () => {
      console.log(chalk.yellow(`🔌 SSE connection disconnected for task generation, thread: ${threadId}`));
    });
    
    // Start the connection
    sseClient.connect().catch((error) => {
      console.log(chalk.red(`❌ Failed to connect SSE for task generation: ${(error as any).message}`));
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function selectTasks(tasks: Task[]): Promise<Task[]> {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                       GENERATED TASKS                          │');
  console.log('└─────────────────────────────────────────────────────────────────┘\n');
  
  tasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.title}`);
    console.log(`   Agent: ${task.agent} | Time: ${task.estimated_time || 'Unknown'}`);
    console.log(`   ${task.description}`);
    console.log('');
  });

  const { selectedTasks } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTasks',
      message: 'Select tasks to execute:',
      choices: tasks.map((task, index) => ({
        name: `${task.title} (${task.agent})`,
        value: index,
        checked: true // Default to all selected
      })),
      validate: (answer) => {
        if (answer.length === 0) {
          return 'You must choose at least one task.';
        }
        return true;
      }
    }
  ]);

  return selectedTasks.map((index: number) => tasks[index]);
}


async function executeTasksWithStreaming(tasks: Task[], repoPath: string, originalQuery: string): Promise<void> {
  let currentTasks = [...tasks];
  let currentIndex = 0;
  
  // Initialize task states for Petri-net display
  const taskStates = currentTasks.map(() => 'PENDING');
  
  while (currentIndex < currentTasks.length) {
    const task = currentTasks[currentIndex];
    const remainingTasks = currentTasks.slice(currentIndex + 1);
    
    // Update task state to IN_PROGRESS
    taskStates[currentIndex] = 'IN_PROGRESS';
    displayPetrinetProgress(currentTasks, taskStates, currentIndex);
    
    console.log(`\n${chalk.cyan('┌')}${'─'.repeat(65)}${chalk.cyan('┐')}`);
    console.log(`${chalk.cyan('│')} ${chalk.bold(`Task ${currentIndex + 1}: ${task.title}`)}${' '.repeat(Math.max(0, 65 - task.title.length - 9))}${chalk.cyan('│')}`);
    console.log(`${chalk.cyan('│')} ${chalk.gray(`Agent: ${task.agent} | Estimated: ${task.estimated_time}`)}${' '.repeat(Math.max(0, 65 - task.agent.length - (task.estimated_time?.length || 0) - 25))}${chalk.cyan('│')}`);
    console.log(`${chalk.cyan('└')}${'─'.repeat(65)}${chalk.cyan('┘')}\n`);

    try {
      // Create git worktree for this task
      const { worktreePath } = await createWorktree(task.id, repoPath);
      
      // Execute Claude CLI with real-time streaming
      await executeClaudeWithStreaming(task, worktreePath);
      
      // Mark task as COMPLETE
      taskStates[currentIndex] = 'COMPLETE';
      displayPetrinetProgress(currentTasks, taskStates, currentIndex);
      
      // Ask for feedback after each task
      const feedback = await getFeedbackForTask(task, currentIndex + 1, currentTasks.length, remainingTasks);
      
      if (feedback.action === 'modify' && feedback.modifiedTasks) {
        console.log(chalk.green('\n✓ Tasks updated successfully!\n'));
        // Replace remaining tasks with modified ones
        currentTasks = [
          ...currentTasks.slice(0, currentIndex + 1), // Keep completed tasks
          ...feedback.modifiedTasks // Use modified remaining tasks
        ];
        // Reset taskStates for new tasks
        taskStates.splice(currentIndex + 1); // Remove old states
        taskStates.push(...feedback.modifiedTasks.map(() => 'PENDING')); // Add new pending states
        currentIndex++;
        continue;
      }
      
      if (feedback.action === 'regenerate') {
        console.log(chalk.yellow('\n🔄 Regenerating remaining tasks based on your feedback...\n'));
        const newTasks = await regenerateTasksWithFeedback(originalQuery, feedback.feedback!, remainingTasks.length);
        currentTasks = [
          ...currentTasks.slice(0, currentIndex + 1), // Keep completed tasks
          ...newTasks // Use regenerated tasks
        ];
        // Reset taskStates for new tasks
        taskStates.splice(currentIndex + 1); // Remove old states
        taskStates.push(...newTasks.map(() => 'PENDING')); // Add new pending states
        currentIndex++;
        continue;
      }
      
      if (feedback.action === 'skip') {
        console.log(chalk.yellow('\n⏭ Skipping remaining tasks as requested.\n'));
        break;
      }
      
      // Continue to next task
      currentIndex++;
      
    } catch (error) {
      console.log(chalk.red(`\n❌ Task failed: ${error instanceof Error ? (error as any).message : error}\n`));
      
      const { continueWithNext } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueWithNext',
        message: 'Task failed. Continue with next task?',
        default: true
      }]);
      
      if (!continueWithNext) break;
      currentIndex++;
    }
  }
}

async function regenerateTasksWithFeedback(originalQuery: string, feedback: string, taskCount: number): Promise<Task[]> {
  // Generate new tasks based on feedback
  // For now, we'll use a simple approach - in a real implementation, this could call the AI
  const newTasks: Task[] = [];
  
  for (let i = 0; i < taskCount; i++) {
    newTasks.push({
      id: `regenerated-task-${Date.now()}-${i}`,
      title: `Updated task ${i + 1}`,
      description: `Regenerated task based on feedback: "${feedback}"`,
      prompt: `Based on the feedback "${feedback}" and the original query "${originalQuery}", please provide updated guidance for task ${i + 1}.`,
      agent: 'fullstack-dev',
      estimated_time: '20 minutes'
    });
  }
  
  return newTasks;
}

function displayPetrinetProgress(tasks: Task[], taskStates: string[], currentIndex: number): void {
  console.log('\n' + chalk.gray('┌─────────────────── TASK PROGRESS ───────────────────┐'));
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const state = taskStates[i];
    let stateIcon = '';
    let stateColor = chalk.gray;
    
    switch (state) {
      case 'PENDING':
        stateIcon = '○';
        stateColor = chalk.gray;
        break;
      case 'IN_PROGRESS':
        stateIcon = '●';
        stateColor = chalk.yellow;
        break;
      case 'COMPLETE':
        stateIcon = '✓';
        stateColor = chalk.green;
        break;
    }
    
    const taskLine = `${stateColor(stateIcon)} ${i + 1}. ${task.title}`;
    const truncatedLine = taskLine.length > 50 ? taskLine.substring(0, 47) + '...' : taskLine;
    const padding = 50 - (truncatedLine.length - stateIcon.length - 4); // Account for ANSI codes
    
    console.log(chalk.gray('│ ') + truncatedLine + ' '.repeat(Math.max(0, padding)) + chalk.gray(' │'));
    
    // Show flow for current task
    if (i === currentIndex && state === 'IN_PROGRESS') {
      const flow = '  PENDING ──● IN_PROGRESS ──○ COMPLETE';
      console.log(chalk.gray('│   ') + chalk.yellow(flow) + ' '.repeat(Math.max(0, 47 - flow.length)) + chalk.gray(' │'));
    }
  }
  
  console.log(chalk.gray('└─────────────────────────────────────────────────────┘\n'));
}

async function buildRepositoryContext(repoPath: string): Promise<string> {
  try {
    const analyzer = new RepositoryAnalyzer();
    const analysis = await analyzer.analyze(repoPath);
    
    const contextLines: string[] = [];
    contextLines.push('=== REPOSITORY CONTEXT ===');
    contextLines.push(`Repository: ${analysis.name}`);
    contextLines.push(`Type: ${analysis.type}`);
    contextLines.push(`Language: ${analysis.language}`);
    
    if (analysis.framework) {
      contextLines.push(`Framework: ${analysis.framework}`);
    }
    
    if (analysis.gitInfo) {
      contextLines.push(`Git Branch: ${analysis.gitInfo.branch}`);
      if (analysis.gitInfo.remote) {
        contextLines.push(`Remote: ${analysis.gitInfo.remote}`);
      }
    }
    
    // Add package information for monorepos
    if (analysis.packages && analysis.packages.length > 0) {
      contextLines.push(`\nPackages (${analysis.packages.length}):`);
      analysis.packages.slice(0, 10).forEach(pkg => {
        contextLines.push(`- ${pkg}`);
      });
      if (analysis.packages.length > 10) {
        contextLines.push(`... and ${analysis.packages.length - 10} more`);
      }
    }
    
    // Add directory structure (limited)
    if (analysis.structure.directories.length > 0) {
      contextLines.push(`\nKey Directories:`);
      const importantDirs = analysis.structure.directories
        .filter(dir => !dir.includes('/') || dir.split('/').length <= 2) // Top level and one level deep
        .slice(0, 15);
      importantDirs.forEach(dir => {
        contextLines.push(`- ${dir}`);
      });
    }
    
    // Add file types
    const fileTypes = Object.keys(analysis.structure.files);
    if (fileTypes.length > 0) {
      contextLines.push(`\nFile Types: ${fileTypes.join(', ')}`);
    }
    
    // Add recent files (if git available)
    try {
      const recentFiles = await getRecentlyModifiedFiles(repoPath);
      if (recentFiles.length > 0) {
        contextLines.push(`\nRecently Modified Files:`);
        recentFiles.slice(0, 5).forEach(file => {
          contextLines.push(`- ${file}`);
        });
      }
    } catch {
      // Ignore git errors
    }
    
    contextLines.push('=== END CONTEXT ===\n');
    return contextLines.join('\n');
    
  } catch (error) {
    return `=== REPOSITORY CONTEXT ===
Repository: ${path.basename(repoPath)}
Context analysis failed: ${error instanceof Error ? (error as any).message : 'Unknown error'}
=== END CONTEXT ===\n`;
  }
}

async function getRecentlyModifiedFiles(repoPath: string): Promise<string[]> {
  try {
    const output = execSync('git log --name-only --pretty=format: -10', {
      cwd: repoPath,
      encoding: 'utf-8'
    }).toString();
    
    const files = output
      .split('\n')
      .filter((line: any) => line.trim() && !line.startsWith(' '))
      .filter((file: any, index: any, arr: any) => arr.indexOf(file) === index) // Unique files
      .slice(0, 10);
    
    return files;
  } catch {
    return [];
  }
}

async function createWorktree(taskId: string, repoPath: string): Promise<{ worktreePath: string; branchName: string }> {
  const worktreePath = path.join(repoPath, '.worktrees', `task-${taskId}`);
  const branchName = `task/${taskId}`;
  
  // Ensure .worktrees directory exists
  await fs.mkdir(path.dirname(worktreePath), { recursive: true });
  
  try {
    // Try to remove existing worktree if it exists
    await execAsync(`git worktree remove ${worktreePath}`, { cwd: repoPath });
  } catch {
    // Ignore if worktree doesn't exist
  }
  
  try {
    // Try to delete existing branch if it exists
    await execAsync(`git branch -D ${branchName}`, { cwd: repoPath });
  } catch {
    // Ignore if branch doesn't exist
  }
  
  // Create fresh git worktree with new branch
  await execAsync(`git worktree add ${worktreePath} -b ${branchName}`, { cwd: repoPath });
  
  return { worktreePath, branchName };
}

async function executeClaudeWithStreaming(task: Task, worktreePath: string): Promise<void> {
  console.log(chalk.gray(`Executing Claude Code SDK for task: ${task.title}\n`));
  
  try {
    // Import Claude Code SDK client
    const { ClaudeCodeClient } = await import('../sdk/claude-code-client.js');
    
    // Build repository context without creating files
    const repoContext = await buildRepositoryContext(worktreePath);
    
    // Enhance prompt with repository context
    const enhancedPrompt = `${repoContext}

TASK: ${task.prompt}

Please work in this directory: ${worktreePath}
Focus on implementing the task according to the agent specialization: ${task.agent}`;

    // Create Claude Code client with timeout protection
    const client = new ClaudeCodeClient();
    const abortController = new AbortController();
    
    // Set aggressive timeout: 30 seconds max
    const timeoutMs = 30000;
    const timeoutId = setTimeout(() => {
      console.log(chalk.red(`\n❌ Claude Code SDK timeout after ${timeoutMs/1000}s - providing static guidance`));
      abortController.abort();
    }, timeoutMs);
    
    let hasOutput = false;
    let finalResult = '';
    
    // Set up real-time streaming handlers
    client.on('partial_content', (content: string) => {
      hasOutput = true;
      // Add indentation to distinguish from system output
      const indentedText = content.split('\n').map((line: string) => 
        line.trim() ? `  ${line}` : line
      ).join('\n');
      process.stdout.write(indentedText);
    });

    client.on('thinking_start', () => {
      process.stdout.write(chalk.gray('  [Thinking...] '));
    });

    client.on('thinking_end', () => {
      process.stdout.write(chalk.gray(' [Done]\n'));
    });

    client.on('debug', (message: string) => {
      // Only show debug in verbose mode
      if (process.env.DEBUG) {
        console.log(chalk.gray(`    Debug: ${message}`));
      }
    });

    try {
      // Execute query with streaming
      for await (const message of client.executeQueryStream(enhancedPrompt, {
        abortController,
        maxTurns: 3, // Limit turns to prevent infinite loops
        allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep'],
        appendSystemPrompt: `You are working as a ${task.agent} agent. Focus on the specific task and provide clear, actionable results.`
      })) {
        if (message.type === "result") {
          if ('subtype' in message && message.subtype === "success") {
            finalResult = (message as any).result || "Task completed";
            clearTimeout(timeoutId);
            
            if (!hasOutput) {
              console.log(chalk.gray('  Task completed successfully (no intermediate output)'));
            }
            console.log(''); // Add spacing after task output
            return;
          } else if ('subtype' in message && (message.subtype === "error_max_turns" || message.subtype === "error_during_execution")) {
            throw new Error((message as any).error || "Claude Code SDK error");
          }
        }
      }
      
      clearTimeout(timeoutId);
      if (!hasOutput) {
        console.log(chalk.gray('  (No output received from Claude Code SDK)'));
      }
      console.log(''); // Add spacing after task output

    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a timeout/abort error
      if (errorMsg.includes('timeout') || errorMsg.includes('aborted') || abortController.signal.aborted) {
        console.log(chalk.yellow('\n  ⚠️  Claude Code SDK timed out - providing static guidance instead\n'));
        
        // Provide static guidance based on task and agent type
        await provideStaticGuidance(task, worktreePath);
        return;
      }
      
      throw error;
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`\n  ❌ Claude Code SDK failed: ${errorMsg}\n`));
    console.log(chalk.yellow('  🔄 Falling back to static guidance...\n'));
    
    // Always fall back to static guidance on any error
    await provideStaticGuidance(task, worktreePath);
  }
}

/**
 * Provide static guidance when Claude Code SDK fails
 */
async function provideStaticGuidance(task: Task, worktreePath: string): Promise<void> {
  console.log(chalk.cyan('  📋 Static Guidance for Task:\n'));
  console.log(`    Title: ${task.title}`);
  console.log(`    Agent: ${task.agent}`);
  console.log(`    Directory: ${worktreePath}`);
  console.log('');
  
  // Provide guidance based on agent type
  const guidance = getStaticGuidanceForAgent(task.agent, task.description);
  console.log(chalk.gray('  ' + guidance.split('\n').join('\n  ')));
  console.log('');
  
  // Suggest next steps
  console.log(chalk.yellow('  💡 Next Steps:'));
  const nextSteps = getNextStepsForAgent(task.agent);
  nextSteps.forEach((step, index) => {
    console.log(chalk.gray(`    ${index + 1}. ${step}`));
  });
  console.log('');
}

/**
 * Get static guidance based on agent type and task
 */
function getStaticGuidanceForAgent(agentType: string, description: string): string {
  const guidanceMap: Record<string, string> = {
    'architect': `As a system architect, focus on:
• Design high-level system components and their interactions  
• Create architectural diagrams and documentation
• Define API contracts and data models
• Plan scalability and performance considerations
• Review current codebase structure for improvements`,

    'backend-dev': `As a backend developer, focus on:
• Implement API endpoints and business logic
• Set up database schemas and migrations  
• Configure authentication and authorization
• Write unit tests for backend services
• Handle error cases and validation`,

    'frontend-dev': `As a frontend developer, focus on:
• Create user interface components
• Implement client-side state management
• Connect UI to backend APIs
• Ensure responsive design and accessibility
• Write frontend tests and handle edge cases`,

    'fullstack-dev': `As a full-stack developer, focus on:
• Implement both frontend and backend features
• Ensure proper integration between client and server
• Set up database connections and API endpoints
• Create comprehensive user workflows
• Test end-to-end functionality`,

    'devops-engineer': `As a DevOps engineer, focus on:
• Set up CI/CD pipelines and deployment scripts
• Configure infrastructure and monitoring
• Implement security best practices
• Optimize build and deployment processes
• Set up logging and alerting systems`
  };

  return guidanceMap[agentType] || `As a ${agentType} agent:
• Analyze the task requirements: ${description}
• Break down the work into specific steps
• Implement according to your specialization
• Test your implementation thoroughly
• Document any important decisions or changes`;
}

/**
 * Get next steps based on agent type
 */
function getNextStepsForAgent(agentType: string): string[] {
  const stepsMap: Record<string, string[]> = {
    'architect': [
      'Review existing codebase and identify key components',
      'Create or update architectural documentation',
      'Define clear interfaces and contracts',
      'Plan implementation phases and dependencies'
    ],
    
    'backend-dev': [
      'Set up database models and migrations',
      'Implement core API endpoints',
      'Add proper error handling and validation',
      'Write unit tests for new functionality'
    ],
    
    'frontend-dev': [
      'Create UI components and layouts',
      'Implement client-side logic and state management',
      'Connect to backend APIs',
      'Test user interactions and edge cases'
    ],
    
    'fullstack-dev': [
      'Plan both frontend and backend changes',
      'Implement backend APIs first',
      'Create frontend components to consume APIs',
      'Test complete user workflows'
    ],
    
    'devops-engineer': [
      'Assess current deployment and infrastructure setup',
      'Implement or improve CI/CD processes',
      'Configure monitoring and logging',
      'Document deployment procedures'
    ]
  };

  return stepsMap[agentType] || [
    'Analyze the current codebase',
    'Plan your implementation approach',
    'Implement the required functionality',
    'Test and validate your changes'
  ];
}

async function getFeedbackForTask(task: Task, taskNumber: number, totalTasks: number, remainingTasks: Task[]): Promise<{
  action: 'continue' | 'modify' | 'regenerate' | 'skip';
  modifiedTasks?: Task[];
  feedback?: string;
}> {
  const choices = [
    { name: 'Continue to next task', value: 'continue' },
    { name: 'Modify remaining tasks and agents', value: 'modify' },
    { name: 'Regenerate all remaining tasks', value: 'regenerate' },
    { name: 'Skip remaining tasks', value: 'skip' }
  ];
  
  if (taskNumber === totalTasks) {
    // Last task, only show completion option
    return { action: 'continue' };
  }
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: `Task ${taskNumber}/${totalTasks} complete. What would you like to do?`,
    choices
  }]);
  
  if (action === 'modify') {
    const modifiedTasks = await modifyRemainingTasks(remainingTasks);
    return {
      action: 'modify',
      modifiedTasks
    };
  }
  
  if (action === 'regenerate') {
    const { feedback } = await inquirer.prompt([{
      type: 'input',
      name: 'feedback',
      message: 'What should we focus on? How should the new tasks be different?'
    }]);
    
    return {
      action: 'regenerate',
      feedback
    };
  }
  
  return {
    action: action as 'continue' | 'skip'
  };
}

async function modifyRemainingTasks(tasks: Task[]): Promise<Task[]> {
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                    MODIFY REMAINING TASKS                       │');
  console.log('└─────────────────────────────────────────────────────────────────┘\n');
  
  const modifiedTasks = [...tasks];
  
  while (true) {
    // Show current tasks
    console.log('Current remaining tasks:\n');
    modifiedTasks.forEach((task, index) => {
      console.log(`${index + 1}. ${chalk.bold(task.title)}`);
      console.log(`   Agent: ${chalk.cyan(task.agent)} | Time: ${task.estimated_time}`);
      console.log(`   ${task.description}`);
      console.log('');
    });
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Edit a task', value: 'edit' },
        { name: 'Change agent for a task', value: 'changeAgent' },
        { name: 'Add a new task', value: 'add' },
        { name: 'Remove a task', value: 'remove' },
        { name: 'Done - continue with these tasks', value: 'done' }
      ]
    }]);
    
    if (action === 'done') break;
    
    if (action === 'edit') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'list',
        name: 'taskIndex',
        message: 'Which task do you want to edit?',
        choices: modifiedTasks.map((task, index) => ({
          name: `${index + 1}. ${task.title}`,
          value: index
        }))
      }]);
      
      const task = modifiedTasks[taskIndex];
      const { newTitle, newDescription, newPrompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newTitle',
          message: 'Task title:',
          default: task.title
        },
        {
          type: 'input',
          name: 'newDescription', 
          message: 'Task description:',
          default: task.description
        },
        {
          type: 'input',
          name: 'newPrompt',
          message: 'Claude prompt:',
          default: task.prompt
        }
      ]);
      
      modifiedTasks[taskIndex] = {
        ...task,
        title: newTitle,
        description: newDescription,
        prompt: newPrompt
      };
    }
    
    if (action === 'changeAgent') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'list',
        name: 'taskIndex',
        message: 'Which task needs a different agent?',
        choices: modifiedTasks.map((task, index) => ({
          name: `${index + 1}. ${task.title} (currently: ${task.agent})`,
          value: index
        }))
      }]);
      
      const { newAgent } = await inquirer.prompt([{
        type: 'list',
        name: 'newAgent',
        message: 'Which agent should handle this task?',
        choices: [
          { name: 'Full Stack Developer', value: 'fullstack-dev' },
          { name: 'DevOps Engineer', value: 'devops-engineer' },
          { name: 'Frontend Specialist', value: 'frontend-specialist' },
          { name: 'Backend Developer', value: 'backend-dev' },
          { name: 'System Architect', value: 'system-architect' }
        ]
      }]);
      
      modifiedTasks[taskIndex].agent = newAgent;
    }
    
    if (action === 'add') {
      const { title, description, prompt, agent, estimatedTime } = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: 'New task title:'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Task description:'
        },
        {
          type: 'input',
          name: 'prompt',
          message: 'Claude prompt:'
        },
        {
          type: 'list',
          name: 'agent',
          message: 'Which agent should handle this?',
          choices: [
            { name: 'Full Stack Developer', value: 'fullstack-dev' },
            { name: 'DevOps Engineer', value: 'devops-engineer' },
            { name: 'Frontend Specialist', value: 'frontend-specialist' },
            { name: 'Backend Developer', value: 'backend-dev' },
            { name: 'System Architect', value: 'system-architect' }
          ]
        },
        {
          type: 'input',
          name: 'estimatedTime',
          message: 'Estimated time:',
          default: '15 minutes'
        }
      ]);
      
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title,
        description,
        prompt,
        agent,
        estimated_time: estimatedTime
      };
      
      modifiedTasks.push(newTask);
    }
    
    if (action === 'remove') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'list',
        name: 'taskIndex',
        message: 'Which task do you want to remove?',
        choices: modifiedTasks.map((task, index) => ({
          name: `${index + 1}. ${task.title}`,
          value: index
        }))
      }]);
      
      modifiedTasks.splice(taskIndex, 1);
    }
    
    console.log('\n');
  }
  
  return modifiedTasks;
}

async function spawnClaudeSession(task: Task, worktreePath: string): Promise<void> {
  console.log(chalk.yellow(`⚠️  Terminal spawning deprecated - using inline Claude Code SDK execution instead\n`));
  
  // Use the same execution logic as executeClaudeWithStreaming
  await executeClaudeWithStreaming(task, worktreePath);
}

/**
 * Clean up all session worktrees created during orchestration
 */
export async function cleanupSessionWorktrees(repoPath: string): Promise<void> {
  try {
    console.log('\n🧹 Cleaning up session worktrees...');
    
    const worktreesPath = path.join(repoPath, '.worktrees');
    
    // Check if .worktrees directory exists
    if (!await fs.stat(worktreesPath).then(() => true).catch(() => false)) {
      console.log('   No worktrees to clean up.');
      return;
    }
    
    // List all task worktrees
    const worktrees = await fs.readdir(worktreesPath);
    const taskWorktrees = worktrees.filter(name => name.startsWith('task-'));
    
    if (taskWorktrees.length === 0) {
      console.log('   No task worktrees found.');
      return;
    }
    
    // Remove each task worktree
    let cleanedCount = 0;
    for (const worktreeName of taskWorktrees) {
      const worktreePath = path.join(worktreesPath, worktreeName);
      try {
        // Use git worktree remove for proper cleanup
        await execAsync(`git worktree remove ${worktreePath}`, { cwd: repoPath });
        console.log(`   ✓ Removed worktree: ${worktreeName}`);
        cleanedCount++;
      } catch (error) {
        // If git worktree remove fails, try to remove the directory manually
        try {
          await fs.rm(worktreePath, { recursive: true, force: true });
          console.log(`   ✓ Force removed worktree: ${worktreeName}`);
          cleanedCount++;
        } catch (removeError) {
          console.log(`   ⚠ Failed to remove worktree: ${worktreeName}`);
        }
      }
    }
    
    // Clean up task branches
    const taskBranches = taskWorktrees.map(name => `task/${name.replace('task-', '')}`);
    for (const branchName of taskBranches) {
      try {
        await execAsync(`git branch -D ${branchName}`, { cwd: repoPath });
        console.log(`   ✓ Removed branch: ${branchName}`);
      } catch (error) {
        // Branch might not exist or already removed
      }
    }
    
    // Remove empty .worktrees directory if all worktrees are cleaned up
    try {
      const remainingWorktrees = await fs.readdir(worktreesPath);
      if (remainingWorktrees.length === 0) {
        await fs.rmdir(worktreesPath);
        console.log('   ✓ Removed empty .worktrees directory');
      }
    } catch (error) {
      // Directory might not be empty or have other issues
    }
    
    console.log(`✓ Session cleanup complete: ${cleanedCount} worktrees removed\n`);
    
  } catch (error) {
    console.log('⚠ Session cleanup encountered errors:', error instanceof Error ? (error as any).message : error);
  }
}