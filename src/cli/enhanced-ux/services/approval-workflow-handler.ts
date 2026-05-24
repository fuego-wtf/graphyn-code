import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type {
  ApprovalDecisionInput,
  ApprovalDecisionRecord,
  ApprovalDecisionStatus,
  ApprovalState,
  EnhancedUXConfig,
  KeyboardAction,
  TaskDecompositionResult,
  TaskItem,
  TaskStatus
} from '../types.js';

export interface ApprovalWorkflowHandlerOptions {
  storageDirectory?: string;
  deviceId?: string;
  persistDecisions?: boolean;
  now?: () => Date;
}

export interface InitializeApprovalOptions {
  workflowId?: string;
  recover?: boolean;
  deviceId?: string;
}

export type TaskModification = Partial<Pick<TaskItem, 'title' | 'description' | 'agent' | 'estimatedTime' | 'dependencies' | 'status'>>;

const VALID_AGENTS = new Set([
  'architect',
  'backend',
  'frontend',
  'tester',
  'devops',
  'security',
  'data',
  'docs',
  'fullstack-dev'
]);

const DECISION_PRECEDENCE: Record<ApprovalDecisionStatus, number> = {
  cancelled: 4,
  rejected: 3,
  modified: 2,
  approved: 1
};

export class ApprovalWorkflowHandler extends EventEmitter {
  private readonly storageDirectory: string;
  private readonly deviceId: string;
  private readonly persistDecisions: boolean;
  private readonly now: () => Date;
  private inputResponseTime = 0;
  private renderTime = 0;
  private sequence = 0;

  constructor(
    private readonly config: EnhancedUXConfig,
    options: ApprovalWorkflowHandlerOptions = {}
  ) {
    super();
    this.storageDirectory =
      options.storageDirectory ??
      config.storage?.approvalDirectory ??
      path.join(process.cwd(), '.graphyn', 'approvals');
    this.deviceId = options.deviceId ?? config.storage?.deviceId ?? process.env.GRAPHYN_DEVICE_ID ?? 'local-device';
    this.persistDecisions = options.persistDecisions ?? config.storage?.persistDecisions ?? false;
    this.now = options.now ?? (() => new Date());
  }

  public async decomposeQuery(query: string): Promise<TaskDecompositionResult> {
    const normalizedQuery = query.trim();
    const lowered = normalizedQuery.toLowerCase();
    const sequential = /\bthen\b|after that|afterwards/.test(lowered);
    const explicitParallel = /\bparallel\b|\bat the same time\b/.test(lowered);
    const segments = this.extractTaskSegments(normalizedQuery);
    const complexity = this.calculateComplexity(normalizedQuery, segments.length);
    const tasks: TaskItem[] = [];

    if (this.needsArchitectureTask(lowered)) {
      tasks.push(this.createTask('task-1', 'Plan implementation architecture', normalizedQuery, 'architect', complexity));
    }

    for (const segment of segments) {
      const agent = this.inferAgent(segment);
      const taskId = `task-${tasks.length + 1}`;
      tasks.push(this.createTask(taskId, this.titleFromSegment(segment), segment, agent, complexity));
    }

    if (tasks.length === 0) {
      tasks.push(this.createTask('task-1', 'Implement requested change', normalizedQuery, 'fullstack-dev', complexity));
    }

    const uniqueTasks = this.dedupeTasks(tasks);
    if (sequential) {
      uniqueTasks.forEach((task, index) => {
        task.dependencies = index === 0 ? [] : [uniqueTasks[index - 1].id];
      });
    } else if (uniqueTasks.length > 1 && uniqueTasks[0].agent === 'architect') {
      uniqueTasks.slice(1).forEach(task => {
        task.dependencies = [uniqueTasks[0].id];
      });
    }

    return {
      query,
      tasks: uniqueTasks,
      totalEstimatedTime: uniqueTasks.reduce((total, task) => total + task.estimatedTime, 0),
      parallelizable: explicitParallel || (!sequential && uniqueTasks.filter(task => task.dependencies.length === 0).length > 1),
      complexity
    };
  }

