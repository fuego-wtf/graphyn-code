import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import {
  UserDataManager,
  SessionManager,
  MCPCoordinator,
  TransparencyEngine,
  MissionControlStream,
  ProcessTreeVisualizer,
  TaskEnvelope,
  Task,
  loadAgentSpecializations,
  type AgentSpecializationMap,
} from '@graphyn/core';
import { AgentFactory, type TaskExecution } from '@graphyn/agents';
import { createDatabase } from '@graphyn/db';
import { DashboardRenderer } from '../ui/DashboardRenderer.js';

interface OrchestrateOptions {
  sessionId?: string;
  projectName?: string;
  workspaceDir?: string;
  verbose?: boolean;
  dryRun?: boolean;
  dashboard?: boolean;
  compactDashboard?: boolean;
}

type PlannedTask = TaskEnvelope;

interface SessionContext {
  metadata: any;
  sessionDir: string;
  workspaceRoot: string;
  logsDir: string;
  dbPath: string;
}

interface AgentAssignment {
  taskId: string;
  agentId: string;
  agentType: string;
  workspaceDir: string;
}

class MCPAgentExecutor {
  private readonly coordinator: MCPCoordinator;
  private readonly sessionManager: SessionManager;
  private readonly transparency: TransparencyEngine;
  private readonly assignments: Record<string, AgentAssignment>;
  private readonly agentsRoot: string;
  private readonly missionControl?: MissionControlStream;
  private readonly processTree?: ProcessTreeVisualizer;

  constructor(
    coordinator: MCPCoordinator,
    sessionManager: SessionManager,
    transparency: TransparencyEngine,
    agentsRoot: string,
    assignments: Record<string, AgentAssignment>,
    missionControl?: MissionControlStream,
    processTree?: ProcessTreeVisualizer,
  ) {
    this.coordinator = coordinator;
    this.sessionManager = sessionManager;
    this.transparency = transparency;
    this.assignments = assignments;
    this.agentsRoot = agentsRoot;
    this.missionControl = missionControl;
    this.processTree = processTree;
  }

  async run(sessionId: string): Promise<void> {
    let idleIterations = 0;

    while (idleIterations < 3) {
      const response = await this.coordinator.getNextTask();
      const task = response?.task;

      if (!task) {
        idleIterations += 1;
        await this.delay(500);
        continue;
      }

      idleIterations = 0;
      const assignment = this.assignments[task.id] ?? this.createFallbackAssignment(task);
      await this.executeTask(task, assignment, sessionId);
    }
  }

