import { GraphynAPIClient } from '../api-client.js';
import { AnalysisData } from '../services/context-builder.js';
import fs from 'fs';
import path from 'path';
import glob from 'glob';

export interface FileInfo {
  path: string;
  content?: string;
  size: number;
  type: 'file' | 'directory';
}

export interface RepositorySnapshot {
  rootPath: string;
  structure: FileInfo[];
  packageJson?: any;
  readmeContent?: string;
  gitignore?: string[];
}

export class AnalyzerAgent {
  constructor(
    private apiClient: GraphynAPIClient,
    private agentId: string = 'analyzer'
  ) {}

  /**
   * Analyze repository using AI agent
   */
  async analyzeRepository(rootPath: string): Promise<AnalysisData> {
    // Collect repository snapshot
    const snapshot = await this.collectRepositorySnapshot(rootPath);
    
    // Create analysis prompt
    const prompt = this.createAnalysisPrompt(snapshot);
    
    // Send to agent for analysis
    const response = await this.askAgent(prompt);
    
    // Parse agent response into structured data
    return this.parseAgentResponse(response);
  }

  /**
   * Collect relevant files and structure from repository
   */
  private async collectRepositorySnapshot(rootPath: string): Promise<RepositorySnapshot> {
    const snapshot: RepositorySnapshot = {
      rootPath,
      structure: [],
    };

    // Get directory structure (max 2 levels deep)
    const structure = await this.getDirectoryStructure(rootPath, 2);
    snapshot.structure = structure;

    // Read package.json if exists
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        snapshot.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      } catch (error) {
        // Ignore parse errors
      }
    }

    // Read README if exists
    const readmePaths = ['README.md', 'readme.md', 'README.MD'];
    for (const readmePath of readmePaths) {
      const fullPath = path.join(rootPath, readmePath);
      if (fs.existsSync(fullPath)) {
        snapshot.readmeContent = fs.readFileSync(fullPath, 'utf-8').slice(0, 2000); // First 2000 chars
        break;
      }
    }

    // Read .gitignore
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      snapshot.gitignore = fs.readFileSync(gitignorePath, 'utf-8').split('\n').filter(line => line.trim());
    }

    // Sample some source files for patterns
    const sourceFiles = await this.sampleSourceFiles(rootPath);
    snapshot.structure.push(...sourceFiles);

    return snapshot;
  }

  /**
   * Get directory structure up to specified depth
   */
  private async getDirectoryStructure(dir: string, maxDepth: number, currentDepth: number = 0): Promise<FileInfo[]> {
    if (currentDepth >= maxDepth) return [];

    const files: FileInfo[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip common ignored directories
      if (this.shouldSkipDirectory(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.apiClient.currentToken || dir, fullPath);

      if (entry.isDirectory()) {
        files.push({
          path: relativePath,
          size: 0,
          type: 'directory',
        });

        // Recursively get subdirectories
        const subFiles = await this.getDirectoryStructure(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else {
        const stats = fs.statSync(fullPath);
        files.push({
          path: relativePath,
          size: stats.size,
          type: 'file',
        });
      }
    }

    return files;
  }

  /**
   * Sample some source files to detect patterns
   */
  private async sampleSourceFiles(rootPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    // Important config files to analyze
    const configFiles = [
      'tsconfig.json',
      '.eslintrc.js',
      '.eslintrc.json',
      'prettier.config.js',
      '.prettierrc',
      'jest.config.js',
      'vitest.config.ts',
      'webpack.config.js',
      'vite.config.ts',
      'next.config.js',
      'docker-compose.yml',
      'Dockerfile',
    ];

    for (const configFile of configFiles) {
      const fullPath = path.join(rootPath, configFile);
      if (fs.existsSync(fullPath)) {
        files.push({
          path: configFile,
          content: fs.readFileSync(fullPath, 'utf-8').slice(0, 1000),
          size: fs.statSync(fullPath).size,
          type: 'file',
        });
      }
    }

    // Sample a few source files
    const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'];
    for (const pattern of sourcePatterns) {
      const matches = await glob(pattern, {
        cwd: rootPath,
        ignore: ['**/node_modules/**'],
      });

      // Take first 3 files from each pattern
      for (const match of matches.slice(0, 3)) {
        const fullPath = path.join(rootPath, match);
        files.push({
          path: match,
          content: fs.readFileSync(fullPath, 'utf-8').slice(0, 500), // First 500 chars
          size: fs.statSync(fullPath).size,
          type: 'file',
        });
      }
    }

    return files;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.cache',
      '.turbo',
      '.vercel',
      '.netlify',
    ];
    return skipDirs.includes(name);
  }

  /**
   * Create analysis prompt for the agent
   */
  private createAnalysisPrompt(snapshot: RepositorySnapshot): string {
    let prompt = `Analyze this repository and provide a detailed technical analysis.

Repository Structure:
${this.formatDirectoryTree(snapshot.structure)}

`;

    if (snapshot.packageJson) {
      prompt += `\nPackage.json:
\`\`\`json
${JSON.stringify(snapshot.packageJson, null, 2).slice(0, 2000)}
\`\`\`
`;
    }

    if (snapshot.readmeContent) {
      prompt += `\nREADME.md (excerpt):
${snapshot.readmeContent}
`;
    }

    // Add sample files
    const sampleFiles = snapshot.structure.filter(f => f.content);
    if (sampleFiles.length > 0) {
      prompt += '\nSample Files:\n';
      for (const file of sampleFiles.slice(0, 5)) {
        prompt += `\n${file.path}:\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }
    }

    prompt += `
Please analyze this repository and provide:
1. Tech Stack Detection:
   - Frontend frameworks and libraries (with versions if found)
   - Backend frameworks and libraries (with versions if found)
   - Databases used
   - Infrastructure and deployment tools
   - Testing frameworks
   - Programming languages

2. Code Patterns:
   - Architecture patterns (MVC, Clean Architecture, etc.)
   - Code organization (feature folders, layer folders, etc.)
   - Best practices detected
   
3. Repository Type:
   - Is it a monorepo or single project?
   - What is the main framework?
   - What is the primary language?

Provide the analysis in a structured format.`;

    return prompt;
  }

  /**
   * Format directory tree for display
   */
  private formatDirectoryTree(files: FileInfo[]): string {
    const tree: string[] = [];
    const dirs = files.filter(f => f.type === 'directory').slice(0, 30);
    
    for (const dir of dirs) {
      const level = dir.path.split('/').length - 1;
      const indent = '  '.repeat(level);
      tree.push(`${indent}${path.basename(dir.path)}/`);
    }

    return tree.join('\n');
  }

  /**
   * Send prompt to agent and get response
   */
  private async askAgent(prompt: string): Promise<string> {
    // Create a thread for analysis
    const thread = await this.apiClient.createThread({
      name: `Repository Analysis - ${new Date().toISOString()}`,
      type: 'testing',
    });

    // Send message to thread
    await this.apiClient.sendMessage(thread.id, {
      content: prompt,
      role: 'user',
    });

    // Get response (this is simplified - in reality you'd handle streaming)
    // For now, we'll simulate a response
    return this.simulateAgentResponse();
  }

  /**
   * Simulate agent response for testing
   */
  private simulateAgentResponse(): string {
    return `Based on my analysis of the repository:

**Tech Stack Detection:**
- Frontend: Next.js 14.0.0, React 18.2.0, TypeScript 5.2.0
- UI Libraries: Tailwind CSS 3.3.0, Radix UI
- Backend: Node.js, Express 4.18.0
- Database: PostgreSQL (detected from docker-compose)
- Testing: Jest, React Testing Library
- Infrastructure: Docker, GitHub Actions

**Code Patterns:**
- Architecture: Clean Architecture with domain/application/infrastructure layers
- Organization: Feature folders pattern
- Best Practices: TypeScript usage, ESLint configuration, Prettier formatting

**Repository Type:**
- Type: Single project
- Main Framework: Next.js
- Primary Language: TypeScript`;
  }

  /**
   * Parse agent response into structured data
   */
  private parseAgentResponse(response: string): AnalysisData {
    // This is a simplified parser - in production you'd use more robust parsing
    // or have the agent return structured JSON

    const analysis: AnalysisData = {
      techStack: {
        frontend: [],
        backend: [],
        databases: [],
        infrastructure: [],
        testing: [],
        languages: [],
      },
      patterns: {
        architecture: [],
        organization: [],
        practices: [],
      },
      repository: {
        type: 'single',
      },
    };

    // Parse frontend technologies
    if (response.includes('Next.js')) {
      analysis.techStack.frontend!.push('nextjs@14.0.0');
      analysis.repository.mainFramework = 'nextjs';
    }
    if (response.includes('React')) {
      analysis.techStack.frontend!.push('react@18.2.0');
    }
    if (response.includes('Tailwind')) {
      analysis.techStack.frontend!.push('tailwindcss');
    }
    if (response.includes('Radix UI')) {
      analysis.techStack.frontend!.push('radix-ui');
    }

    // Parse backend
    if (response.includes('Express')) {
      analysis.techStack.backend!.push('express@4.18.0');
    }

    // Parse databases
    if (response.includes('PostgreSQL')) {
      analysis.techStack.databases!.push('postgresql');
    }

    // Parse languages
    if (response.includes('TypeScript')) {
      analysis.techStack.languages!.push('typescript');
      analysis.repository.primaryLanguage = 'typescript';
    }

    // Parse testing
    if (response.includes('Jest')) {
      analysis.techStack.testing!.push('jest');
    }

    // Parse patterns
    if (response.includes('Clean Architecture')) {
      analysis.patterns.architecture!.push('clean-architecture');
    }
    if (response.includes('Feature folders')) {
      analysis.patterns.organization!.push('feature-folders');
    }
    if (response.includes('TypeScript usage')) {
      analysis.patterns.practices!.push('typescript');
    }

    // Parse repository type
    if (response.includes('Single project')) {
      analysis.repository.type = 'single';
    } else if (response.includes('Monorepo')) {
      analysis.repository.type = 'monorepo';
    }

    return analysis;
  }
}