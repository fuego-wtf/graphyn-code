/**
 * UserDataManager - ~/.graphyn Directory Structure Management
 * 
 * Creates and manages the ~/.graphyn/{user}/ directory structure as specified in delivery.md
 * Maps to delivery.md steps 3-4: user identity detection and data organization
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { z } from 'zod';

// User settings schema
const UserSettingsSchema = z.object({
  identity: z.object({
    username: z.string(),
    email: z.string().optional(),
    created: z.string(),
    lastActive: z.string()
  }),
  preferences: z.object({
    defaultWorkspace: z.string().optional(),
    theme: z.enum(['light', 'dark', 'auto']).default('auto'),
    verboseLogging: z.boolean().default(false),
    autoStartMCP: z.boolean().default(true)
  }),
  tokens: z.object({
    anthropic: z.string().optional(),
    figma: z.object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.string().optional()
    }).optional()
  }).optional()
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export interface UserDirectoryStructure {
  userHome: string;
  settings: string;
  auth: string;
  db: string;
  sessions: string;
  figma: string;
  templates: string;
  exports: string;
  global: string;
}

export class UserDataManager {
  private static instance: UserDataManager;
  private userHome: string;
  private username: string;
  private initialized = false;

  constructor(username?: string) {
    this.username = username || this.detectUsername();
    this.userHome = path.join(os.homedir(), '.graphyn', this.username);
  }

  static getInstance(username?: string): UserDataManager {
    if (!UserDataManager.instance) {
      UserDataManager.instance = new UserDataManager(username);
    }
    return UserDataManager.instance;
  }

  /**
   * Initialize complete ~/.graphyn/{user}/ directory structure
   * Implements delivery.md TO-BE structure
   */
  async initialize(): Promise<UserDirectoryStructure> {
    if (this.initialized) {
      return this.getDirectoryStructure();
    }

    console.log(`👤 Initializing user data for: ${this.username}`);
    console.log(`📁 Creating ~/.graphyn/${this.username}/ structure...`);

    try {
      const structure = this.getDirectoryStructure();

      // Create all required directories
      await this.createDirectories(structure);

      // Initialize settings file if it doesn't exist
      await this.initializeSettings();

      // Create database directory structure
      await this.initializeDatabaseStructure();

      // Create template directories
      await this.initializeTemplates();

      this.initialized = true;
      console.log(`✅ User data initialized: ${structure.userHome}`);

      return structure;

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Failed to initialize user data: ${err.message}`);
      throw new Error(`User data initialization failed: ${err.message}`);
    }
  }

  /**
   * Get complete directory structure paths
   */
  getDirectoryStructure(): UserDirectoryStructure {
    return {
      userHome: this.userHome,
      settings: path.join(this.userHome, 'settings.json'),
      auth: path.join(this.userHome, 'auth'),
      db: path.join(this.userHome, 'db'),
      sessions: path.join(this.userHome, 'sessions'),
      figma: path.join(this.userHome, 'figma'),
      templates: path.join(this.userHome, 'templates'),
      exports: path.join(this.userHome, 'exports'),
      global: path.join(os.homedir(), '.graphyn', 'global')
    };
  }

  /**
   * Load user settings with validation
   */
  async loadSettings(): Promise<UserSettings> {
    const structure = this.getDirectoryStructure();
    
    try {
      const settingsData = await fs.readFile(structure.settings, 'utf-8');
      const parsed = JSON.parse(settingsData);
      return UserSettingsSchema.parse(parsed);
    } catch (error) {
      // If settings don't exist or are invalid, return defaults
      return this.getDefaultSettings();
    }
  }

  /**
   * Save user settings with validation
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    const structure = this.getDirectoryStructure();
    
    // Validate settings
    const validated = UserSettingsSchema.parse(settings);
    validated.identity.lastActive = new Date().toISOString();

    await fs.writeFile(structure.settings, JSON.stringify(validated, null, 2));
    console.log(`💾 Settings saved: ${structure.settings}`);
  }

  /**
   * Get current user info
   */
  getUserInfo() {
    return {
      username: this.username,
      userHome: this.userHome,
      initialized: this.initialized
    };
  }

  /**
   * Check if user data exists and is valid
   */
  async validateUserData(): Promise<boolean> {
    const structure = this.getDirectoryStructure();

    try {
      // Check if main directories exist
      await fs.access(structure.userHome);
      await fs.access(structure.db);
      await fs.access(structure.sessions);
      
      // Check if settings are valid
      await this.loadSettings();
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create session directory
   */
  async createSessionDirectory(sessionId: string): Promise<string> {
    const structure = this.getDirectoryStructure();
    const sessionDir = path.join(structure.sessions, sessionId);

    await fs.mkdir(sessionDir, { recursive: true });

    // Create session subdirectories
    const sessionStructure = [
      'workspace',
      'agents',
      'logs',
      'mission-control',
      'figma'
    ];

    for (const subdir of sessionStructure) {
      await fs.mkdir(path.join(sessionDir, subdir), { recursive: true });
    }

    console.log(`📁 Session directory created: ${sessionDir}`);
    return sessionDir;
  }

  /**
   * Private methods
   */
  private detectUsername(): string {
    // Try various methods to detect username
    return process.env.USER || 
           process.env.USERNAME || 
           os.userInfo().username || 
           'default-user';
  }

  private async createDirectories(structure: UserDirectoryStructure): Promise<void> {
    const directories = [
      structure.userHome,
      structure.auth,
      structure.db,
      structure.sessions,
      structure.figma,
      path.join(structure.figma, 'credentials'),
      path.join(structure.figma, 'design-cache'),
      path.join(structure.figma, 'component-library'),
      structure.templates,
      path.join(structure.templates, 'agent-prompts'),
      path.join(structure.templates, 'project-scaffolds'),
      path.join(structure.templates, 'workspace-layouts'),
      structure.exports,
      path.join(structure.exports, 'reports'),
      path.join(structure.exports, 'archives'),
      path.join(structure.exports, 'deliverables'),
      structure.global,
      path.join(structure.global, 'mcp-server-binary'),
      path.join(structure.global, 'claude-configs'),
      path.join(structure.global, 'health-checks')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async initializeSettings(): Promise<void> {
    const structure = this.getDirectoryStructure();
    
    try {
      await fs.access(structure.settings);
    } catch {
      // Settings don't exist, create default
      const defaultSettings = this.getDefaultSettings();
      await this.saveSettings(defaultSettings);
    }
  }

  private async initializeDatabaseStructure(): Promise<void> {
    const structure = this.getDirectoryStructure();
    
    // Create database-specific files and directories
    const dbFiles = [
      '.gitkeep', // Ensure directory is tracked in git
    ];

    for (const file of dbFiles) {
      const filePath = path.join(structure.db, file);
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, '# Database directory\n');
      }
    }
  }

  private async initializeTemplates(): Promise<void> {
    const structure = this.getDirectoryStructure();
    
    // Create basic agent prompt template
    const agentPromptTemplate = `# {{AGENT_TYPE}} Agent Prompt Template

## Role
You are a specialized {{AGENT_TYPE}} agent working within the Graphyn multi-agent orchestration system.

## Context
- Session: {{SESSION_ID}}
- Project: {{PROJECT_NAME}}
- Repository: {{REPO_PATH}}
- Technology Stack: {{TECH_STACK}}

## Task
{{TASK_DESCRIPTION}}

## Tools Available
{{AVAILABLE_TOOLS}}

## Instructions
1. Analyze the task requirements
2. Break down into implementation steps
3. Execute using available tools
4. Provide clear progress updates
5. Report completion with summary

## Success Criteria
- Task completed according to requirements
- Code follows project conventions
- Changes are properly tested
- Documentation is updated where needed
`;

    const templatePath = path.join(structure.templates, 'agent-prompts', 'default-agent-template.md');
    try {
      await fs.access(templatePath);
    } catch {
      await fs.writeFile(templatePath, agentPromptTemplate);
    }
  }

  private getDefaultSettings(): UserSettings {
    return {
      identity: {
        username: this.username,
        created: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      preferences: {
        theme: 'auto',
        verboseLogging: false,
        autoStartMCP: true
      }
    };
  }
}