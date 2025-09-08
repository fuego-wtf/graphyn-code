/**
 * REV-071: Approval Workflow Panel - Middle Panel (20% of screen)
 * 
 * Manages the task decomposition display and approval interface
 * for user interaction with planned execution tasks.
 */

import { EventEmitter } from 'events';
import { ANSIController } from './ANSIController.js';
import { PanelConfiguration } from './TerminalLayoutManager.js';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  estimatedDuration: number; // in minutes
  dependencies: string[];
  status: TaskStatus;
  priority: TaskPriority;
  tools?: string[];
  expectedOutputs?: string[];
}

export enum TaskStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TaskDecomposition {
  id: string;
  originalQuery: string;
  tasks: Task[];
  estimatedTotalDuration: number;
  confidence: number;
  riskFactors: RiskFactor[];
}

export interface RiskFactor {
  type: 'complexity' | 'dependency' | 'resource' | 'time';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ApprovalState {
  selectedTaskIndex: number;
  approvedTasks: Set<string>;
  mode: 'selection' | 'approval' | 'execution' | 'complete';
}

export class ApprovalWorkflowPanel extends EventEmitter {
  private panelConfig: PanelConfiguration;
  private currentDecomposition?: TaskDecomposition;
  private approvalState: ApprovalState = {
    selectedTaskIndex: 0,
    approvedTasks: new Set(),
    mode: 'selection'
  };
  
  // Display configuration
  private showDetails: boolean = false;
  private animationFrame: number = 0;
  private animationTimer?: NodeJS.Timeout;

  constructor(panelConfig: PanelConfiguration) {
    super();
    this.panelConfig = panelConfig;
  }

  /**
   * Update panel configuration (e.g., after terminal resize)
   */
  updatePanelConfig(config: PanelConfiguration): void {
    this.panelConfig = config;
    this.render();
  }

  /**
   * Display task decomposition for approval
   */
  displayTaskDecomposition(decomposition: TaskDecomposition): void {
    this.currentDecomposition = decomposition;
    this.approvalState = {
      selectedTaskIndex: 0,
      approvedTasks: new Set(),
      mode: 'selection'
    };
    
    this.render();
    this.startAnimation();
    this.emit('decompositionDisplayed', decomposition);
  }

  /**
   * Navigate through tasks
   */
  navigateTask(direction: 'up' | 'down'): void {
    if (!this.currentDecomposition || this.currentDecomposition.tasks.length === 0) {
      return;
    }
    
    const maxIndex = this.currentDecomposition.tasks.length - 1;
    
    if (direction === 'up') {
      this.approvalState.selectedTaskIndex = Math.max(0, this.approvalState.selectedTaskIndex - 1);
    } else {
      this.approvalState.selectedTaskIndex = Math.min(maxIndex, this.approvalState.selectedTaskIndex + 1);
    }
    
    this.render();
    this.emit('taskSelectionChanged', this.approvalState.selectedTaskIndex);
  }

  /**
   * Toggle approval for currently selected task
   */
  toggleTaskApproval(): void {
    if (!this.currentDecomposition) {
      return;
    }
    
    const selectedTask = this.currentDecomposition.tasks[this.approvalState.selectedTaskIndex];
    if (!selectedTask) {
      return;
    }
    
    if (this.approvalState.approvedTasks.has(selectedTask.id)) {
      this.approvalState.approvedTasks.delete(selectedTask.id);
    } else {
      this.approvalState.approvedTasks.add(selectedTask.id);
    }
    
    this.render();
    this.emit('taskApprovalToggled', {
      taskId: selectedTask.id,
      approved: this.approvalState.approvedTasks.has(selectedTask.id)
    });
  }

  /**
   * Approve all tasks
   */
  approveAllTasks(): void {
    if (!this.currentDecomposition) {
      return;
    }
    
    this.approvalState.approvedTasks.clear();
    this.currentDecomposition.tasks.forEach(task => {
      this.approvalState.approvedTasks.add(task.id);
    });
    
    this.render();
    this.emit('allTasksApproved', Array.from(this.approvalState.approvedTasks));
  }

