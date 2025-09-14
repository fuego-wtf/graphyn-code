/**
 * Human Approval Checkpoint - Interactive task plan validation
 * 
 * Provides human-in-the-loop control to prevent over-engineered decompositions.
 * Users can approve, simplify, modify, or cancel generated task plans before execution.
 */

import { createInterface } from 'readline';
import { TaskNode } from './types.js';
import { QueryClassification } from './QueryClassifier.js';

export enum ApprovalResult {
  APPROVE = 'approve',
  SIMPLIFY = 'simplify',
  MODIFY = 'modify',
  CANCEL = 'cancel'
}

export interface ApprovalResponse {
  result: ApprovalResult;
  modifiedTasks?: TaskNode[];
  feedback?: string;
}

/**
 * Interactive approval system for task plans
 */
export class ApprovalCheckpoint {
  private readonly readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  /**
   * Request user approval for generated task plan
   */
  async requestApproval(
    tasks: TaskNode[], 
    classification: QueryClassification,
    originalQuery: string
  ): Promise<ApprovalResponse> {
    
    console.log('\n📋 Generated Plan:');
    this.displayTaskPlan(tasks, classification);
    
    // Check for suspicious decomposition
    const warnings = this.detectSuspiciousDecomposition(tasks, originalQuery, classification);
    if (warnings.length > 0) {
      console.log('\n⚠️  Potential Issues Detected:');
      warnings.forEach(warning => console.log(`   ${warning}`));
    }

    console.log('\n🤔 How would you like to proceed?');
    console.log('   [A] Approve and execute');
    console.log('   [S] Simplify plan');
    console.log('   [M] Modify tasks');
    console.log('   [C] Cancel');

    const response = await this.getUserChoice();
    
    switch (response.toLowerCase()) {
      case 'a':
      case 'approve':
        return { result: ApprovalResult.APPROVE };
      
      case 's':
      case 'simplify':
        const simplifiedTasks = this.suggestSimplification(tasks, originalQuery);
        return { 
          result: ApprovalResult.SIMPLIFY, 
          modifiedTasks: simplifiedTasks,
          feedback: 'Plan simplified to reduce complexity'
        };
      
      case 'm':
      case 'modify':
        const modifiedTasks = await this.requestModifications(tasks);
        return { 
          result: ApprovalResult.MODIFY, 
          modifiedTasks,
          feedback: 'Plan modified by user'
        };
      
      case 'c':
      case 'cancel':
        return { result: ApprovalResult.CANCEL };
      
      default:
        console.log('Invalid choice. Canceling...');
        return { result: ApprovalResult.CANCEL };
    }
  }

  /**
   * Display task plan in a user-friendly format
   */
  private displayTaskPlan(tasks: TaskNode[], classification: QueryClassification): void {
    const totalMinutes = tasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0);
    
    console.log(`┌${'─'.repeat(60)}┐`);
    console.log(`│ Tasks: ${tasks.length.toString().padEnd(8)} | Est. Time: ${totalMinutes}min${' '.repeat(60 - 32)}│`);
    console.log(`│ Complexity: ${classification.complexity.toString().padEnd(45)}│`);
    console.log(`├${'─'.repeat(60)}┤`);
    
    tasks.forEach((task, index) => {
      const taskLine = `│ ${(index + 1)}. ${task.title}`;
      const agentInfo = `(@${task.assignedAgent || 'unassigned'})`;
      const timeInfo = `${task.estimatedDuration || 0}min`;
      
      const padding = Math.max(0, 60 - taskLine.length - agentInfo.length - timeInfo.length - 1);
      console.log(`${taskLine}${' '.repeat(padding)}${agentInfo} ${timeInfo}│`);
      
      if (task.description && task.description !== task.title) {
        const description = `│    ${task.description.slice(0, 54)}`;
        console.log(`${description}${' '.repeat(60 - description.length)}│`);
      }
    });
    
