import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const colors = {
  primary: chalk.blueBright,
  secondary: chalk.magenta,
  accent: chalk.yellow,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
};

export class GraphynMDManager {
  private currentDir: string;
  private graphynMdPath: string;

  constructor() {
    this.currentDir = process.cwd();
    this.graphynMdPath = path.join(this.currentDir, 'GRAPHYN.md');
  }

  async init(): Promise<void> {
    console.log();
    console.log(colors.primary('🚀 Initializing GRAPHYN.md'));
    console.log(colors.primary('─'.repeat(30)));

    if (fs.existsSync(this.graphynMdPath)) {
      console.log(colors.warning('⚠️  GRAPHYN.md already exists'));
      return;
    }

    const template = this.getTemplate();
    
    try {
      fs.writeFileSync(this.graphynMdPath, template);
      console.log(colors.success('✓ GRAPHYN.md created successfully'));
      console.log();
      console.log(colors.info('Next steps:'));
      console.log(colors.info('• Edit GRAPHYN.md to customize for your project'));
      console.log(colors.info('• Run "graphyn sync push" to sync with platform'));
      console.log(colors.info('• Start using AI agents with your custom context'));
    } catch (error) {
      console.error(colors.error('✗ Failed to create GRAPHYN.md'));
      console.error(colors.error(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async pull(): Promise<void> {
    console.log(colors.info('📥 Pulling latest GRAPHYN.md from platform...'));
    console.log(colors.warning('Feature coming soon - requires authentication'));
  }

  async push(): Promise<void> {
    console.log(colors.info('📤 Pushing GRAPHYN.md to platform...'));
    console.log(colors.warning('Feature coming soon - requires authentication'));
  }

  async edit(): Promise<void> {
    if (!fs.existsSync(this.graphynMdPath)) {
      console.log(colors.error('✗ GRAPHYN.md not found'));
      console.log(colors.info('Run "graphyn init" first'));
      return;
    }

    try {
      const editor = process.env.EDITOR || 'nano';
      await execAsync(`${editor} ${this.graphynMdPath}`);
      console.log(colors.success('✓ GRAPHYN.md updated'));
    } catch (error) {
      console.error(colors.error('✗ Failed to open editor'));
    }
  }

  async showStatus(): Promise<void> {
    console.log();
    console.log(colors.primary('📊 GRAPHYN.md Status'));
    console.log(colors.primary('─'.repeat(25)));

    const exists = fs.existsSync(this.graphynMdPath);
    
    if (exists) {
      const stats = fs.statSync(this.graphynMdPath);
      console.log(colors.success('✓ GRAPHYN.md exists'));
      console.log(colors.info(`  Last modified: ${stats.mtime.toLocaleDateString()}`));
      console.log(colors.info(`  Size: ${Math.round(stats.size / 1024)}KB`));
      
      // Check if it's a git repo
      try {
        await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.currentDir });
        console.log(colors.info('  Git repository: Yes'));
        
        try {
          const { stdout } = await execAsync('git status --porcelain GRAPHYN.md', { cwd: this.currentDir });
          if (stdout.trim()) {
            console.log(colors.warning('  Status: Modified (uncommitted changes)'));
          } else {
            console.log(colors.success('  Status: Up to date'));
          }
        } catch {
          console.log(colors.info('  Status: Not tracked by git'));
        }
      } catch {
        console.log(colors.info('  Git repository: No'));
      }
    } else {
      console.log(colors.warning('✗ GRAPHYN.md not found'));
      console.log(colors.info('  Run "graphyn init" to create it'));
    }

    console.log();
  }

  private getTemplate(): string {
    return `# GRAPHYN.md - Living Documentation

This is your project's living documentation file. It helps AI agents understand your project context, coding standards, and specific requirements.

## Project Overview

**Project Name:** [Your Project Name]
**Description:** [Brief description of what this project does]
**Tech Stack:** [List your main technologies]

## Development Guidelines

### Coding Standards
- [Add your coding standards here]
- [Linting rules, formatting preferences]
- [Naming conventions]

### Architecture Patterns
- [Describe your architectural decisions]
- [File structure conventions]
- [Component patterns]

### Dependencies & Setup
\`\`\`bash
# Installation commands
npm install
# or
yarn install

# Development server
npm run dev

# Build
npm run build

# Tests
npm test
\`\`\`

## AI Agent Instructions

### Backend Agent Context
- [Specific instructions for backend development]
- [Database schemas, API patterns]
- [Authentication/authorization patterns]

### Frontend Agent Context
- [UI/UX guidelines]
- [Component library usage]
- [State management patterns]

### Architect Agent Context
- [System design principles]
- [Performance requirements]
- [Scalability considerations]

## Current Status & Priorities

### In Progress
- [Current features being developed]
- [Known issues being addressed]

### Next Steps
- [Planned features]
- [Technical debt to address]

### Notes
- [Any other context AI agents should know]
- [Recent decisions or changes]

---

*This file is part of the Graphyn living documentation system. Keep it updated as your project evolves.*
`;
  }
}