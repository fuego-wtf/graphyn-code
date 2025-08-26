import { promises as fs } from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import chalk from 'chalk';

import { OAuthManager } from '../auth/oauth.js';
import { GraphynAPIClient } from '../api/client.js';
import { createThreadSSEClient } from '../utils/sse-client.js';
import { RepositoryAnalyzer } from '../services/repository-analyzer.js';
import open from 'open';
import readline from 'readline';

const execAsync = promisify(exec);

async function performInteractiveAuth(oauthManager: OAuthManager, isDev: boolean): Promise<void> {
  const frontendUrl = isDev ? 'http://localhost:3000/auth/signin' : 'https://app.graphyn.xyz/auth';
  
  // Open browser automatically
  try {
    await open(frontendUrl);
    console.log(`\u2713 Browser opened`);
  } catch (error) {
    console.log(`\u26a0\ufe0f  Could not open browser automatically`);
    console.log(`Please visit: ${frontendUrl}`);
  }
  
  console.log('\\n\u23f3 Waiting for authentication...');
  
  // Setup keyboard interaction
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let waitTime = 0;
  const maxWaitTime = 300; // 5 minutes
  
  // Show initial options once
  const showOptions = () => {
    console.log('\\n    Options while waiting:');
    console.log('    [R] Retry auth check');
    console.log('    [O] Open browser again');
    console.log('    [H] Help');
    console.log('    [Q] Quit');
    console.log('');
  };

  // Show only progress (no repeated options)
  const showProgress = () => {
    const progressBar = createProgressBar(waitTime, maxWaitTime);
    const remaining = Math.max(0, maxWaitTime - waitTime);
    process.stdout.write(`\\r    [${progressBar}] ${waitTime}s (${remaining}s remaining)`);
  };
  
  // Handle keyboard input
  const handleKeypress = (key: string) => {
    switch (key.toLowerCase()) {
      case 'r':
        console.log('\\n\ud83d\udd04 Checking authentication...');
        checkAuthAndResolve();
        break;
      case 'o':
        console.log('\\n\ud83c\udf10 Opening browser again...');
        open(frontendUrl).catch(() => console.log('\u26a0\ufe0f  Failed to open browser'));
        break;
      case 'h':
        console.log('\\n\ud83d\udcda Help:');
        console.log('  1. Visit the URL in your browser');
        console.log('  2. Sign in with your credentials');
        console.log('  3. The CLI will automatically detect authentication');
        showOptions();
        break;
      case 'q':
        console.log('\\n\ud83d\udc4b Goodbye!');
        rl.close();
        process.exit(0);
        break;
    }
  };
  
  // Set up keypress handler
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    const key = data.toString().trim();
    handleKeypress(key);
  });
  
  let resolved = false;
  
  let checkAuthAndResolve = async () => {
    if (resolved) return;
    
    try {
      const isAuth = await oauthManager.isAuthenticated();
      if (isAuth) {
        resolved = true;
        process.stdin.setRawMode(false);
        rl.close();
        console.log('\\n\ud83d\udd04 Authentication status confirmed!');
        return;
      }
    } catch (error) {
      // Continue waiting
    }
  };
  
  // Start the authentication flow in the OAuthManager
  try {
    await oauthManager.authenticate();
    resolved = true;
    process.stdin.setRawMode(false);
    rl.close();
    return;
  } catch (error) {
    // If direct authentication fails, fall back to polling
    console.log('\\n\ud83d\udd04 Switching to manual verification mode...');
    showOptions(); // Show options once at the beginning
    
    return new Promise<void>((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        if (resolved) {
          clearInterval(pollInterval);
          resolve();
          return;
        }
        
        waitTime++;
        showProgress();
        
        if (waitTime >= maxWaitTime) {
          clearInterval(pollInterval);
          process.stdin.setRawMode(false);
          rl.close();
          reject(new Error('Authentication timeout after 5 minutes'));
          return;
        }
        
        // Check auth every 5 seconds
        if (waitTime % 5 === 0) {
          await checkAuthAndResolve();
          if (resolved) {
            clearInterval(pollInterval);
            resolve();
          }
        }
      }, 1000);
      
      // Override the checkAuthAndResolve for this promise context
      const originalCheck = checkAuthAndResolve;
      checkAuthAndResolve = async () => {
        await originalCheck();
        if (resolved) {
          clearInterval(pollInterval);
          resolve();
        }
      };
    });
  }
}

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
    const oauthManager = new OAuthManager();
    
    let isAuthenticated = false;
    
    try {
      isAuthenticated = await oauthManager.isAuthenticated();
    } catch (error) {
      // Handle keychain errors gracefully
      const errorMsg = error.message || error.toString();
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
      
      if (options.dev) {
        // Interactive OAuth flow for dev mode
        console.log('\n🌐 Opening Graphyn login page...');
        console.log('👤 Please authenticate at: http://localhost:3000/auth/signin');
        
        await performInteractiveAuth(oauthManager, options.dev);
        console.log('✅ Authentication successful!');
      } else {
        console.log('\nPlease run: graphyn auth');
        return;
      }
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
    console.error('\n' + (error instanceof Error ? error.message : error) + '\n');
    
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
  const threads = await apiClient.listThreads();
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
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for agent team configuration'));
    }, 30000); // 30 second timeout

    const sseClient = createThreadSSEClient(threadId);
    
    sseClient.on('message', (event) => {
      try {
        if (event.type === 'message.completed' && event.data.content) {
          const content = event.data.content;
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const teamConfig = JSON.parse(jsonMatch[0]);
            if (teamConfig.agents && Array.isArray(teamConfig.agents)) {
              clearTimeout(timeout);
              sseClient.close();
              resolve(teamConfig);
              return;
            }
          }
        }
      } catch (error) {
        // Continue listening for other messages
      }
    });

    sseClient.on('error', (error) => {
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
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for task generation'));
    }, 60000); // 60 second timeout

    const sseClient = createThreadSSEClient(threadId);
    
    sseClient.on('message', (event) => {
      try {
        if (event.type === 'message.completed' && event.data.content) {
          const content = event.data.content;
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const taskResponse = JSON.parse(jsonMatch[0]);
            if (taskResponse.tasks && Array.isArray(taskResponse.tasks)) {
              clearTimeout(timeout);
              sseClient.close();
              resolve(taskResponse.tasks);
              return;
            }
          }
        }
      } catch (error) {
        // Continue listening for other messages
      }
    });

    sseClient.on('error', (error) => {
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
      console.log(chalk.red(`\n❌ Task failed: ${error instanceof Error ? error.message : error}\n`));
      
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
Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}
=== END CONTEXT ===\n`;
  }
}

async function getRecentlyModifiedFiles(repoPath: string): Promise<string[]> {
  const { execSync } = require('child_process');
  try {
    const output = execSync('git log --name-only --pretty=format: -10', {
      cwd: repoPath,
      encoding: 'utf-8'
    }).toString();
    
    const files = output
      .split('\n')
      .filter(line => line.trim() && !line.startsWith(' '))
      .filter((file, index, arr) => arr.indexOf(file) === index) // Unique files
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
  return new Promise(async (resolve, reject) => {
    // Build repository context without creating files
    const repoContext = await buildRepositoryContext(worktreePath);
    
    // Enhance prompt with repository context
    const enhancedPrompt = `${repoContext}

TASK: ${task.prompt}`;
    
    // Build Claude CLI command arguments with enhanced context
    const args = ['-p', enhancedPrompt];
    
    const allArgs = [...args];
      
    console.log(chalk.gray(`Executing: claude ${allArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}\n`));
    
    // Spawn Claude CLI process
    const claudeProcess = spawn('claude', allArgs, {
      cwd: worktreePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let hasOutput = false;
    
    // Stream stdout in real-time
    claudeProcess.stdout.on('data', (data) => {
      hasOutput = true;
      const text = data.toString();
      // Add slight indentation to distinguish from system output
      const indentedText = text.split('\n').map(line => 
        line.trim() ? `  ${line}` : line
      ).join('\n');
      process.stdout.write(indentedText);
    });
    
    // Handle stderr
    claudeProcess.stderr.on('data', (data) => {
      hasOutput = true;
      process.stderr.write(chalk.red(`  Error: ${data.toString()}`));
    });
    
    claudeProcess.on('close', (code) => {
      if (!hasOutput) {
        console.log(chalk.gray('  (No output from Claude CLI)'));
      }
      console.log(''); // Add spacing after task output
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });
    
    claudeProcess.on('error', (error) => {
      reject(new Error(`Failed to start Claude CLI: ${error.message}`));
    });
  });
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
  // Spawn terminal based on platform (no file context)
  if (process.platform === 'darwin') {
    // macOS: Use osascript with a much simpler approach
    // Write the command to a temp script file to avoid quote hell
    const tempScript = `/tmp/graphyn_task_${task.id}.sh`;
    const scriptContent = `#!/bin/bash
cd "${worktreePath}"
echo "Task: ${task.title}"
echo "Agent: ${task.agent}"
echo ""
claude -p "${task.prompt.replace(/"/g, '\\"')}"
`;
    
    await fs.writeFile(tempScript, scriptContent);
    await execAsync(`chmod +x ${tempScript}`);
    
    // Use AppleScript to run the script
    const script = `tell application "Terminal" to do script "bash ${tempScript}"`;
    await execAsync(`osascript -e '${script}'`);
    
    // Clean up temp script after a delay
    setTimeout(() => {
      fs.unlink(tempScript).catch(() => {});
    }, 5000);
  } else if (process.platform === 'win32') {
    // Windows: Use start command with proper escaping
    const claudeCmd = `claude -p "${task.prompt.replace(/"/g, '\\"')}"`;    
    const sanitizedTitleWin = task.title.replace(/"/g, '\\"');
    try {
      await execAsync(`start "Task: ${sanitizedTitleWin}" cmd /k "cd /d \"${worktreePath}\" && ${claudeCmd}"`);
    } catch (error) {
      console.error(`❌ Failed to spawn Windows terminal for task "${task.title}":`, error instanceof Error ? error.message : error);
      throw new Error(`Windows terminal spawn failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Linux: Try common terminal emulators  
    const claudeCmd = `claude -p '${task.prompt}'`;
    const terminals = ['gnome-terminal', 'konsole', 'xterm'];
    let terminalFound = false;
    
    for (const terminal of terminals) {
      try {
        await execAsync(`which ${terminal}`);
        const bashCommand = `cd '${worktreePath}' && echo 'Task: ${task.title}' && echo 'Agent: ${task.agent}' && echo '' && ${claudeCmd}; exec bash`;
        await execAsync(`${terminal} --title="Task: ${task.title}" -- bash -c "${bashCommand.replace(/"/g, '\\"')}"`);
        terminalFound = true;
        break;
      } catch {
        // Try next terminal
      }
    }
    
    if (!terminalFound) {
      console.error(`❌ No supported terminal emulator found for task "${task.title}"`);
      throw new Error('No supported terminal emulator found (tried: gnome-terminal, konsole, xterm)');
    }
  }
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
    console.log('⚠ Session cleanup encountered errors:', error instanceof Error ? error.message : error);
  }
}