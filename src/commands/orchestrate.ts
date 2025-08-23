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

const execAsync = promisify(exec);

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
  try {
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    GRAPHYN ORCHESTRATION                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    
    // 1. Check authentication
    process.stdout.write('Checking authentication... ');
    const oauthManager = new OAuthManager();
    const isAuthenticated = await oauthManager.isAuthenticated();
    
    if (!isAuthenticated) {
      console.log('✗ FAILED');
      console.log('\nPlease run: graphyn auth');
      process.exit(1);
    }

    const apiClient = new GraphynAPIClient();
    console.log('✓ AUTHENTICATED');

    // 2. Find or create agent team for this repository
    process.stdout.write('Setting up agent team... ');
    const agentTeam = await findOrCreateAgentTeam(options.repository, apiClient);
    console.log(`✓ READY (${agentTeam.agents.length} agents)`);

    // 3. Send query to thread and receive tasks
    process.stdout.write('Generating tasks... ');
    const tasks = await receiveTasksFromThread(agentTeam.threadId, options.query, apiClient);
    console.log(`✓ GENERATED (${tasks.length} tasks)`);

    // 4. Show tasks for approval (if interactive)
    let approvedTasks = tasks;
    if (options.interactive !== false) {
      console.log(''); // Add spacing before task selection
      approvedTasks = await selectTasks(tasks);
    }

    if (approvedTasks.length === 0) {
      console.log('\n⚠ No tasks selected. Exiting.\n');
      return;
    }

    // 5. Execute tasks with real-time streaming and feedback
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    EXECUTING TASKS                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    
    await executeTasksWithStreaming(approvedTasks, options.repository, options.query);
    
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                     EXECUTION COMPLETE                          │');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');

  } catch (error) {
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                         ERROR                                   │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.error('\n' + (error instanceof Error ? error.message : error) + '\n');
    process.exit(1);
  }
}