  /**
   * Clear all approvals
   */
  clearAllApprovals(): void {
    this.approvalState.approvedTasks.clear();
    this.render();
    this.emit('allApprovalsCleared');
  }

  /**
   * Set approval mode
   */
  setApprovalMode(mode: ApprovalState['mode']): void {
    this.approvalState.mode = mode;
    this.render();
    this.emit('approvalModeChanged', mode);
  }

  /**
   * Toggle details view
   */
  toggleDetails(): void {
    this.showDetails = !this.showDetails;
    this.render();
  }

  /**
   * Get current approval statistics
   */
  getApprovalStats() {
    if (!this.currentDecomposition) {
      return { total: 0, approved: 0, pending: 0 };
    }
    
    const total = this.currentDecomposition.tasks.length;
    const approved = this.approvalState.approvedTasks.size;
    const pending = total - approved;
    
    return { total, approved, pending };
  }

  /**
   * Start animation for progress indicators
   */
  startAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
    }
    
    this.animationTimer = setInterval(() => {
      this.animationFrame = (this.animationFrame + 1) % 4;
      
      if (this.approvalState.mode === 'execution') {
        this.render();
      }
    }, 500); // Update every 500ms for smooth animation
  }

  /**
   * Stop animation
   */
  stopAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = undefined;
    }
  }

  /**
   * Main render method
   */
  render(): void {
    let output = '';
    
    // Clear the panel area
    output += this.clearPanelArea();
    
    // Render based on current mode
    switch (this.approvalState.mode) {
      case 'selection':
        output += this.renderTaskSelection();
        break;
      case 'approval':
        output += this.renderApprovalInterface();
        break;
      case 'execution':
        output += this.renderExecutionProgress();
        break;
      case 'complete':
        output += this.renderCompletionSummary();
        break;
    }
    
    // Write to stdout
    process.stdout.write(output);
  }

  /**
   * Clear the panel area
   */
  private clearPanelArea(): string {
    return ANSIController.clearRegion(
      this.panelConfig.startRow,
      this.panelConfig.endRow,
      this.panelConfig.startCol,
      this.panelConfig.endCol
    );
  }

  /**
   * Render task selection interface
   */
  private renderTaskSelection(): string {
    let output = '';
    
    // Render border with title
    output += ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      '📋 Task Decomposition'
    );
    
    if (!this.currentDecomposition) {
      // No tasks to display
      const row = this.panelConfig.startRow + Math.floor(this.panelConfig.height / 2);
      output += ANSIController.moveCursor(row, this.panelConfig.startCol! + 2);
      output += ANSIController.positionText(
        ANSIController.color('No tasks available', { foreground: 'gray' }),
        this.panelConfig.width - 4,
        'center'
      );
      return output;
    }
    
    // Render task list
    const contentStartRow = this.panelConfig.startRow + 1;
    const availableHeight = this.panelConfig.height - 2; // Account for borders
    const contentWidth = this.panelConfig.width - 4;
    
    // Header with summary
    output += ANSIController.moveCursor(contentStartRow, this.panelConfig.startCol! + 2);
    const stats = this.getApprovalStats();
    const headerText = `${stats.total} tasks, ~${this.currentDecomposition.estimatedTotalDuration}min`;
    output += ANSIController.positionText(headerText, contentWidth, 'left');
    
    // Render visible tasks
    const maxTaskLines = availableHeight - 2; // Header and controls
    const visibleTasks = this.currentDecomposition.tasks.slice(0, maxTaskLines);
    
    visibleTasks.forEach((task, index) => {
      const row = contentStartRow + 1 + index;
      const isSelected = index === this.approvalState.selectedTaskIndex;
      const isApproved = this.approvalState.approvedTasks.has(task.id);
      
      output += ANSIController.moveCursor(row, this.panelConfig.startCol! + 2);
      output += this.formatTaskLine(task, isSelected, isApproved, contentWidth);
    });
    
    // Render controls at bottom
    const controlsRow = this.panelConfig.endRow - 1;
    output += ANSIController.moveCursor(controlsRow, this.panelConfig.startCol! + 2);
    const controls = '[SPACE] Toggle [A] Approve All [M] Modify [F] Feedback [C] Cancel';
    output += ANSIController.positionText(
      ANSIController.color(controls, { foreground: 'gray' }),
      contentWidth,
      'center'
    );
    
    return output;
  }

  /**
   * Render approval interface
   */
  private renderApprovalInterface(): string {
    let output = '';
    
    // Render border
    output += ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      '✅ Approval Required'
    );
    
    const contentStartRow = this.panelConfig.startRow + 1;
    const contentWidth = this.panelConfig.width - 4;
    
    // Approval summary
    output += ANSIController.moveCursor(contentStartRow, this.panelConfig.startCol! + 2);
    const stats = this.getApprovalStats();
    const summaryText = `📋 Execution Plan Ready: ${stats.approved}/${stats.total} tasks approved`;
    output += ANSIController.positionText(summaryText, contentWidth, 'left');
    
    // Action buttons
    output += ANSIController.moveCursor(contentStartRow + 1, this.panelConfig.startCol! + 2);
    const buttons = '[A] Approve All    [M] Modify Plan    [F] Feedback    [C] Cancel';
    output += ANSIController.positionText(buttons, contentWidth, 'center');
    
    // Agent readiness
    output += ANSIController.moveCursor(contentStartRow + 2, this.panelConfig.startCol! + 2);
    const agentInfo = this.getAgentReadinessInfo();
    output += ANSIController.positionText(agentInfo, contentWidth, 'left');
    
    // Execution estimate
    output += ANSIController.moveCursor(contentStartRow + 3, this.panelConfig.startCol! + 2);
    const estimate = `⏱️  Estimated execution: ${this.currentDecomposition?.estimatedTotalDuration || 0} minutes`;
    output += ANSIController.positionText(estimate, contentWidth, 'left');
    
    // Call to action
    if (stats.approved > 0) {
      output += ANSIController.moveCursor(contentStartRow + 4, this.panelConfig.startCol! + 2);
      const actionText = ANSIController.color('💡 Press [A] to start parallel execution across all agents', { foreground: 'green' });
      output += ANSIController.positionText(actionText, contentWidth, 'left');
    }
    
    return output;
  }

  /**
   * Render execution progress
   */
  private renderExecutionProgress(): string {
    let output = '';
    
    // Render border
    output += ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      '⚡ Live Execution'
    );
    
    const contentStartRow = this.panelConfig.startRow + 1;
    const contentWidth = this.panelConfig.width - 4;
    
    if (!this.currentDecomposition) {
      return output;
    }
    
    // Execution status
    output += ANSIController.moveCursor(contentStartRow, this.panelConfig.startCol! + 2);
    output += ANSIController.positionText('⚡ Executing in Parallel', contentWidth, 'left');
    
    // Progress for each approved task
    const approvedTasks = this.currentDecomposition.tasks.filter(task => 
      this.approvalState.approvedTasks.has(task.id)
    );
    
    approvedTasks.slice(0, 3).forEach((task, index) => { // Show up to 3 tasks
      const row = contentStartRow + 1 + index;
      output += ANSIController.moveCursor(row, this.panelConfig.startCol! + 2);
      
      // Simulate progress (in real implementation, this would come from actual execution)
      const progress = Math.min(1, (this.animationFrame * 0.25) + (index * 0.1));
      const progressBar = ANSIController.createProgressBar(progress, 15, '█', '▓', true);
      
      const taskInfo = `@${task.assignedAgent} ${progressBar} ${task.title.substring(0, 20)}...`;
      output += ANSIController.positionText(taskInfo, contentWidth, 'left');
    });
    
    // Overall progress
    const overallRow = this.panelConfig.endRow - 2;
    output += ANSIController.moveCursor(overallRow, this.panelConfig.startCol! + 2);
    const overallProgress = Math.min(1, this.animationFrame * 0.25);
    const overallBar = ANSIController.createProgressBar(overallProgress, 20, '█', '▓', true);
    output += ANSIController.positionText(`📊 Progress: ${overallBar}`, contentWidth, 'left');
    
    // Controls
    const controlsRow = this.panelConfig.endRow - 1;
    output += ANSIController.moveCursor(controlsRow, this.panelConfig.startCol! + 2);
    const controls = '[⏹️  Stop All] [⏸️  Pause] [📋 View Details]';
    output += ANSIController.positionText(
      ANSIController.color(controls, { foreground: 'gray' }),
      contentWidth,
      'center'
    );
    
    return output;
  }

  /**
   * Render completion summary
   */
  private renderCompletionSummary(): string {
    let output = '';
    
    // Render border
    output += ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      '✅ Execution Complete'
    );
    
    const contentStartRow = this.panelConfig.startRow + 1;
    const contentWidth = this.panelConfig.width - 4;
    
    // Success message
    output += ANSIController.moveCursor(contentStartRow, this.panelConfig.startCol! + 2);
    output += ANSIController.positionText(
      ANSIController.color('🎉 All tasks completed successfully!', { foreground: 'green' }),
      contentWidth,
      'center'
    );
    
    // Stats
    if (this.currentDecomposition) {
      output += ANSIController.moveCursor(contentStartRow + 1, this.panelConfig.startCol! + 2);
      const stats = `📊 ${this.currentDecomposition.tasks.length} tasks • ${this.currentDecomposition.estimatedTotalDuration}min estimated`;
      output += ANSIController.positionText(stats, contentWidth, 'center');
    }
    
    return output;
  }

  /**
   * Format a single task line for display
   */
  private formatTaskLine(task: Task, isSelected: boolean, isApproved: boolean, maxWidth: number): string {
    // Selection indicator
    const selector = isSelected ? '▶ ' : '  ';
    
    // Approval indicator
    const approval = isApproved ? '✅' : '☐ ';
    
    // Priority indicator
    let priorityColor: any = {};
    switch (task.priority) {
      case TaskPriority.CRITICAL:
        priorityColor = { foreground: 'red' };
        break;
      case TaskPriority.HIGH:
        priorityColor = { foreground: 'yellow' };
        break;
      case TaskPriority.NORMAL:
        priorityColor = { foreground: 'white' };
        break;
      case TaskPriority.LOW:
        priorityColor = { foreground: 'gray' };
        break;
    }
    
    // Format: selector approval @agent title (duration)
    const agentBadge = `@${task.assignedAgent}`;
    const duration = `${task.estimatedDuration}min`;
    const prefix = `${selector}${approval}${agentBadge} `;
    const suffix = ` (${duration})`;
    
    const availableWidth = maxWidth - ANSIController.stripAnsi(prefix).length - suffix.length;
    let title = task.title;
    
    if (title.length > availableWidth) {
      title = title.substring(0, availableWidth - 3) + '...';
    }
    
    const line = prefix + title + suffix;
    
    // Apply selection highlighting
    if (isSelected) {
      return ANSIController.color(line, { background: 'blue', foreground: 'white' });
    } else {
      return ANSIController.color(line, priorityColor);
    }
  }

  /**
   * Get agent readiness information
   */
  private getAgentReadinessInfo(): string {
    if (!this.currentDecomposition) {
      return '';
    }
    
    // Count tasks per agent
    const agentTaskCount = new Map<string, number>();
    this.currentDecomposition.tasks.forEach(task => {
      if (this.approvalState.approvedTasks.has(task.id)) {
        const count = agentTaskCount.get(task.assignedAgent) || 0;
        agentTaskCount.set(task.assignedAgent, count + 1);
      }
    });
    
    const agentInfo = Array.from(agentTaskCount.entries())
      .map(([agent, count]) => `@${agent} (${count} tasks)`)
      .join(' ');
    
    return `⚡ Agents Ready: ${agentInfo}`;
  }

  /**
   * Get current state
   */
  getState(): ApprovalState & { decomposition?: TaskDecomposition } {
    return {
      ...this.approvalState,
      decomposition: this.currentDecomposition
    };
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.stopAnimation();
    this.currentDecomposition = undefined;
    this.removeAllListeners();
  }
}