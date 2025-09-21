/**
 * SessionManager - Session Lifecycle Management
 * 
 * Handles session states (new, active, paused, archived) and session directories
 * Maps to delivery.md steps 14-16: session creation and metadata management
 */

import fs from 'fs/promises';
import path from 'path';
import { UserDataManager } from './UserDataManager.js';

export type SessionState = 'new' | 'active' | 'paused' | 'archived' | 'replayed';

export interface SessionMetadata {
  sessionId: string;
  state: SessionState;
  created: string;
  lastActive: string;
  projectName?: string;
  workingDirectory: string;
  repositories: Record<string, string>; // repo name -> path mapping
  agents: Array<{
    id: string;
    type: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    pid?: number;
    startedAt?: string;
    completedAt?: string;
  }>;
  tasks: Array<{
    id: string;
    type: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    assignedAgent?: string;
    dependencies: string[];
    startedAt?: string;
    completedAt?: string;
    metrics?: {
      durationMs?: number;
      tokensUsed?: number;
      toolsUsed?: string[];
    };
  }>;
  metrics: {
    duration: number; // milliseconds
    tasksCompleted: number;
    tasksTotal: number;
    filesGenerated: number;
    linesOfCode: number;
  };
}

export interface TaskAuditRecord {
  sessionId?: string;
  taskId: string;
  agentId: string;
  status: 'completed' | 'failed';
  summary?: string;
  output?: string;
  workspaceDir?: string;
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    toolsUsed?: string[];
  };
  knowledgeReferences?: Array<{ source: string; title: string; url?: string }>;
  startedAt?: Date;
  completedAt?: Date;
  errors?: Array<{ message: string; stack?: string }>;
}

export class SessionManager {
  private userDataManager: UserDataManager;
  private currentSession: SessionMetadata | null = null;
  private currentSessionPath: string | null = null;

  constructor(userDataManager?: UserDataManager) {
    this.userDataManager = userDataManager || UserDataManager.getInstance();
  }

