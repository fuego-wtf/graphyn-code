/**
 * Context Preserving Session - Maintains state across commands and modes
 * Handles session persistence, context switching, and memory management
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface SessionContext {
  sessionId: string;
  mode: 'standalone' | 'dynamic';
  currentProject?: {
    path: string;
    name: string;
    type?: string;
    framework?: string;
  };
  activeAgents: Array<{
    id: string;
    name: string;
    type: 'local' | 'remote';
    lastUsed: Date;
  }>;
  commandHistory: Array<{
    command: string;
    timestamp: Date;
    mode: 'standalone' | 'dynamic';
    result: 'success' | 'error' | 'partial';
  }>;
  contextData: {
    workingDirectory: string;
    gitStatus?: any;
    lastSync?: Date;
    preferences: {
      defaultMode: 'standalone' | 'dynamic';
      autoSave: boolean;
      verbosity: 'quiet' | 'normal' | 'verbose';
    };
  };
}

export class ContextPreservingSession {
  private context: SessionContext;
  private sessionPath: string;
  private autoSaveEnabled: boolean = true;

  constructor() {
    const clydeDir = path.join(os.homedir(), '.clyde');
    this.sessionPath = path.join(clydeDir, 'session.json');
    
    // Initialize with default context
    this.context = {
      sessionId: this.generateSessionId(),
      mode: 'standalone',
      activeAgents: [],
      commandHistory: [],
      contextData: {
        workingDirectory: process.cwd(),
        preferences: {
          defaultMode: 'standalone',
          autoSave: true,
          verbosity: 'normal'
        }
      }
    };
  }

  /**
   * Initialize session - load existing or create new
   */
  async initialize(): Promise<void> {
    await this.loadSession();
    await this.detectProjectContext();
    
    console.log(chalk.green(`✅ Session initialized`));
    console.log(chalk.gray(`   Session ID: ${this.context.sessionId.substring(0, 8)}...`));
    
    if (this.context.currentProject) {
      console.log(chalk.gray(`   Project: ${this.context.currentProject.name}`));
    }
  }

  /**
   * Save current session state
   */
  async save(): Promise<void> {
    try {
      const sessionDir = path.dirname(this.sessionPath);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      const sessionData = {
        ...this.context,
        lastSaved: new Date().toISOString()
      };
      
      fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2));
      
      if (this.context.contextData.preferences.verbosity === 'verbose') {
        console.log(chalk.gray('💾 Session saved'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to save session:'), error);
    }
  }

  /**
   * Load existing session or create new one
   */
  private async loadSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = fs.readFileSync(this.sessionPath, 'utf-8');
        const loadedContext = JSON.parse(sessionData);
        
        // Merge with current context, preserving important runtime data
        this.context = {
          ...this.context,
          ...loadedContext,
          // Always update working directory to current
          contextData: {
            ...loadedContext.contextData,
            workingDirectory: process.cwd()
          }
        };
        
        // Parse dates
        this.context.commandHistory = this.context.commandHistory.map(cmd => ({
          ...cmd,
          timestamp: new Date(cmd.timestamp)
        }));
        
        this.context.activeAgents = this.context.activeAgents.map(agent => ({
          ...agent,
          lastUsed: new Date(agent.lastUsed)
        }));
        
        console.log(chalk.blue('📂 Loaded existing session'));
      } else {
        console.log(chalk.blue('🆕 Created new session'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Using default session (could not load existing)'));
    }
  }

  /**
   * Detect current project context
   */
  private async detectProjectContext(): Promise<void> {
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');
    const gitPath = path.join(cwd, '.git');
    
    let projectInfo: any = {
      path: cwd,
      name: path.basename(cwd)
    };
    
    // Detect if this is a Node.js project
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        projectInfo.name = packageJson.name || path.basename(cwd);
        projectInfo.type = 'node';
        
        // Detect framework
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.next) projectInfo.framework = 'Next.js';
        else if (deps.react) projectInfo.framework = 'React';
        else if (deps.vue) projectInfo.framework = 'Vue';
        else if (deps.angular) projectInfo.framework = 'Angular';
        else if (deps.express) projectInfo.framework = 'Express';
        
      } catch (error) {
        // Continue with basic info
      }
    }
    
    // Detect other project types
    if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
      projectInfo.type = 'rust';
      projectInfo.framework = 'Rust';
    } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      projectInfo.type = 'go';
      projectInfo.framework = 'Go';
    } else if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
      projectInfo.type = 'python';
      projectInfo.framework = 'Python';
    }
    
    this.context.currentProject = projectInfo;
    
    if (this.autoSaveEnabled) {
      await this.save();
    }
  }

  /**
   * Add command to history
   */
  addCommand(command: string, mode: 'standalone' | 'dynamic', result: 'success' | 'error' | 'partial'): void {
    this.context.commandHistory.push({
      command,
      timestamp: new Date(),
      mode,
      result
    });
    
    // Keep only last 100 commands
    if (this.context.commandHistory.length > 100) {
      this.context.commandHistory = this.context.commandHistory.slice(-100);
    }
    
    if (this.autoSaveEnabled) {
      this.save();
    }
  }

  /**
   * Update active agent
   */
  updateActiveAgent(agent: { id: string; name: string; type: 'local' | 'remote' }): void {
    const existingIndex = this.context.activeAgents.findIndex(a => a.id === agent.id);
    
    const agentWithTimestamp = {
      ...agent,
      lastUsed: new Date()
    };
    
    if (existingIndex >= 0) {
      this.context.activeAgents[existingIndex] = agentWithTimestamp;
    } else {
      this.context.activeAgents.push(agentWithTimestamp);
    }
    
    // Keep only last 10 agents
    this.context.activeAgents.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    this.context.activeAgents = this.context.activeAgents.slice(0, 10);
    
    if (this.autoSaveEnabled) {
      this.save();
    }
  }

  /**
   * Switch session mode
   */
  switchMode(mode: 'standalone' | 'dynamic'): void {
    this.context.mode = mode;
    
    if (this.autoSaveEnabled) {
      this.save();
    }
  }

  /**
   * Get current session context
   */
  getContext(): SessionContext {
    return { ...this.context };
  }

  /**
   * Get recent commands for context
   */
  getRecentCommands(limit: number = 5): Array<{ command: string; timestamp: Date; mode: string; result: string }> {
    return this.context.commandHistory
      .slice(-limit)
      .map(cmd => ({
        command: cmd.command,
        timestamp: cmd.timestamp,
        mode: cmd.mode,
        result: cmd.result
      }));
  }

  /**
   * Get active agents
   */
  getActiveAgents(): Array<{ id: string; name: string; type: string; lastUsed: Date }> {
    return this.context.activeAgents.slice();
  }

  /**
   * Get project context for Claude Code
   */
  getProjectContext(): string {
    const project = this.context.currentProject;
    if (!project) {
      return `Working directory: ${this.context.contextData.workingDirectory}`;
    }
    
    let context = `Project: ${project.name} (${project.type || 'unknown'})`;
    if (project.framework) {
      context += `\nFramework: ${project.framework}`;
    }
    context += `\nPath: ${project.path}`;
    
    const recentCommands = this.getRecentCommands(3);
    if (recentCommands.length > 0) {
      context += '\n\nRecent commands:';
      recentCommands.forEach(cmd => {
        context += `\n- ${cmd.command} (${cmd.result})`;
      });
    }
    
    return context;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `clyde-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Update preferences
   */
  async updatePreferences(preferences: Partial<SessionContext['contextData']['preferences']>): Promise<void> {
    this.context.contextData.preferences = {
      ...this.context.contextData.preferences,
      ...preferences
    };
    
    this.autoSaveEnabled = this.context.contextData.preferences.autoSave;
    await this.save();
  }

  /**
   * Clean up old sessions
   */
  static async cleanup(): Promise<void> {
    const clydeDir = path.join(os.homedir(), '.clyde');
    const sessionPath = path.join(clydeDir, 'session.json');
    
    try {
      if (fs.existsSync(sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        const lastSaved = new Date(sessionData.lastSaved || 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (lastSaved < weekAgo) {
          console.log(chalk.gray('🧹 Cleaned up old session'));
          fs.unlinkSync(sessionPath);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}