import { readFile } from 'fs/promises';
import path from 'path';
import { ApprovalWorkflowHandler } from './services/approval-workflow-handler.js';
import type { ApprovalState, EnhancedUXConfig, LayoutRegions, TaskItem } from './types.js';

export interface SplitScreenOrchestratorOptions {
  enableResize: boolean;
  persistState: boolean;
  debugMode: boolean;
}

export interface KeyModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface StreamingContent {
  text: string;
  timestamp: Date;
}

export interface CurrentWorkflow {
  id: string;
  query: string;
  status: 'pending' | 'approved' | 'cancelled';
  approvalState: ApprovalState;
}

const DEFAULT_CONFIG: EnhancedUXConfig = {
  performance: {
    maxRenderTime: 16,
    maxAnalysisTime: 3000,
    maxInputResponseTime: 50,
    maxMemoryUsage: 150 * 1024 * 1024
  },
  layout: {
    streamingRatio: 0.7,
    approvalRatio: 0.2,
    inputRatio: 0.1
  },
  features: {
    enableExitProtection: true,
    enableContextCaching: true,
    enablePerformanceMonitoring: true
  }
};

export class SplitScreenOrchestrator {
  private readonly handler = new ApprovalWorkflowHandler(DEFAULT_CONFIG);
  private options: SplitScreenOrchestratorOptions = {
    enableResize: false,
    persistState: false,
    debugMode: false
  };
  private width = 80;
  private height = 24;
  private streamingContent: StreamingContent[] = [];
  private currentWorkflow: CurrentWorkflow | null = null;
  private repositoryContext: {
    workingDirectory: string;
    fingerprint: {
      techStack: { dependencies: Array<{ name: string; version?: string; type: string }> };
    };
    agentPrompts: Map<string, string>;
  } | null = null;

  public async initialize(options: SplitScreenOrchestratorOptions): Promise<void> {
    this.options = { ...options };
  }

  public async cleanup(): Promise<void> {
    this.streamingContent = [];
    this.currentWorkflow = null;
    this.repositoryContext = null;
  }

  public async startApprovalWorkflow(
    query: string,
    tasks: Array<Partial<TaskItem> & { assignedAgent?: string; estimatedDuration?: number }>
  ): Promise<void> {
    const normalizedTasks = tasks.map((task, index): TaskItem => ({
      id: task.id ?? `task-${index + 1}`,
      title: task.title ?? `Task ${index + 1}`,
      description: task.description ?? task.title ?? `Task ${index + 1}`,
      agent: task.agent ?? task.assignedAgent ?? 'fullstack-dev',
      estimatedTime: task.estimatedTime ?? task.estimatedDuration ?? 300,
      dependencies: task.dependencies ?? [],
      status: task.status ?? 'pending'
    }));
    const approvalState = await this.handler.initializeApproval(normalizedTasks, {
      workflowId: `workflow-${Date.now()}`
    });

    this.currentWorkflow = {
      id: approvalState.workflowId ?? `workflow-${Date.now()}`,
      query,
      status: 'pending',
      approvalState
    };
  }

  public async handleKeyPress(key: string, _modifiers: KeyModifiers): Promise<void> {
    if (!this.currentWorkflow) {
      return;
    }

    const action = key === 'down'
      ? { key, action: 'next' as const }
      : key === 'up'
        ? { key, action: 'previous' as const }
        : key === ' '
          ? { key, action: 'toggle' as const }
          : key === 'a'
            ? { key, action: 'approve' as const }
            : null;

    if (!action) {
      return;
    }

    const nextState = await this.handler.handleKeyboardInput(this.currentWorkflow.approvalState, action);
    this.currentWorkflow = {
      ...this.currentWorkflow,
      status: nextState.approved ? 'approved' : this.currentWorkflow.status,
      approvalState: nextState
    };
  }

  public getCurrentWorkflow(): CurrentWorkflow | null {
    return this.currentWorkflow;
  }

  public async setTerminalSize(width: number, height: number): Promise<void> {
    this.width = width;
    this.height = height;
  }

  public getCurrentLayout(): { width: number; height: number; regions: LayoutRegions } {
    const streamingHeight = Math.max(1, Math.floor(this.height * 0.7));
    const approvalHeight = Math.max(1, Math.floor(this.height * 0.2));
    const inputHeight = Math.max(1, this.height - streamingHeight - approvalHeight);

    return {
      width: this.width,
      height: this.height,
      regions: {
        streaming: { x: 0, y: 0, width: this.width, height: streamingHeight },
        streamingOutput: { x: 0, y: 0, width: this.width, height: streamingHeight },
        approval: { x: 0, y: streamingHeight, width: this.width, height: approvalHeight },
        input: { x: 0, y: streamingHeight + approvalHeight, width: this.width, height: inputHeight }
      }
    };
  }

  public async addStreamingContent(content: StreamingContent): Promise<void> {
    this.streamingContent.push(content);
  }

  public getStreamingContent(): string {
    return this.streamingContent.map(content => content.text).join('\n');
  }

  public async switchRepository(workingDirectory: string): Promise<void> {
    const packageJsonPath = path.join(workingDirectory, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = [
      ...Object.entries(packageJson.dependencies ?? {}).map(([name, version]) => ({ name, version, type: 'dependency' })),
      ...Object.entries(packageJson.devDependencies ?? {}).map(([name, version]) => ({ name, version, type: 'devDependency' }))
    ];
    const promptSeed = dependencies.map(dependency => dependency.name).join(',');

    this.repositoryContext = {
      workingDirectory,
      fingerprint: { techStack: { dependencies } },
      agentPrompts: new Map([
        ['frontend', `Frontend agent for ${workingDirectory}: ${promptSeed}`],
        ['backend', `Backend agent for ${workingDirectory}: ${promptSeed}`]
      ])
    };
  }

  public getCurrentRepositoryContext(): typeof this.repositoryContext {
    return this.repositoryContext;
  }
}