  public async initializeApproval(
    tasks: TaskItem[],
    options: InitializeApprovalOptions = {}
  ): Promise<ApprovalState> {
    const workflowId = options.workflowId ?? this.deriveWorkflowId(tasks);
    const state: ApprovalState = {
      tasks: tasks.map(task => ({ ...task, dependencies: [...task.dependencies] })),
      selectedIndex: tasks.length > 0 ? 0 : -1,
      modified: false,
      approved: false,
      workflowId,
      deviceId: options.deviceId ?? this.deviceId,
      revision: 0
    };

    if (!options.recover) {
      return state;
    }

    const recoveredDecision = await this.recoverApprovalDecision(workflowId);
    return recoveredDecision ? this.applyRecoveredDecision(state, recoveredDecision) : state;
  }

  public async handleKeyboardInput(state: ApprovalState, action: KeyboardAction): Promise<ApprovalState> {
    const startTime = performance.now();
    const sanitized = await this.sanitizeApprovalState(state);
    let nextState: ApprovalState;

    switch (action.action) {
      case 'next':
        nextState = this.moveSelection(sanitized, 1);
        break;
      case 'previous':
        nextState = this.moveSelection(sanitized, -1);
        break;
      case 'approve':
        nextState = await this.approveState(sanitized);
        break;
      case 'modify':
        nextState = { ...sanitized, modified: true, revision: (sanitized.revision ?? 0) + 1 };
        break;
      case 'filter':
        nextState = this.filterTasks(sanitized, action.target ?? 'pending');
        break;
      case 'cancel':
        throw new Error('User cancelled approval workflow');
      case 'toggle':
        nextState = this.toggleSelectedTask(sanitized);
        break;
      default:
        nextState = state;
        break;
    }

    this.inputResponseTime = performance.now() - startTime;
    return nextState;
  }

  public async modifyTask(task: TaskItem, modifications: TaskModification): Promise<TaskItem> {
    if (!this.isValidModification(modifications)) {
      throw new Error('Invalid task modifications');
    }

    return {
      ...task,
      ...modifications,
      dependencies: modifications.dependencies ? [...modifications.dependencies] : [...task.dependencies]
    };
  }

  public async renderApprovalInterface(state: ApprovalState): Promise<string> {
    const startTime = performance.now();
    const sanitized = await this.sanitizeApprovalState(state);
    const lines = sanitized.tasks.map((task, index) => {
      const selected = index === sanitized.selectedIndex ? '>' : ' ';
      return `${selected} [${task.status}] ${task.title} (${task.agent}, ${task.estimatedTime}s)`;
    });
    this.renderTime = performance.now() - startTime;
    return lines.join('\n');
  }

  public getPerformanceMetrics(): { inputResponseTime: number; renderTime: number } {
    return {
      inputResponseTime: this.inputResponseTime,
      renderTime: this.renderTime
    };
  }

  public async sanitizeApprovalState(state: Partial<ApprovalState>): Promise<ApprovalState> {
    const tasks = Array.isArray(state.tasks)
      ? state.tasks
          .filter(task => task && typeof task.id === 'string')
          .map(task => ({
            ...task,
            title: typeof task.title === 'string' ? task.title : task.id,
            description: typeof task.description === 'string' ? task.description : '',
            agent: typeof task.agent === 'string' ? task.agent : 'fullstack-dev',
            estimatedTime: typeof task.estimatedTime === 'number' && task.estimatedTime > 0 ? task.estimatedTime : 300,
            dependencies: Array.isArray(task.dependencies) ? [...task.dependencies] : [],
            status: this.isTaskStatus(task.status) ? task.status : 'pending'
          }))
      : [];

    const selectedIndex = tasks.length === 0
      ? -1
      : Math.min(Math.max(typeof state.selectedIndex === 'number' ? state.selectedIndex : 0, 0), tasks.length - 1);

    return {
      tasks,
      selectedIndex,
      modified: typeof state.modified === 'boolean' ? state.modified : false,
      approved: typeof state.approved === 'boolean' ? state.approved : false,
      workflowId: state.workflowId,
      deviceId: state.deviceId ?? this.deviceId,
      revision: typeof state.revision === 'number' ? state.revision : 0,
      recoveredDecisionId: state.recoveredDecisionId
    };
  }