async function findOrCreateAgentTeam(repoPath: string, apiClient: GraphynAPIClient): Promise<AgentTeam> {
  // 1. Get repository context
  const analyzer = new RepositoryAnalyzer();
  const repoContext = await analyzer.analyze(repoPath);
  const repoName = path.basename(repoPath);

  // 2. Check for existing agent team thread
  let threads: any[] = [];
  try {
    threads = await apiClient.listThreads();
  } catch (error) {
    // Return a mock agent team for development (backend fallback)
    return {
      threadId: 'mock-thread-id',
      agents: [
        {
          name: 'fullstack-dev',
          role: 'Full Stack Developer', 
          capabilities: ['frontend', 'backend', 'database', 'api']
        },
        {
          name: 'devops-engineer',
          role: 'DevOps Engineer',
          capabilities: ['deployment', 'ci-cd', 'monitoring', 'infrastructure']
        }
      ]
    };
  }
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
  // If using mock thread, generate tasks locally
  if (threadId === 'mock-thread-id') {
    return generateMockTasks(query);
  }

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

function generateMockTasks(query: string): Task[] {
  // Generate some realistic tasks based on the query
  const tasks: Task[] = [
    {
      id: 'task-001',
      title: 'Analyze current codebase structure',
      description: `Understand the existing codebase architecture and identify key components related to: "${query}"`,
      agent: 'fullstack-dev',
      prompt: `Analyze the current codebase structure and provide insights about: ${query}. Look at the file structure, dependencies, and existing patterns.`,
      estimated_time: '15 minutes'
    },
    {
      id: 'task-002', 
      title: 'Plan implementation approach',
      description: `Create a detailed implementation plan for: "${query}"`,
      agent: 'fullstack-dev',
      prompt: `Create a step-by-step implementation plan for: ${query}. Consider the existing codebase, dependencies, and best practices.`,
      estimated_time: '20 minutes'
    }
  ];

  // Add a third task if the query seems complex
  if (query.length > 30) {
    tasks.push({
      id: 'task-003',
      title: 'Implementation and testing',
      description: `Implement the solution for: "${query}" with proper testing`,
      agent: 'fullstack-dev', 
      prompt: `Implement the solution for: ${query}. Write clean, well-documented code and include appropriate tests.`,
      estimated_time: '45 minutes'
    });
  }

  return tasks;
}

async function executeTasksWithStreaming(tasks: Task[], repoPath: string, originalQuery: string): Promise<void> {
  let currentTasks = [...tasks];
  let currentIndex = 0;
  
  while (currentIndex < currentTasks.length) {
    const task = currentTasks[currentIndex];
    const remainingTasks = currentTasks.slice(currentIndex + 1);
    
    console.log(`\n${chalk.cyan('┌')}${'─'.repeat(65)}${chalk.cyan('┐')}`);
    console.log(`${chalk.cyan('│')} ${chalk.bold(`Task ${currentIndex + 1}: ${task.title}`)}${' '.repeat(Math.max(0, 65 - task.title.length - 9))}${chalk.cyan('│')}`);
    console.log(`${chalk.cyan('│')} ${chalk.gray(`Agent: ${task.agent} | Estimated: ${task.estimated_time}`)}${' '.repeat(Math.max(0, 65 - task.agent.length - (task.estimated_time?.length || 0) - 25))}${chalk.cyan('│')}`);
    console.log(`${chalk.cyan('└')}${'─'.repeat(65)}${chalk.cyan('┘')}\n`);

    try {
      // Create git worktree for this task
      const { worktreePath } = await createWorktree(task.id, repoPath);
      
      // Execute Claude CLI with real-time streaming
      await executeClaudeWithStreaming(task, worktreePath);
      
      // Ask for feedback after each task
      const feedback = await getFeedbackForTask(task, currentIndex + 1, currentTasks.length, remainingTasks);
      
      if (feedback.action === 'modify' && feedback.modifiedTasks) {
        console.log(chalk.green('\n✓ Tasks updated successfully!\n'));
        // Replace remaining tasks with modified ones
        currentTasks = [
          ...currentTasks.slice(0, currentIndex + 1), // Keep completed tasks
          ...feedback.modifiedTasks // Use modified remaining tasks
        ];
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
  return new Promise((resolve, reject) => {
    // Check if agent context file exists
    const agentPath = path.join(worktreePath, '.claude', 'agents', `${task.agent}.md`);
    const agentContextFlag = fs.access(agentPath).then(() => [`--context`, agentPath]).catch(() => []);
    
    // Build Claude CLI command arguments
    const args = ['-p', task.prompt];
    
    Promise.resolve(agentContextFlag).then(contextArgs => {
      const allArgs = [...args, ...contextArgs];
      
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
  // Check if agent context file exists
  const agentPath = path.join(worktreePath, '.claude', 'agents', `${task.agent}.md`);
  const agentContextFlag = await fs.access(agentPath).then(() => `--context ${agentPath}`).catch(() => '');
  
  // Spawn terminal based on platform
  if (process.platform === 'darwin') {
    // macOS: Use osascript with a much simpler approach
    // Write the command to a temp script file to avoid quote hell
    const tempScript = `/tmp/graphyn_task_${task.id}.sh`;
    const scriptContent = `#!/bin/bash
cd "${worktreePath}"
echo "Task: ${task.title}"
echo "Agent: ${task.agent}"
echo ""
claude -p "${task.prompt.replace(/"/g, '\\"')}" ${agentContextFlag}
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
    const claudeCmd = `claude -p "${task.prompt.replace(/"/g, '\\"')}" ${agentContextFlag}`;
    const sanitizedTitleWin = task.title.replace(/"/g, '\\"');
    try {
      await execAsync(`start "Task: ${sanitizedTitleWin}" cmd /k "cd /d \"${worktreePath}\" && ${claudeCmd}"`);
    } catch (error) {
      console.error(`❌ Failed to spawn Windows terminal for task "${task.title}":`, error instanceof Error ? error.message : error);
      throw new Error(`Windows terminal spawn failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Linux: Try common terminal emulators  
    const claudeCmd = `claude -p '${task.prompt}' ${agentContextFlag}`;
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