    console.log(`└${'─'.repeat(60)}┘`);
  }

  /**
   * Detect potentially over-engineered or problematic decompositions
   */
  private detectSuspiciousDecomposition(
    tasks: TaskNode[], 
    originalQuery: string, 
    classification: QueryClassification
  ): string[] {
    const warnings: string[] = [];

    // Check for over-engineering signals
    if (originalQuery.toLowerCase().includes('hello world') && tasks.length > 1) {
      warnings.push('Hello world typically requires only one task');
    }

    if (originalQuery.toLowerCase().includes('simple') && tasks.length > 2) {
      warnings.push('Simple tasks usually need 1-2 steps');
    }

    if (originalQuery.length < 30 && tasks.length > 3) {
      warnings.push('Short queries rarely need complex decomposition');
    }

    // Check time estimates
    const totalTime = tasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0);
    if (totalTime > 30 && originalQuery.toLowerCase().includes('quick')) {
      warnings.push('Time estimate seems high for a "quick" task');
    }

    // Check for redundant tasks
    const taskTitles = tasks.map(t => t.title.toLowerCase());
    if (taskTitles.includes('analyze requirements') && taskTitles.includes('system design')) {
      warnings.push('Requirements analysis and system design may be redundant');
    }

    // Check agent assignments
    const agentCounts = tasks.reduce((counts, task) => {
      const agent = task.assignedAgent || 'unassigned';
      counts[agent] = (counts[agent] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    if (Object.keys(agentCounts).length > 4 && originalQuery.length < 50) {
      warnings.push('Many agents assigned for a simple query');
    }

    return warnings;
  }

  /**
   * Suggest simplified version of task plan
   */
  private suggestSimplification(tasks: TaskNode[], originalQuery: string): TaskNode[] {
    // For hello world, force single task
    if (originalQuery.toLowerCase().includes('hello world')) {
      return [{
        id: 'simple_task_1',
        title: 'Create Python hello world script',
        description: 'Create a simple hello.py file with print("Hello, World!")',
        assignedAgent: 'assistant',
        estimatedDuration: 1,
        tools: ['Write'],
        expectedOutputs: ['hello.py file'],
        dependencies: [],
        status: tasks[0]?.status || 'PENDING' as any,
        priority: 'NORMAL' as any, 
        createdAt: new Date(),
        metadata: { 
          priority: 1,
          tags: ['simple', 'python'], 
          gitBranch: null,
          worktreePath: null
        }
      }];
    }

    // For other cases, reduce to essential tasks only
    const essentialTasks = tasks.filter(task => {
      const title = task.title.toLowerCase();
      // Keep implementation tasks, skip analysis/design for simple queries
      return !title.includes('analyze') && 
             !title.includes('documentation') &&
             !title.includes('review');
    });

    // Ensure at least one task remains
    if (essentialTasks.length === 0) {
      return [tasks[0]];
    }

    // Reduce time estimates
    return essentialTasks.map(task => ({
      ...task,
      estimatedDuration: Math.max(1, Math.ceil((task.estimatedDuration || 1) / 2))
    }));
  }

  /**
   * Allow user to interactively modify the task plan
   */
  private async requestModifications(tasks: TaskNode[]): Promise<TaskNode[]> {
    console.log('\n✏️  Task Modification Options:');
    console.log('   1. Remove specific tasks');
    console.log('   2. Change time estimates');
    console.log('   3. Reassign agents');
    console.log('   4. Keep original plan');

    const choice = await this.getUserInput('Choose option (1-4): ');
    
    switch (choice) {
      case '1':
        return await this.removeTasksInteractively(tasks);
      case '2':
        return await this.adjustTimeEstimates(tasks);
      case '3':
        return await this.reassignAgents(tasks);
      default:
        return tasks;
    }
  }

  /**
   * Remove tasks interactively
   */
  private async removeTasksInteractively(tasks: TaskNode[]): Promise<TaskNode[]> {
    console.log('\nSelect tasks to KEEP (comma-separated numbers):');
    tasks.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.title}`);
    });

    const input = await this.getUserInput('Keep tasks: ');
    const keepIndices = input.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < tasks.length);
    
    if (keepIndices.length === 0) {
      console.log('No valid tasks selected. Keeping all tasks.');
      return tasks;
    }

    return keepIndices.map(i => tasks[i]);
  }

  /**
   * Adjust time estimates interactively
   */
  private async adjustTimeEstimates(tasks: TaskNode[]): Promise<TaskNode[]> {
    const multiplierInput = await this.getUserInput('Adjust time estimates by factor (0.5 = half time, 2.0 = double): ');
    const multiplier = parseFloat(multiplierInput) || 1.0;

    return tasks.map(task => ({
      ...task,
      estimatedDuration: Math.max(1, Math.round((task.estimatedDuration || 1) * multiplier))
    }));
  }

  /**
   * Reassign agents interactively
   */
  private async reassignAgents(tasks: TaskNode[]): Promise<TaskNode[]> {
    const availableAgents = ['assistant', 'architect', 'backend', 'frontend', 'tester', 'researcher'];
    
    console.log('\nAvailable agents:', availableAgents.join(', '));
    const agentInput = await this.getUserInput('Assign all tasks to which agent? ');
    
    if (availableAgents.includes(agentInput)) {
      return tasks.map(task => ({
        ...task,
        assignedAgent: agentInput
      }));
    }

    console.log('Invalid agent. Keeping original assignments.');
    return tasks;
  }

  /**
   * Get user input with readline
   */
  private getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.readline.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Get user choice for main approval decision
   */
  private getUserChoice(): Promise<string> {
    return this.getUserInput('\nYour choice: ');
  }

  /**
   * Cleanup readline interface
   */
  cleanup(): void {
    this.readline.close();
  }
}