  public async persistApprovalDecision(input: ApprovalDecisionInput): Promise<ApprovalDecisionRecord> {
    const incoming = this.normalizeDecision(input);
    const existing = await this.recoverApprovalDecision(incoming.workflowId);
    const winner = this.resolveApprovalDecision(existing ? [existing, incoming] : [incoming]);
    if (!winner) {
      throw new Error('Unable to resolve approval decision');
    }

    await this.writeDecision(winner);
    return winner;
  }

  public async recoverApprovalDecision(workflowId: string): Promise<ApprovalDecisionRecord | null> {
    try {
      const serialized = await readFile(this.getDecisionPath(workflowId), 'utf8');
      const parsed = JSON.parse(serialized) as ApprovalDecisionRecord;
      if (!this.isDecisionRecord(parsed)) {
        throw new Error(`Invalid approval decision record for workflow ${workflowId}`);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public resolveApprovalDecision(records: ApprovalDecisionRecord[]): ApprovalDecisionRecord | null {
    if (records.length === 0) {
      return null;
    }

    return [...records].sort((left, right) => this.compareDecision(right, left))[0];
  }

  public applyRecoveredDecision(state: ApprovalState, decision: ApprovalDecisionRecord): ApprovalState {
    const approvedTaskIds = new Set(decision.approvedTaskIds);
    const rejectedTaskIds = new Set(decision.rejectedTaskIds);
    const allApprovedByWorkflow = decision.status === 'approved' && approvedTaskIds.size === 0;

    const tasks = state.tasks.map(task => {
      let status: TaskStatus = task.status;
      if (rejectedTaskIds.has(task.id) || decision.status === 'rejected' || decision.status === 'cancelled') {
        status = 'rejected';
      } else if (approvedTaskIds.has(task.id) || allApprovedByWorkflow) {
        status = 'approved';
      }
      return { ...task, status };
    });

    return {
      ...state,
      tasks,
      approved: decision.status === 'approved',
      modified: decision.status === 'modified' || decision.modifiedTaskIds.length > 0,
      revision: Math.max(state.revision ?? 0, decision.sequence),
      recoveredDecisionId: decision.id
    };
  }

  private async approveState(state: ApprovalState): Promise<ApprovalState> {
    const nextState: ApprovalState = {
      ...state,
      approved: true,
      modified: state.modified,
      revision: (state.revision ?? 0) + 1
    };

    if (this.persistDecisions && nextState.workflowId) {
      const approvedTaskIds = nextState.tasks
        .filter(task => task.status !== 'rejected')
        .map(task => task.id);
      const decision = await this.persistApprovalDecision({
        workflowId: nextState.workflowId,
        status: 'approved',
        taskIds: nextState.tasks.map(task => task.id),
        approvedTaskIds,
        rejectedTaskIds: nextState.tasks.filter(task => task.status === 'rejected').map(task => task.id),
        deviceId: nextState.deviceId ?? this.deviceId,
        sequence: nextState.revision
      });
      nextState.recoveredDecisionId = decision.id;
    }

    this.emit('approval_completed', nextState);
    return nextState;
  }

  private moveSelection(state: ApprovalState, direction: 1 | -1): ApprovalState {
    if (state.tasks.length === 0) {
      return { ...state, selectedIndex: -1 };
    }

    const nextIndex = Math.min(Math.max(state.selectedIndex + direction, 0), state.tasks.length - 1);
    return { ...state, selectedIndex: nextIndex };
  }

  private filterTasks(state: ApprovalState, target: TaskStatus): ApprovalState {
    const tasks = state.tasks.filter(task => task.status === target);
    return {
      ...state,
      tasks,
      selectedIndex: tasks.length > 0 ? Math.min(state.selectedIndex, tasks.length - 1) : -1
    };
  }

  private toggleSelectedTask(state: ApprovalState): ApprovalState {
    if (state.selectedIndex < 0 || state.selectedIndex >= state.tasks.length) {
      return state;
    }

    const tasks = state.tasks.map((task, index) => {
      if (index !== state.selectedIndex) {
        return task;
      }

      const status: TaskStatus = task.status === 'approved' ? 'rejected' : 'approved';
      const updatedTask = { ...task, status };
      this.emit('task_status_changed', updatedTask);
      return updatedTask;
    });

    return {
      ...state,
      tasks,
      modified: true,
      revision: (state.revision ?? 0) + 1
    };
  }

  private isValidModification(modifications: TaskModification): boolean {
    if (modifications.estimatedTime !== undefined && modifications.estimatedTime <= 0) {
      return false;
    }

    if (modifications.agent !== undefined && !VALID_AGENTS.has(modifications.agent)) {
      return false;
    }

    if (modifications.dependencies !== undefined && !Array.isArray(modifications.dependencies)) {
      return false;
    }

    return true;
  }

  private extractTaskSegments(query: string): string[] {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    const segments = normalized
      .split(/\bthen\b|,|;|\band\b/i)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);

    return segments.length > 1 ? segments : [normalized];
  }

  private calculateComplexity(query: string, taskCount: number): 'simple' | 'moderate' | 'complex' {
    const lowered = query.toLowerCase();
    const complexSignals = ['microservices', 'orchestration', 'payment', 'authentication', 'full-stack', 'architecture'];
    const score = complexSignals.filter(signal => lowered.includes(signal)).length + taskCount;

    if (score >= 5 || query.length > 140) {
      return 'complex';
    }
    if (score >= 3 || query.length > 60) {
      return 'moderate';
    }
    return 'simple';
  }

  private needsArchitectureTask(loweredQuery: string): boolean {
    return /\b(api|database|auth|authentication|architecture|microservices|payment|full-stack)\b/.test(loweredQuery);
  }

  private inferAgent(segment: string): string {
    const lowered = segment.toLowerCase();
    if (/\b(api|database|server|endpoint|auth|authentication|postgres|rest)\b/.test(lowered)) {
      return 'backend';
    }
    if (/\b(ui|frontend|component|react|button|homepage|css|page)\b/.test(lowered)) {
      return 'frontend';
    }
    if (/\btest|spec|coverage|quality\b/.test(lowered)) {
      return 'tester';
    }
    if (/\bdeploy|docker|kubernetes|ci|pipeline|orchestration\b/.test(lowered)) {
      return 'devops';
    }
    if (/\bdoc|readme|guide\b/.test(lowered)) {
      return 'docs';
    }
    return 'fullstack-dev';
  }

  private createTask(
    id: string,
    title: string,
    description: string,
    agent: string,
    complexity: 'simple' | 'moderate' | 'complex'
  ): TaskItem {
    const baseEstimate = complexity === 'complex' ? 2400 : complexity === 'moderate' ? 1200 : 300;
    return {
      id,
      title,
      description,
      agent,
      estimatedTime: baseEstimate,
      dependencies: [],
      status: 'pending'
    };
  }

  private titleFromSegment(segment: string): string {
    const cleaned = segment.trim().replace(/[.?!]$/, '');
    if (cleaned.length <= 64) {
      return this.capitalize(cleaned);
    }
    return `${this.capitalize(cleaned.slice(0, 61))}...`;
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private dedupeTasks(tasks: TaskItem[]): TaskItem[] {
    const seen = new Set<string>();
    const result: TaskItem[] = [];

    for (const task of tasks) {
      const key = `${task.agent}:${task.title.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ ...task, id: `task-${result.length + 1}` });
    }

    return result;
  }

  private deriveWorkflowId(tasks: TaskItem[]): string {
    const payload = tasks.map(task => `${task.id}:${task.title}`).join('|');
    return `approval-${this.hash(payload).slice(0, 16)}`;
  }

  private normalizeDecision(input: ApprovalDecisionInput): ApprovalDecisionRecord {
    const decidedAt = input.decidedAt instanceof Date
      ? input.decidedAt.toISOString()
      : input.decidedAt ?? this.now().toISOString();
    const sequence = input.sequence ?? ++this.sequence;
    const deviceId = input.deviceId ?? this.deviceId;
    const taskIds = [...(input.taskIds ?? new Set([
      ...(input.approvedTaskIds ?? []),
      ...(input.rejectedTaskIds ?? []),
      ...(input.modifiedTaskIds ?? [])
    ]))];
    const stateHash = this.hash(JSON.stringify({
      workflowId: input.workflowId,
      status: input.status,
      taskIds,
      approvedTaskIds: input.approvedTaskIds ?? [],
      rejectedTaskIds: input.rejectedTaskIds ?? [],
      modifiedTaskIds: input.modifiedTaskIds ?? []
    }));

    return {
      id: `decision-${this.hash(`${input.workflowId}:${deviceId}:${sequence}:${decidedAt}:${stateHash}`).slice(0, 20)}`,
      workflowId: input.workflowId,
      status: input.status,
      taskIds,
      approvedTaskIds: [...(input.approvedTaskIds ?? [])],
      rejectedTaskIds: [...(input.rejectedTaskIds ?? [])],
      modifiedTaskIds: [...(input.modifiedTaskIds ?? [])],
      deviceId,
      sequence,
      decidedAt,
      reason: input.reason,
      stateHash
    };
  }

  private compareDecision(left: ApprovalDecisionRecord, right: ApprovalDecisionRecord): number {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    const leftTime = Date.parse(left.decidedAt);
    const rightTime = Date.parse(right.decidedAt);
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    const precedence = DECISION_PRECEDENCE[left.status] - DECISION_PRECEDENCE[right.status];
    if (precedence !== 0) {
      return precedence;
    }

    const deviceTieBreak = right.deviceId.localeCompare(left.deviceId);
    if (deviceTieBreak !== 0) {
      return deviceTieBreak;
    }

    return right.id.localeCompare(left.id);
  }

  private async writeDecision(record: ApprovalDecisionRecord): Promise<void> {
    await mkdir(this.storageDirectory, { recursive: true });
    const destination = this.getDecisionPath(record.workflowId);
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    await rename(temporary, destination);
  }

  private getDecisionPath(workflowId: string): string {
    return path.join(this.storageDirectory, `${encodeURIComponent(workflowId)}.json`);
  }

  private isDecisionRecord(value: ApprovalDecisionRecord): boolean {
    return Boolean(
      value &&
        typeof value.id === 'string' &&
        typeof value.workflowId === 'string' &&
        typeof value.status === 'string' &&
        Array.isArray(value.taskIds) &&
        Array.isArray(value.approvedTaskIds) &&
        Array.isArray(value.rejectedTaskIds) &&
        Array.isArray(value.modifiedTaskIds) &&
        typeof value.deviceId === 'string' &&
        typeof value.sequence === 'number' &&
        typeof value.decidedAt === 'string' &&
        typeof value.stateHash === 'string'
    );
  }

  private isTaskStatus(value: unknown): value is TaskStatus {
    return (
      value === 'pending' ||
      value === 'approved' ||
      value === 'rejected' ||
      value === 'running' ||
      value === 'completed' ||
      value === 'failed'
    );
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