  private async executeTask(task: any, assignment: AgentAssignment, sessionId: string): Promise<void> {
    await fs.mkdir(assignment.workspaceDir, { recursive: true });

    const agent = AgentFactory.createAgent(assignment.agentType, assignment.agentId, assignment.workspaceDir);
    const processListener = (payload: any) => {
      this.processTree?.recordAgentProcess(assignment.agentId, payload);
    };
    (agent as any).on?.('process', processListener);

    // Update MissionControl with agent start
    this.missionControl?.updateAgentStatus(assignment.agentId, {
      type: assignment.agentType as any,
      name: assignment.agentId,
      status: 'active',
      currentTask: task.id,
      progress: 0,
      metrics: {
        tasksCompleted: 0,
        tasksActive: 1,
        errorCount: 0,
        uptime: 0
      },
      lastActivity: new Date()
    });

    this.missionControl?.updateTaskStatus(task.id, {
      title: task.description,
      status: 'active',
      assignedAgent: assignment.agentId,
      priority: 1,
      dependencies: [],
      progress: 0,
      startTime: new Date(),
      metrics: {
        estimatedDuration: 300,
        complexity: 1
      }
    });

    await this.sessionManager.updateAgentStatus(assignment.agentId, 'running');
    await this.sessionManager.updateTaskStatus(task.id, 'running', assignment.agentId);
    await this.transparency.record({
      source: 'agents',
      eventType: 'task_started',
      message: `${task.id} (${task.description})`,
      metadata: { taskId: task.id, agentId: assignment.agentId, agentType: assignment.agentType, sessionId },
    });

    this.processTree?.recordAgentStart(assignment.agentId, {
      agentType: assignment.agentType,
      taskId: task.id,
      workspaceDir: assignment.workspaceDir,
    });

    const startedAt = Date.now();
    let execution: TaskExecution | null = null;

    try {
      const taskPayload: Task = {
        id: task.id,
        description: task.description,
        type: this.mapAgentTypeToTaskType(assignment.agentType),
        dependencies: task.dependencies ?? [],
        workingDirectory: assignment.workspaceDir,
        priority: task.priority ?? 3,
        estimatedDuration: 60,
        requiredSkills: [],
        deliverables: [],
        acceptanceCriteria: [],
        config: task.config ?? { tools: [] },
      };

      execution = await agent.executeTask(taskPayload, {
        sessionId,
        taskDescription: task.description,
        dependencies: task.dependencies ?? [],
      });
      if (!execution) {
        throw new Error(`Agent ${assignment.agentId} did not return execution output`);
      }

      const output = execution.output || 'Task completed';
      const durationMs = Date.now() - startedAt;

      await this.coordinator.completeTask(task.id, true, {
        result: {
          summary: output,
          workspaceDir: assignment.workspaceDir,
        },
        metrics: {
          durationMs,
        },
      });

      // Update MissionControl with completion
      this.missionControl?.updateAgentStatus(assignment.agentId, {
        status: 'complete',
        progress: 100,
        currentTask: undefined,
        metrics: {
          tasksCompleted: 1,
          tasksActive: 0,
          errorCount: 0,
          uptime: durationMs
        }
      });

      this.missionControl?.updateTaskStatus(task.id, {
        status: 'complete',
        progress: 100,
        completedTime: new Date(),
        metrics: {
          estimatedDuration: 300,
          actualDuration: durationMs,
          complexity: 1
        }
      });

      await this.sessionManager.updateTaskStatus(task.id, 'completed', assignment.agentId);
      await this.sessionManager.updateAgentStatus(assignment.agentId, 'completed');
      await this.sessionManager.recordTaskAudit({
        taskId: task.id,
        agentId: assignment.agentId,
        status: 'completed',
        summary: output,
        output: execution.output,
        workspaceDir: assignment.workspaceDir,
        metrics: {
          durationMs,
          tokensUsed: execution.metrics?.tokensUsed,
          toolsUsed: execution.metrics?.toolsUsed,
        },
        startedAt: execution.startTime,
        completedAt: execution.endTime,
      });
      await this.transparency.record({
        source: 'agents',
        eventType: 'task_completed',
        message: task.id,
        metadata: { taskId: task.id, agentId: assignment.agentId, durationMs },
      });
      this.processTree?.recordAgentFinish(assignment.agentId, {
        status: 'completed',
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const err = error as Error;

      await this.coordinator.completeTask(task.id, false, {
        error: err.message,
      });

      // Update MissionControl with error
      this.missionControl?.updateAgentStatus(assignment.agentId, {
        status: 'error',
        currentTask: undefined,
        metrics: {
          tasksCompleted: 0,
          tasksActive: 0,
          errorCount: 1,
          uptime: durationMs
        }
      });

      this.missionControl?.updateTaskStatus(task.id, {
        status: 'error',
        errorMessage: err.message,
        completedTime: new Date(),
        metrics: {
          estimatedDuration: 300,
          actualDuration: durationMs,
          complexity: 1
        }
      });

      await this.sessionManager.updateTaskStatus(task.id, 'failed', assignment.agentId);
      await this.sessionManager.updateAgentStatus(assignment.agentId, 'failed');
      await this.sessionManager.recordTaskAudit({
        taskId: task.id,
        agentId: assignment.agentId,
        status: 'failed',
        summary: execution?.output,
        output: execution?.output,
        workspaceDir: assignment.workspaceDir,
        metrics: {
          durationMs,
          tokensUsed: execution?.metrics?.tokensUsed,
          toolsUsed: execution?.metrics?.toolsUsed,
        },
        startedAt: execution?.startTime,
        completedAt: execution?.endTime ?? new Date(),
        errors: [{ message: err.message, stack: err.stack }],
      });
      await this.transparency.record({
        source: 'agents',
        eventType: 'task_failed',
        level: 'error',
        message: task.id,
        metadata: { taskId: task.id, agentId: assignment.agentId, durationMs, error: err.message },
      });
      this.processTree?.recordAgentFinish(assignment.agentId, {
        status: 'failed',
        durationMs,
        error: err.message,
      });
    } finally {
      (agent as any).off?.('process', processListener);
      if (typeof (agent as any).cleanup === 'function') {
        await (agent as any).cleanup();
      }
    }
  }

  private createFallbackAssignment(task: any): AgentAssignment {
    const agentId = `${task.agentType || task.agent_type}-fallback-${Date.now()}`;
    const agentType = task.agentType || task.agent_type || 'backend';
    const workspaceDir = path.join(this.agentsRoot, agentId);
    return { taskId: task.id, agentId, agentType, workspaceDir };
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapAgentTypeToTaskType(agentType: string): Task['type'] {
    switch (agentType) {
      case 'backend':
        return 'backend_development';
      case 'security':
        return 'security_analysis';
      case 'frontend':
        return 'implementation';
      case 'figma':
        return 'analysis';
      case 'test':
        return 'testing';
      case 'devops':
        return 'deployment';
      default:
        return 'implementation';
    }
  }
}

export class OrchestrateCommand {
  private readonly userDataManager = UserDataManager.getInstance();
  private readonly sessionManager = new SessionManager(this.userDataManager);
  private readonly mcpCoordinator = new MCPCoordinator();
  private readonly processTree = new ProcessTreeVisualizer(this.mcpCoordinator);
  private transparencyEngine?: TransparencyEngine;
  private dbManager: ReturnType<typeof createDatabase> | null = null;
  private missionControl?: MissionControlStream;
  private dashboard?: DashboardRenderer;
  private agentCatalog: AgentSpecializationMap | null = null;

  async execute(query: string, options: OrchestrateOptions = {}): Promise<void> {
    if (!query || !query.trim()) {
      throw new Error('Task description is required.');
    }

    const context = await this.bootstrapSession(options);
    await this.startMCP(context.dbPath);
    this.setupTransparency(context);
    this.setupMissionControl(context, options);
    await this.ensureAgentCatalog();

    try {
      console.log(`📝 Goal captured: "${query}"`);
      const tasks = await this.planTasks(query, context.metadata);
      if (tasks.length === 0) {
        console.log('ℹ️ No actionable tasks detected. Exiting.');
        return;
      }

      if (options.dryRun) {
        console.log('🧪 Dry run requested. Tasks were planned and enqueued preview skipped.');
        return;
      }

      const assignments = await this.enqueueTasks(tasks, context);
      await this.runAgentExecution(assignments, context);
      await this.ingestKnowledge(query, context);
      await this.printSummary(context, assignments);
      await this.finishSession(context);
    } catch (error) {
      await this.transparencyEngine?.record({
        source: 'cli',
        eventType: 'error',
        level: 'error',
        message: (error as Error).message,
      });
      throw error;
    } finally {
      this.transparencyEngine?.stop?.();
      this.cleanupDashboard();
      await this.shutdown();
    }
  }

  private async bootstrapSession(options: OrchestrateOptions): Promise<SessionContext> {
    console.log('👤 Initializing user data...');
    await this.userDataManager.initialize();
    const structure = this.userDataManager.getDirectoryStructure();
    const dbPath = path.join(structure.db, 'graphyn-tasks.db');

    process.env.DATABASE_PATH = dbPath;
    process.env.USE_MOCK_DB = 'true';

    const sessionMetadata = options.sessionId
      ? await this.sessionManager.loadSession(options.sessionId)
      : await this.sessionManager.createSession(options.projectName, options.workspaceDir);

    await this.sessionManager.updateSessionState('active');

    const sessionDir = path.join(structure.sessions, sessionMetadata.sessionId);
    const primaryRepo = Object.keys(sessionMetadata.repositories)[0];
    const workspaceRoot = path.join(sessionDir, 'workspace', primaryRepo);
    const logsDir = path.join(sessionDir, 'logs');

    console.log(`📂 Session ${sessionMetadata.sessionId} created`);
    console.log(`📁 Working directory: ${sessionMetadata.workingDirectory}`);

    return {
      metadata: sessionMetadata,
      sessionDir,
      workspaceRoot,
      logsDir,
      dbPath,
    };
  }

  private async startMCP(dbPath: string): Promise<void> {
    console.log('🔌 Starting MCP server...');
    process.env.DATABASE_PATH = dbPath;
    const status = await this.mcpCoordinator.startMCPServer();
    if (!status.connected) {
      throw new Error('Failed to connect to MCP server');
    }
    console.log(`✅ MCP connected (pid: ${status.pid})`);
  }

  private setupTransparency(context: SessionContext): void {
    if (this.transparencyEngine) {
      return;
    }

    this.dbManager = createDatabase({ type: 'mock', path: context.dbPath });
    this.transparencyEngine = new TransparencyEngine({
      sessionId: context.metadata.sessionId,
      logDirectory: context.logsDir,
      db: this.dbManager,
    });
    this.mcpCoordinator.attachTransparencyEngine(this.transparencyEngine);
    void this.transparencyEngine.record({
      source: 'cli',
      eventType: 'session_boot',
      message: context.metadata.sessionId,
    });
  }

  private async planTasks(query: string, sessionMetadata: any): Promise<PlannedTask[]> {
    console.log('🧠 Planning tasks from query...');
    const tasks = this.generateTasksFromQuery(query);

    for (const task of tasks) {
      await this.sessionManager.addTask(task.id, task.agentType, task.description, task.dependencies);
      await this.transparencyEngine?.record({
        source: 'planner',
        eventType: 'task_planned',
        message: task.id,
        metadata: {
          taskId: task.id,
          description: task.description,
          dependencies: task.dependencies,
          agentType: task.agentType,
          priority: task.priority,
          tags: task.tags,
        },
      });
    }

    console.log(`📊 Planned ${tasks.length} task(s)`);
    return tasks;
  }

  private async enqueueTasks(tasks: PlannedTask[], context: SessionContext): Promise<Record<string, AgentAssignment>> {
    console.log('📮 Enqueuing tasks into MCP queue...');

    const counters = new Map<string, number>();
    const assignments: Record<string, AgentAssignment> = {};
    const agentsRoot = path.join(context.sessionDir, 'agents');
    await fs.mkdir(agentsRoot, { recursive: true });

    for (const task of tasks) {
      const current = counters.get(task.agentType) ?? 0;
      const nextIndex = current + 1;
      counters.set(task.agentType, nextIndex);

      const agentId = `${task.agentType}-${String(nextIndex).padStart(3, '0')}`;
      const workspaceDir = path.join(agentsRoot, agentId);

      task.workspace = workspaceDir;
      if (!task.config?.tools) {
        const spec = this.agentCatalog?.[task.agentType];
        if (spec?.defaultTools) {
          task.config = {
            ...task.config,
            tools: spec.defaultTools,
          };
        }
      }

      await this.mcpCoordinator.enqueueTask(
        task.id,
        task.agentType,
        task.description,
        task.dependencies,
        workspaceDir,
        task.priority,
        task.config,
        task.metadata,
        task.tags,
      );

      await this.sessionManager.addAgent(agentId, task.agentType);
      assignments[task.id] = {
        taskId: task.id,
        agentId,
        agentType: task.agentType,
        workspaceDir,
      };

      await this.transparencyEngine?.record({
        source: 'queue',
        eventType: 'task_enqueued',
        message: task.id,
        metadata: { agentType: task.agentType, priority: task.priority, agentId },
      });
    }

    return assignments;
  }

  private async runAgentExecution(
    assignments: Record<string, AgentAssignment>,
    context: SessionContext,
  ): Promise<void> {
    if (Object.keys(assignments).length === 0) {
      return;
    }

    const agentsRoot = path.join(context.sessionDir, 'agents');
    const executor = new MCPAgentExecutor(
      this.mcpCoordinator,
      this.sessionManager,
      this.transparencyEngine!,
      agentsRoot,
      assignments,
      this.missionControl,
      this.processTree
    );

    await executor.run(context.metadata.sessionId);
  }

  private async ingestKnowledge(query: string, context: SessionContext): Promise<void> {
    try {
      const result = await this.mcpCoordinator.ingestDeepwiki(query, context.metadata.sessionId);
      if (result?.success) {
        await this.transparencyEngine?.record({
          source: 'knowledge',
          eventType: 'deepwiki_ingest',
          message: result.entry?.title || query,
          metadata: { source: 'deepwiki' },
        });
      }
    } catch (error) {
      const err = error as Error;
      await this.transparencyEngine?.record({
        source: 'knowledge',
        eventType: 'deepwiki_ingest_failed',
        level: 'warn',
        message: query,
        metadata: { error: err.message },
      });
    }
  }

  private async printSummary(
    context: SessionContext,
    assignments: Record<string, AgentAssignment>,
  ): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      return;
    }

    const knowledgeEntries = this.dbManager
      ? await this.dbManager.getKnowledgeEntries({ sessionId: context.metadata.sessionId })
      : [];

    console.log('\n📊 Session Summary');
    console.log(`Session ID: ${context.metadata.sessionId}`);
    console.log(`Tasks: ${session.metrics.tasksCompleted}/${session.metrics.tasksTotal} completed`);

    for (const task of session.tasks) {
      const assignment = assignments[task.id];
      console.log(`  • ${task.id} -> ${task.status.toUpperCase()} (${assignment?.agentId ?? 'unassigned'})`);
    }

    console.log(`Knowledge entries stored: ${knowledgeEntries.length}`);
    if (knowledgeEntries.length > 0) {
      const latest = knowledgeEntries[0];
      console.log(`  Latest: ${latest.title}`);
    }

    console.log(`Logs: ${path.join(context.sessionDir, 'logs')}`);
    console.log('\nProcess Tree');
    console.log(this.processTree.render());
  }

  private async finishSession(context: SessionContext): Promise<void> {
    await this.sessionManager.archiveSession(context.metadata.sessionId);
    await this.transparencyEngine?.record({
      source: 'cli',
      eventType: 'session_archived',
      message: context.metadata.sessionId,
    });
  }

  private setupMissionControl(context: SessionContext, options: OrchestrateOptions): void {
    if (!options.dashboard && !options.verbose) {
      return;
    }

    // Initialize Mission Control Stream
    this.missionControl = new MissionControlStream({
      id: context.metadata.sessionId,
      startTime: new Date(),
      transparency: this.transparencyEngine,
    });

    // Set up dashboard if requested
    if (options.dashboard || options.verbose) {
      this.dashboard = new DashboardRenderer(this.missionControl, {
        updateInterval: 500,
        showDebugInfo: options.verbose || false,
        compactMode: options.compactDashboard || false
      });

      // Start dashboard after a short delay to let setup complete
      setTimeout(() => {
        this.dashboard?.start();
      }, 1000);
    }
  }

  private cleanupDashboard(): void {
    if (this.dashboard) {
      this.dashboard.stop();
      this.dashboard = undefined;
    }
    
    if (this.missionControl) {
      this.missionControl.destroy();
      this.missionControl = undefined;
    }
  }

  private async shutdown(): Promise<void> {
    await this.mcpCoordinator.stopMCPServer();
    if (this.dbManager && typeof (this.dbManager as any).close === 'function') {
      (this.dbManager as any).close();
    }
  }

  private generateTasksFromQuery(query: string): PlannedTask[] {
    const normalized = query.toLowerCase();
    const tasks: PlannedTask[] = [];

    if (normalized.includes('auth') || normalized.includes('login')) {
      tasks.push({
        id: 'backend-auth',
        agentType: 'backend',
        description: 'Implement authentication scaffolding',
        dependencies: [],
        priority: 3,
        config: {
          tools: this.agentCatalog?.backend?.defaultTools ?? ['fs.read', 'fs.write', 'shell.exec'],
          timeoutSeconds: 900,
          maxRetries: 1,
        },
        metadata: {
          source: 'heuristic-generator',
          category: 'authentication',
        },
        tags: ['backend', 'auth'],
      });
    }

    const dependsOnAuth = tasks.some((t) => t.id === 'backend-auth');
    tasks.push({
      id: dependsOnAuth ? 'security-audit' : 'backend-general',
      agentType: dependsOnAuth ? 'security' : 'backend',
      description: dependsOnAuth ? 'Perform security hardening and review' : query,
      dependencies: dependsOnAuth ? ['backend-auth'] : [],
      priority: dependsOnAuth ? 4 : 2,
      config: {
        tools: (dependsOnAuth
          ? this.agentCatalog?.security?.defaultTools
          : this.agentCatalog?.backend?.defaultTools) ?? ['fs.read', 'shell.exec'],
        timeoutSeconds: 900,
        maxRetries: 1,
      },
      metadata: {
        source: 'heuristic-generator',
        originalQuery: query,
      },
      tags: dependsOnAuth ? ['security', 'analysis'] : ['backend'],
    });

    return tasks;
  }

  private async ensureAgentCatalog(): Promise<void> {
    if (this.agentCatalog) {
      return;
    }

    const { agents, configPath } = await loadAgentSpecializations();
    this.agentCatalog = agents;
    console.log(`🤖 Loaded ${Object.keys(agents).length} agent specializations from ${configPath}`);
    await this.transparencyEngine?.record({
      source: 'cli',
      eventType: 'agent_catalog_loaded',
      message: 'agent specializations loaded',
      metadata: {
        count: Object.keys(agents).length,
        configPath,
      },
    });
  }
}

export function createOrchestrateCommand(): Command {
  const cmd = new Command('orchestrate');

  cmd
    .description('Execute multi-agent task orchestration with session management')
    .argument('<query>', 'Task description to orchestrate')
    .option('-s, --session-id <id>', 'Resume existing session')
    .option('-p, --project-name <name>', 'Project name for new session')
    .option('-w, --workspace-dir <path>', 'Working directory path')
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('--dry-run', 'Preview without execution', false)
    .option('-d, --dashboard', 'Show live Mission Control dashboard', false)
    .option('--compact-dashboard', 'Use compact dashboard mode', false)
    .action(async (query: string, options) => {
      const orchestrator = new OrchestrateCommand();
      await orchestrator.execute(query, options);
    });

  return cmd;
}

export default createOrchestrateCommand;
