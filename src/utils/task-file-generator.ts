import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Task } from '../services/claude-task-generator.js';

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
}

export async function generateAgentTaskFile(
  agent: AgentConfig,
  tasks: Task[],
  sessionId: string,
  agentGroupName: string
): Promise<string> {
  const taskContent = generateTaskContent(agent, tasks, agentGroupName, sessionId);
  
  // Create temp directory for agent session
  const tempDir = path.join(os.tmpdir(), 'graphyn-agents', sessionId);
  await fs.mkdir(tempDir, { recursive: true });
  
  // Generate filename
  const filename = path.join(tempDir, `${agent.id}_tasks.md`);
  
  // Write task file
  await fs.writeFile(filename, taskContent, 'utf8');
  
  return filename;
}

function generateTaskContent(
  agent: AgentConfig,
  tasks: Task[],
  agentGroupName: string,
  sessionId: string
): string {
  const content = [];
  
  // Header
  content.push(`# ${agent.emoji} ${agent.name} - Task List`);
  content.push(`## Agent Group: ${agentGroupName}`);
  content.push(`## Role: ${agent.role}`);
  content.push('');
  content.push('---');
  content.push('');
  
  // System prompt section
  content.push('## Your Identity');
  content.push('```');
  content.push(agent.systemPrompt);
  content.push('```');
  content.push('');
  
  // Tasks section
  content.push(`## Assigned Tasks (${tasks.length} total)`);
  content.push('');
  
  if (tasks.length === 0) {
    content.push('*No tasks assigned yet. Waiting for task assignment...*');
  } else {
    // Group tasks by status
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    if (pendingTasks.length > 0) {
      content.push('### 📋 Pending Tasks');
      content.push('');
      pendingTasks.forEach((task, idx) => {
        content.push(`#### ${idx + 1}. ${task.title}`);
        if (task.description) {
          content.push(`   ${task.description}`);
        }
        if (task.dependencies && task.dependencies.length > 0) {
          content.push(`   **Dependencies:** ${task.dependencies.join(', ')}`);
        }
        content.push('');
      });
    }
    
    if (inProgressTasks.length > 0) {
      content.push('### 🔄 In Progress');
      content.push('');
      inProgressTasks.forEach((task, idx) => {
        content.push(`#### ${idx + 1}. ${task.title}`);
        if (task.description) {
          content.push(`   ${task.description}`);
        }
        content.push('');
      });
    }
    
    if (completedTasks.length > 0) {
      content.push('### ✅ Completed');
      content.push('');
      completedTasks.forEach((task, idx) => {
        content.push(`#### ${idx + 1}. ~~${task.title}~~`);
        if ((task as any).output) {
          content.push(`   **Output:** ${(task as any).output}`);
        }
        content.push('');
      });
    }
  }
  
  // Coordination section
  content.push('## Agent Coordination');
  content.push('');
  content.push('You are working as part of an agent team. Remember to:');
  content.push('- Communicate progress on tasks');
  content.push('- Ask for help when blocked');
  content.push('- Share important findings with the team');
  content.push('- Update task status as you work');
  content.push('');
  
  // Footer
  content.push('---');
  content.push(`Generated at: ${new Date().toISOString()}`);
  content.push(`Session ID: ${sessionId}`);
  
  return content.join('\n');
}

export async function generateSystemPromptFile(
  agent: AgentConfig,
  sessionId: string
): Promise<string> {
  // Create temp directory for agent session
  const tempDir = path.join(os.tmpdir(), 'graphyn-agents', sessionId);
  await fs.mkdir(tempDir, { recursive: true });
  
  // Generate filename
  const filename = path.join(tempDir, `${agent.id}_system.txt`);
  
  // Write system prompt
  await fs.writeFile(filename, agent.systemPrompt, 'utf8');
  
  return filename;
}