  /**
   * Create new session with directory structure
   */
  async createSession(projectName?: string, workingDirectory?: string): Promise<SessionMetadata> {
    // Generate session ID with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sessionId = `session-${timestamp}`;
    
    console.log(`📁 Creating new session: ${sessionId}`);

    try {
      // Initialize user data if not already done
      await this.userDataManager.initialize();

      // Create session directory structure
      const sessionDir = await this.userDataManager.createSessionDirectory(sessionId);

      // Detect working directory and project name
      const workDir = workingDirectory || process.cwd();
      const detectedProjectName = projectName || this.detectProjectName(workDir);

      // Create session metadata
      const sessionMetadata: SessionMetadata = {
        sessionId,
        state: 'new',
        created: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        projectName: detectedProjectName,
        workingDirectory: workDir,
        repositories: await this.detectRepositories(workDir),
        agents: [],
        tasks: [],
        metrics: {
          duration: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
          filesGenerated: 0,
          linesOfCode: 0
        }
      };

      // Save session metadata
      await this.saveSessionMetadata(sessionMetadata);

      // Create repository mapping file
      await this.createRepositoryMapping(sessionDir, sessionMetadata.repositories);

      this.currentSession = sessionMetadata;
      this.currentSessionPath = sessionDir;
      
      console.log(`✅ Session created: ${sessionId}`);
      console.log(`📂 Project: ${detectedProjectName}`);
      console.log(`📁 Working directory: ${workDir}`);
      console.log(`🗂️ Repositories: ${Object.keys(sessionMetadata.repositories).join(', ')}`);

      return sessionMetadata;

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Failed to create session: ${err.message}`);
      throw new Error(`Session creation failed: ${err.message}`);
    }
  }

  /**
   * Load existing session
   */
  async loadSession(sessionId: string): Promise<SessionMetadata> {
    try {
      const userStructure = this.userDataManager.getDirectoryStructure();
      const sessionMetadataPath = path.join(userStructure.sessions, sessionId, '.session-meta.json');
      
      const metadataContent = await fs.readFile(sessionMetadataPath, 'utf-8');
      const sessionMetadata: SessionMetadata = JSON.parse(metadataContent);
      
      this.currentSession = sessionMetadata;
      this.currentSessionPath = await this.userDataManager.getSessionPath(sessionId);
      console.log(`📂 Session loaded: ${sessionId}`);
      
      return sessionMetadata;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to load session ${sessionId}: ${err.message}`);
    }
  }

  /**
   * Update session state
   */
  async updateSessionState(state: SessionState): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to update');
    }

    this.currentSession.state = state;
    this.currentSession.lastActive = new Date().toISOString();
    
    await this.saveSessionMetadata(this.currentSession);
    console.log(`🔄 Session state updated: ${state}`);
  }

  /**
   * Add agent to session
   */
  async addAgent(agentId: string, type: string, pid?: number): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const agent = {
      id: agentId,
      type,
      status: 'idle' as const,
      pid
    };

    this.currentSession.agents.push(agent);
    await this.saveSessionMetadata(this.currentSession);
    
    console.log(`🤖 Agent added to session: ${agentId} (${type})`);
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: 'idle' | 'running' | 'completed' | 'failed'): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const agent = this.currentSession.agents.find(a => a.id === agentId);
    if (agent) {
      agent.status = status;
      const nowIso = new Date().toISOString();
      if (status === 'running' && !agent.startedAt) {
        agent.startedAt = nowIso;
      }
      if ((status === 'completed' || status === 'failed')) {
        agent.completedAt = nowIso;
      }
      await this.saveSessionMetadata(this.currentSession);
      console.log(`🔄 Agent ${agentId} status: ${status}`);
    }
  }

  /**
   * Add task to session
   */
  async addTask(taskId: string, type: string, description: string, dependencies: string[] = []): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const task = {
      id: taskId,
      type,
      description,
      status: 'pending' as const,
      dependencies,
    };

    this.currentSession.tasks.push(task);
    this.currentSession.metrics.tasksTotal++;
    
    await this.saveSessionMetadata(this.currentSession);
    console.log(`📋 Task added: ${taskId} - ${description}`);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: 'pending' | 'running' | 'completed' | 'failed', assignedAgent?: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const task = this.currentSession.tasks.find(t => t.id === taskId);
    if (task) {
      const oldStatus = task.status;
      task.status = status;
      if (assignedAgent) {
        task.assignedAgent = assignedAgent;
      }
      const nowIso = new Date().toISOString();
      if (status === 'running' && !task.startedAt) {
        task.startedAt = nowIso;
      }
      if ((status === 'completed' || status === 'failed')) {
        task.completedAt = nowIso;
      }

      // Update metrics
      if (oldStatus !== 'completed' && status === 'completed') {
        this.currentSession.metrics.tasksCompleted++;
      }

      await this.saveSessionMetadata(this.currentSession);
      console.log(`📝 Task ${taskId} status: ${status}`);
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionMetadata | null {
    return this.currentSession;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<string[]> {
    const userStructure = this.userDataManager.getDirectoryStructure();
    
    try {
      const sessionsDir = await fs.readdir(userStructure.sessions);
      return sessionsDir.filter(name => name.startsWith('session-'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Archive session
   */
  async archiveSession(sessionId?: string): Promise<void> {
    const targetSession = sessionId || this.currentSession?.sessionId;
    if (!targetSession) {
      throw new Error('No session to archive');
    }

    const session = sessionId ? await this.loadSession(sessionId) : this.currentSession!;
    session.state = 'archived';
    session.lastActive = new Date().toISOString();

    await this.saveSessionMetadata(session);
    console.log(`📦 Session archived: ${targetSession}`);
  }

  async recordTaskAudit(record: TaskAuditRecord): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to record audit');
    }

    const sessionId = record.sessionId || this.currentSession.sessionId;
    const sessionDir = await this.getSessionDirectory(sessionId);
    const agentDir = path.join(sessionDir, 'agents', record.agentId);
    const auditsDir = path.join(agentDir, 'audits');

    await fs.mkdir(auditsDir, { recursive: true });

    const payload = {
      sessionId,
      taskId: record.taskId,
      agentId: record.agentId,
      status: record.status,
      summary: record.summary,
      output: record.output,
      workspaceDir: record.workspaceDir,
      metrics: record.metrics,
      knowledgeReferences: record.knowledgeReferences,
      startedAt: record.startedAt?.toISOString(),
      completedAt: record.completedAt?.toISOString(),
      errors: record.errors,
      recordedAt: new Date().toISOString(),
    };

    const auditPath = path.join(auditsDir, `${record.taskId}.json`);
    await fs.writeFile(auditPath, JSON.stringify(payload, null, 2));

    const task = this.currentSession.tasks.find((t) => t.id === record.taskId);
    if (task) {
      task.metrics = {
        durationMs: record.metrics?.durationMs,
        tokensUsed: record.metrics?.tokensUsed,
        toolsUsed: record.metrics?.toolsUsed,
      };
      if (record.startedAt) {
        task.startedAt = record.startedAt.toISOString();
      }
      if (record.completedAt) {
        task.completedAt = record.completedAt.toISOString();
      }
      await this.saveSessionMetadata(this.currentSession);
    }
  }

  /**
   * Private methods
   */
  private async saveSessionMetadata(metadata: SessionMetadata): Promise<void> {
    const userStructure = this.userDataManager.getDirectoryStructure();
    const sessionDir = path.join(userStructure.sessions, metadata.sessionId);
    const metadataPath = path.join(sessionDir, '.session-meta.json');

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private detectProjectName(workingDirectory: string): string {
    // Try to detect project name from package.json, directory name, etc.
    const dirName = path.basename(workingDirectory);
    
    // Could enhance this to read package.json, git remote, etc.
    return dirName || 'unnamed-project';
  }

  private async detectRepositories(workingDirectory: string): Promise<Record<string, string>> {
    const repositories: Record<string, string> = {};

    try {
      // Check if current directory is a git repository
      await fs.access(path.join(workingDirectory, '.git'));
      const repoName = path.basename(workingDirectory);
      repositories[repoName] = workingDirectory;
      
      // TODO: Could enhance to detect multiple repos, monorepos, etc.
    } catch {
      // Not a git repository, still add as workspace
      const dirName = path.basename(workingDirectory);
      repositories[dirName] = workingDirectory;
    }

    return repositories;
  }

  private async createRepositoryMapping(sessionDir: string, repositories: Record<string, string>): Promise<void> {
    const repoMapPath = path.join(sessionDir, '.repo-map.json');
    const repoMapping = {
      created: new Date().toISOString(),
      repositories,
      workspaces: Object.fromEntries(
        Object.keys(repositories).map(repo => [
          repo,
          path.join(sessionDir, 'workspace', repo)
        ])
      )
    };

    await fs.writeFile(repoMapPath, JSON.stringify(repoMapping, null, 2));
    
    // Create workspace directories
    for (const repo of Object.keys(repositories)) {
      const workspaceDir = path.join(sessionDir, 'workspace', repo);
      await fs.mkdir(workspaceDir, { recursive: true });
      
      // Create input/output directories
      await fs.mkdir(path.join(workspaceDir, 'input'), { recursive: true });
      await fs.mkdir(path.join(workspaceDir, 'output'), { recursive: true });
    }
  }

  private async getSessionDirectory(sessionId: string): Promise<string> {
    if (this.currentSession && this.currentSession.sessionId === sessionId && this.currentSessionPath) {
      return this.currentSessionPath;
    }

    const dir = await this.userDataManager.getSessionPath(sessionId);
    if (this.currentSession && this.currentSession.sessionId === sessionId) {
      this.currentSessionPath = dir;
    }
    return dir;
  }
}
