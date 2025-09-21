/**
 * UserDataManager - User Identity Detection and ~/.graphyn Management
 * 
 * Implements Step 3 of the 140-step workflow:
 * CLI detects user identity → ~/.graphyn/john-doe/
 * 
 * Process Transparency: 👤 User: john-doe | Home: ~/.graphyn/john-doe/
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export interface UserIdentity {
  username: string;
  userHomeDir: string;
  graphynUserDir: string;
}

export interface GraphynDirectoryStructure {
  userRoot: string;
  settings: string;
  auth: string;
  db: string;
  sessions: string;
  figma: string;
  templates: string;
  exports: string;
}

export class UserDataManager {
  private userIdentity: UserIdentity | null = null;
  private directoryStructure: GraphynDirectoryStructure | null = null;

  /**
   * Detects user identity and initializes ~/.graphyn structure
   * Implements Step 3 from the 140-step workflow
   */
  async detectAndInitializeUser(): Promise<UserIdentity> {
    console.log('🔍 Detecting user identity...');
    
    // Get system user information
    const systemUsername = os.userInfo().username;
    const homeDir = os.homedir();
    
    // Create graphyn user directory path
    const graphynUserDir = path.join(homeDir, '.graphyn', systemUsername);
    
    this.userIdentity = {
      username: systemUsername,
      userHomeDir: homeDir,
      graphynUserDir
    };

    // Initialize directory structure
    await this.initializeDirectoryStructure();
    
    // Display transparency message (Step 3 requirement)
    console.log(`👤 User: ${systemUsername} | Home: ~/.graphyn/${systemUsername}/`);
    
    return this.userIdentity;
  }

  /**
   * Initialize the complete ~/.graphyn directory structure
   * Based on the TO-BE specification in DELIVERY.md
   */
  private async initializeDirectoryStructure(): Promise<void> {
    if (!this.userIdentity) {
      throw new Error('User identity must be detected first');
    }

    const baseDir = this.userIdentity.graphynUserDir;
    
    this.directoryStructure = {
      userRoot: baseDir,
      settings: path.join(baseDir, 'settings.json'),
      auth: path.join(baseDir, 'auth'),
      db: path.join(baseDir, 'db'),
      sessions: path.join(baseDir, 'sessions'),
      figma: path.join(baseDir, 'figma'),
      templates: path.join(baseDir, 'templates'),
      exports: path.join(baseDir, 'exports')
    };

    // Create all required directories
    const dirsToCreate = [
      baseDir,
      this.directoryStructure.auth,
      this.directoryStructure.db,
      this.directoryStructure.sessions,
      this.directoryStructure.figma,
      path.join(this.directoryStructure.figma, 'credentials'),
      path.join(this.directoryStructure.figma, 'design-cache'),
      path.join(this.directoryStructure.figma, 'component-library'),
      this.directoryStructure.templates,
      path.join(this.directoryStructure.templates, 'agent-prompts'),
      path.join(this.directoryStructure.templates, 'project-scaffolds'),
      path.join(this.directoryStructure.templates, 'workspace-layouts'),
      this.directoryStructure.exports,
      path.join(this.directoryStructure.exports, 'reports'),
      path.join(this.directoryStructure.exports, 'archives'),
      path.join(this.directoryStructure.exports, 'deliverables')
    ];

    for (const dir of dirsToCreate) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Initialize settings.json if it doesn't exist
    if (!existsSync(this.directoryStructure.settings)) {
      const defaultSettings = {
        version: '1.0.0',
        user: {
          username: this.userIdentity.username,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        },
        preferences: {
          transparency: {
            enabled: true,
            logLevel: 'info',
            realTimeUpdates: true
          },
          agents: {
            maxConcurrent: 5,
            defaultTimeout: 300000,
            autoRetry: true
          },
          mcp: {
            serverAutoStart: true,
            databaseWAL2: true,
            healthCheckInterval: 30000
          },
          figma: {
            autoExtraction: true,
            componentGeneration: true,
            i18nMapping: true
          }
        },
        tokens: {
          // Authentication tokens will be stored in separate encrypted files
          figmaOAuth: null,
          claudeSession: null,
          mcpCredentials: null
        }
      };

      await fs.writeFile(
        this.directoryStructure.settings, 
        JSON.stringify(defaultSettings, null, 2),
        'utf8'
      );
    }

    console.log(`📁 Initialized ~/.graphyn/${this.userIdentity.username}/ directory structure`);
  }

  /**
   * Get current user identity
   */
  getUserIdentity(): UserIdentity | null {
    return this.userIdentity;
  }

  /**
   * Get directory structure paths
   */
  getDirectoryStructure(): GraphynDirectoryStructure | null {
    return this.directoryStructure;
  }

  /**
   * Load user settings from settings.json
   */
  async loadUserSettings(): Promise<any> {
    if (!this.directoryStructure) {
      throw new Error('Directory structure not initialized');
    }

    const settingsPath = this.directoryStructure.settings;
    
    if (!existsSync(settingsPath)) {
      throw new Error('User settings not found. Run initialization first.');
    }

    const settingsContent = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(settingsContent);
  }

  /**
   * Update user settings
   */
  async updateUserSettings(updates: any): Promise<void> {
    if (!this.directoryStructure) {
      throw new Error('Directory structure not initialized');
    }

    const currentSettings = await this.loadUserSettings();
    const mergedSettings = {
      ...currentSettings,
      ...updates,
      user: {
        ...currentSettings.user,
        lastActiveAt: new Date().toISOString()
      }
    };

    await fs.writeFile(
      this.directoryStructure.settings,
      JSON.stringify(mergedSettings, null, 2),
      'utf8'
    );
  }

  /**
   * Create a new session directory
   * Supports Step 14: Creates new session: ~/.graphyn/john-doe/sessions/session-2025-09-16-2145/
   */
  async createSession(sessionId?: string): Promise<string> {
    if (!this.directoryStructure) {
      throw new Error('Directory structure not initialized');
    }

    // Generate session ID if not provided
    if (!sessionId) {
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 5).replace(':', '');
      sessionId = `session-${datePart}-${timePart}`;
    }

    const sessionDir = path.join(this.directoryStructure.sessions, sessionId);
    
    // Create session directory structure
    const sessionPaths = [
      sessionDir,
      path.join(sessionDir, 'workspace'),
      path.join(sessionDir, 'agents'),
      path.join(sessionDir, 'logs'),
      path.join(sessionDir, 'mission-control'),
      path.join(sessionDir, 'figma'),
      path.join(sessionDir, 'figma', 'extracted-designs'),
      path.join(sessionDir, 'figma', 'components'),
      path.join(sessionDir, 'figma', 'translations')
    ];

    for (const sessionPath of sessionPaths) {
      await fs.mkdir(sessionPath, { recursive: true });
    }

    // Create session metadata
    const sessionMeta = {
      sessionId,
      createdAt: new Date().toISOString(),
      user: this.userIdentity?.username,
      status: 'active',
      workingDirectory: process.cwd(),
      repositories: [],
      agents: [],
      tasks: []
    };

    await fs.writeFile(
      path.join(sessionDir, '.session-meta.json'),
      JSON.stringify(sessionMeta, null, 2),
      'utf8'
    );

    console.log(`📁 Session created: ${sessionId}`);
    return sessionDir;
  }

  /**
   * Get the most recent session directory
   */
  async getLatestSession(): Promise<string | null> {
    if (!this.directoryStructure) {
      return null;
    }

    try {
      const sessionsDir = this.directoryStructure.sessions;
      const sessions = await fs.readdir(sessionsDir);
      
      if (sessions.length === 0) {
        return null;
      }

      // Sort by creation time (newest first)
      const sessionDirs = sessions
        .filter(name => name.startsWith('session-'))
        .sort()
        .reverse();

      return sessionDirs.length > 0 ? path.join(sessionsDir, sessionDirs[0]) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate that the user data structure is properly initialized
   */
  async validateStructure(): Promise<boolean> {
    if (!this.userIdentity || !this.directoryStructure) {
      return false;
    }

    const requiredPaths = [
      this.directoryStructure.userRoot,
      this.directoryStructure.auth,
      this.directoryStructure.db,
      this.directoryStructure.sessions,
      this.directoryStructure.figma,
      this.directoryStructure.templates,
      this.directoryStructure.exports
    ];

    for (const requiredPath of requiredPaths) {
      if (!existsSync(requiredPath)) {
        return false;
      }
    }

    return existsSync(this.directoryStructure.settings);
  }
}

export default UserDataManager;