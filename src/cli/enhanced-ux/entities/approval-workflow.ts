import type { ApprovalAction, ApprovalStatus } from '../types.js';

export class ApprovalWorkflow {
  public readonly decompositionId: string;
  public readonly estimatedExecutionTime: number;
  public readonly createdAt: Date;
  public approvedAt?: Date;
  public status: ApprovalStatus = 'pending';

  private readonly taskIds: string[];
  private readonly selectedTaskIds = new Set<string>();
  private readonly actionHistory: Array<{ action: ApprovalAction; taskId?: string; at: Date }> = [];

  constructor(decompositionId: string, taskIds: string[], estimatedExecutionTime: number) {
    this.decompositionId = decompositionId;
    this.taskIds = [...taskIds];
    this.estimatedExecutionTime = estimatedExecutionTime;
    this.createdAt = new Date();
  }

  public selectTask(taskId: string): void {
    this.assertKnownTask(taskId);
    this.selectedTaskIds.add(taskId);
    this.recordAction('approve', taskId);
  }

  public deselectTask(taskId: string): void {
    this.selectedTaskIds.delete(taskId);
    this.recordAction('reject', taskId);
  }

  public isTaskSelected(taskId: string): boolean {
    return this.selectedTaskIds.has(taskId);
  }

  public approve(): void {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.recordAction('approve');
  }

  public reject(): void {
    this.status = 'rejected';
    this.recordAction('reject');
  }

  public cancel(): void {
    this.status = 'cancelled';
    this.recordAction('cancel');
  }

  public getSelectedTaskIds(): string[] {
    return [...this.selectedTaskIds];
  }

  public getTaskIds(): string[] {
    return [...this.taskIds];
  }

  public getActionHistory(): Array<{ action: ApprovalAction; taskId?: string; at: Date }> {
    return this.actionHistory.map(entry => ({ ...entry }));
  }

  private assertKnownTask(taskId: string): void {
    if (!this.taskIds.includes(taskId)) {
      throw new Error(`Unknown task: ${taskId}`);
    }
  }

  private recordAction(action: ApprovalAction, taskId?: string): void {
    this.actionHistory.push({ action, taskId, at: new Date() });
  }
}
