import { GraphynAPIClient } from '../api-client.js';
import { AnalysisData } from '../services/context-builder.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import EventSource from 'eventsource';

// Custom error classes for better error handling
export class AnalyzerError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'AnalyzerError';
  }
}

export class FileSystemError extends AnalyzerError {
  constructor(message: string, public filePath?: string, public operation?: string) {
    super(message, 'FILE_SYSTEM_ERROR', { filePath, operation });
    this.name = 'FileSystemError';
  }
}

export class APIError extends AnalyzerError {
  constructor(message: string, public statusCode?: number, public endpoint?: string) {
    super(message, 'API_ERROR', { statusCode, endpoint });
    this.name = 'APIError';
  }
}

export class ParsingError extends AnalyzerError {
  constructor(message: string, public field?: string, public rawData?: any) {
    super(message, 'PARSING_ERROR', { field, rawData });
    this.name = 'ParsingError';
  }
}

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
  private rootPath?: string;
  
  constructor(
    private apiClient: GraphynAPIClient,
    private agentId: string = 'analyzer'
  ) {}

  /**
   * Analyze repository using AI agent
   */
  async analyzeRepository(rootPath: string): Promise<AnalysisData> {
    try {
      // Validate root path
      if (!rootPath || typeof rootPath !== 'string') {
        throw new AnalyzerError('Invalid root path provided');
      }
      
      // Check if path exists
      if (!fs.existsSync(rootPath)) {
        throw new FileSystemError(`Repository path does not exist: ${rootPath}`, rootPath, 'access');
      }
      
      // Set the root path for relative path calculations
      this.rootPath = rootPath;
      
      // Collect repository snapshot
      const snapshot = await this.collectRepositorySnapshot(rootPath);
      
      // Create analysis prompt
      const prompt = this.createAnalysisPrompt(snapshot);
      
      // Send to agent for analysis
      const response = await this.askAgent(prompt);
      
      // Parse agent response into structured data
      return this.parseAgentResponse(response);
    } catch (error) {
      if (error instanceof AnalyzerError) {
        throw error;
      }
      throw new AnalyzerError(`Failed to analyze repository: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Collect relevant files and structure from repository
   */
  private async collectRepositorySnapshot(rootPath: string): Promise<RepositorySnapshot> {
    const snapshot: RepositorySnapshot = {
      rootPath,
      structure: [],
    };

    try {
      // Get directory structure (max 2 levels deep)
      const structure = await this.getDirectoryStructure(rootPath, 2);
      snapshot.structure = structure;
    } catch (error) {
      throw new FileSystemError(
        `Failed to read directory structure: ${error instanceof Error ? error.message : String(error)}`,
        rootPath,
        'readdir'
      );
    }

    // Read package.json if exists
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        snapshot.packageJson = JSON.parse(content);
      } catch (error) {
        console.warn(`Warning: Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Read README if exists
    const readmePaths = ['README.md', 'readme.md', 'README.MD'];
    for (const readmePath of readmePaths) {
      const fullPath = path.join(rootPath, readmePath);
      if (fs.existsSync(fullPath)) {
        try {
          snapshot.readmeContent = fs.readFileSync(fullPath, 'utf-8').slice(0, 2000); // First 2000 chars
          break;
        } catch (error) {
          console.warn(`Warning: Failed to read ${readmePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Read .gitignore
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        snapshot.gitignore = fs.readFileSync(gitignorePath, 'utf-8').split('\n').filter(line => line.trim());
      } catch (error) {
        console.warn(`Warning: Failed to read .gitignore: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Sample some source files for patterns
    try {
      const sourceFiles = await this.sampleSourceFiles(rootPath);
      snapshot.structure.push(...sourceFiles);
    } catch (error) {
      console.warn(`Warning: Failed to sample source files: ${error instanceof Error ? error.message : String(error)}`);
    }

    return snapshot;
  }

  /**
   * Get directory structure up to specified depth
   */
  private async getDirectoryStructure(dir: string, maxDepth: number, currentDepth: number = 0): Promise<FileInfo[]> {
    if (currentDepth >= maxDepth) return [];

    const files: FileInfo[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        try {
          // Skip common ignored directories
          if (this.shouldSkipDirectory(entry.name)) continue;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.rootPath || dir, fullPath);

          if (entry.isDirectory()) {
            files.push({
              path: relativePath,
              size: 0,
              type: 'directory',
            });

            // Recursively get subdirectories
            try {
              const subFiles = await this.getDirectoryStructure(fullPath, maxDepth, currentDepth + 1);
              files.push(...subFiles);
            } catch (error) {
              // Log but don't fail for subdirectory errors (might be permission issues)
              console.warn(`Warning: Could not read subdirectory ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            try {
              const stats = fs.statSync(fullPath);
              files.push({
                path: relativePath,
                size: stats.size,
                type: 'file',
              });
            } catch (error) {
              // Skip files we can't stat
              console.warn(`Warning: Could not stat file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } catch (error) {
          // Skip individual entry errors
          console.warn(`Warning: Error processing entry ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        dir,
        'readdir'
      );
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
      // JavaScript/TypeScript
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
      // Ruby
      'Gemfile',
      'Rakefile',
      '.rubocop.yml',
      // Python
      'setup.py',
      'pyproject.toml',
      'Pipfile',
      'tox.ini',
      '.flake8',
      // PHP
      'composer.json',
      'phpunit.xml',
      '.php-cs-fixer.php',
      // Go
      'go.mod',
      'go.sum',
      // Rust
      'Cargo.toml',
      'Cargo.lock',
      // Java/Kotlin
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      'settings.gradle',
      // C/C++
      'CMakeLists.txt',
      'Makefile',
      'configure.ac',
      // C#
      '*.csproj',
      '*.sln',
      'nuget.config',
      // Swift
      'Package.swift',
      'Podfile',
      // Elixir
      'mix.exs',
      // Dart/Flutter
      'pubspec.yaml',
      // Scala
      'build.sbt',
      // Haskell
      'stack.yaml',
      'package.yaml',
      // Docker
      'docker-compose.yml',
      'Dockerfile',
      '.dockerignore',
    ];

    for (const configFile of configFiles) {
      const fullPath = path.join(rootPath, configFile);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8').slice(0, 1000);
          files.push({
            path: configFile,
            content: content,
            size: stats.size,
            type: 'file',
          });
        } catch (error) {
          console.warn(`Warning: Could not read config file ${configFile}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Sample a few source files
    const sourcePatterns = [
      // JavaScript/TypeScript
      'src/**/*.{ts,tsx,js,jsx}', 
      'app/**/*.{ts,tsx,js,jsx}',
      // Python
      '**/*.py',
      // Ruby
      '**/*.rb',
      'app/**/*.rb',
      'lib/**/*.rb',
      // PHP
      '**/*.php',
      'app/**/*.php',
      'src/**/*.php',
      // Go
      '**/*.go',
      // Rust
      'src/**/*.rs',
      // Java/Kotlin
      'src/**/*.{java,kt}',
      // C/C++
      'src/**/*.{c,cpp,cc,cxx,h,hpp}',
      '**/*.{c,cpp,cc,cxx,h,hpp}',
      // C#
      '**/*.cs',
      // Swift
      '**/*.swift',
      // Elixir
      'lib/**/*.ex',
      'lib/**/*.exs',
      // Dart
      'lib/**/*.dart',
      // Scala
      'src/**/*.scala',
      // Haskell
      'src/**/*.hs',
      'app/**/*.hs'
    ];
    
    for (const pattern of sourcePatterns) {
      try {
        const matches = await glob(pattern, {
          cwd: rootPath,
          ignore: ['**/node_modules/**', '**/vendor/**', '**/.git/**', '**/dist/**', '**/build/**'],
        });

        // Take first 2 files from each pattern
        for (const match of matches.slice(0, 2)) {
          const fullPath = path.join(rootPath, match);
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isFile()) {
              const content = fs.readFileSync(fullPath, 'utf-8').slice(0, 500); // First 500 chars
              files.push({
                path: match,
                content: content,
                size: stats.size,
                type: 'file',
              });
            }
          } catch (error) {
            // Skip files we can't read
            console.warn(`Warning: Could not read source file ${match}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch {
        // Ignore glob errors for patterns that don't match
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
    try {
      // Check if we have a valid token
      if (!this.apiClient.currentToken) {
        throw new APIError('No authentication token available. Please run "graphyn auth" first.');
      }

      // Create a thread for analysis
      let thread;
      try {
        thread = await this.apiClient.createThread({
          name: `Repository Analysis - ${new Date().toISOString()}`,
          type: 'testing',
        });
      } catch (error) {
        throw new APIError(
          `Failed to create analysis thread: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error && 'response' in error ? (error as any).response?.status : undefined
        );
      }

      // Send message to thread
      try {
        await this.apiClient.sendMessage(thread.id, {
          content: prompt,
          role: 'user',
        });
      } catch (error) {
        throw new APIError(
          `Failed to send analysis request: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error && 'response' in error ? (error as any).response?.status : undefined
        );
      }

      // Stream the response
      return await this.streamResponse(thread.id);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stream response from the API
   */
  private streamResponse(threadId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const messages = new Map<string, string>();
      let timeoutId: NodeJS.Timeout;
      
      const eventSource = this.apiClient.streamThread(threadId);
      
      // Set a timeout for the response
      const timeoutSeconds = 30;
      timeoutId = setTimeout(() => {
        eventSource.close();
        reject(new APIError(`Analysis timed out after ${timeoutSeconds} seconds`));
      }, timeoutSeconds * 1000);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle message chunks
          if (data.type === 'message.chunk' && data.agent_id) {
            const currentContent = messages.get(data.agent_id) || '';
            messages.set(data.agent_id, currentContent + (data.content || ''));
          }
          
          // Handle complete messages
          if (data.type === 'message.complete' && data.agent_id) {
            const fullMessage = messages.get(data.agent_id) || '';
            clearTimeout(timeoutId);
            eventSource.close();
            resolve(fullMessage);
          }
          
          // Handle errors
          if (data.type === 'error') {
            clearTimeout(timeoutId);
            eventSource.close();
            reject(new APIError(data.message || 'Unknown error from API', data.code));
          }
        } catch (error) {
          // Continue on parse errors, might be a heartbeat
          console.warn('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        clearTimeout(timeoutId);
        eventSource.close();
        reject(new APIError(`Streaming error: ${error.message || 'Connection failed'}`));
      };
    });
  }

  /**
   * Parse agent response into structured data
   */
  private parseAgentResponse(response: string): AnalysisData {
    try {
      // First try to parse as JSON if the agent returned structured data
      if (response.trim().startsWith('{')) {
        try {
          const jsonData = JSON.parse(response);
          return this.validateAnalysisData(jsonData);
        } catch (error) {
          // Fall back to text parsing if JSON parse fails
          console.warn('Response is not valid JSON, falling back to text parsing');
        }
      }

      // Initialize the analysis structure
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

      // Convert response to lowercase for case-insensitive matching
      const lowerResponse = response.toLowerCase();

      // Parse frontend technologies with more flexible matching
      const frontendPatterns = [
        { pattern: /next\.?js\s*(?:v?(\d+(?:\.\d+)*))?/i, name: 'nextjs', isFramework: true },
        { pattern: /react\s*(?:v?(\d+(?:\.\d+)*))?/i, name: 'react' },
        { pattern: /vue\.?js\s*(?:v?(\d+(?:\.\d+)*))?/i, name: 'vuejs', isFramework: true },
        { pattern: /angular\s*(?:v?(\d+(?:\.\d+)*))?/i, name: 'angular', isFramework: true },
        { pattern: /svelte/i, name: 'svelte', isFramework: true },
        { pattern: /tailwind(?:\s*css)?/i, name: 'tailwindcss' },
        { pattern: /radix[\s-]?ui/i, name: 'radix-ui' },
        { pattern: /material[\s-]?ui|mui/i, name: 'material-ui' },
        { pattern: /chakra[\s-]?ui/i, name: 'chakra-ui' },
      ];

      for (const { pattern, name, isFramework } of frontendPatterns) {
        const match = response.match(pattern);
        if (match) {
          const version = match[1] ? `@${match[1]}` : '';
          analysis.techStack.frontend!.push(`${name}${version}`);
          if (isFramework && !analysis.repository.mainFramework) {
            analysis.repository.mainFramework = name;
          }
        }
      }

      // Parse backend technologies
      const backendPatterns = [
        { pattern: /express\s*(?:v?(\d+(?:\.\d+)*))?/i, name: 'express' },
        { pattern: /fastify/i, name: 'fastify' },
        { pattern: /nest\.?js/i, name: 'nestjs' },
        { pattern: /koa/i, name: 'koa' },
        { pattern: /hapi/i, name: 'hapi' },
        { pattern: /django/i, name: 'django' },
        { pattern: /flask/i, name: 'flask' },
        { pattern: /rails|ruby on rails/i, name: 'rails' },
      ];

      for (const { pattern, name } of backendPatterns) {
        if (pattern.test(response)) {
          analysis.techStack.backend!.push(name);
        }
      }

      // Parse databases
      const databasePatterns = [
        { pattern: /postgres(?:ql)?/i, name: 'postgresql' },
        { pattern: /mysql/i, name: 'mysql' },
        { pattern: /mongodb?/i, name: 'mongodb' },
        { pattern: /redis/i, name: 'redis' },
        { pattern: /sqlite/i, name: 'sqlite' },
        { pattern: /dynamodb/i, name: 'dynamodb' },
      ];

      for (const { pattern, name } of databasePatterns) {
        if (pattern.test(response)) {
          analysis.techStack.databases!.push(name);
        }
      }

      // Parse languages
      const languagePatterns = [
        { pattern: /typescript/i, name: 'typescript', isPrimary: true },
        { pattern: /javascript/i, name: 'javascript', isPrimary: true },
        { pattern: /python/i, name: 'python', isPrimary: true },
        { pattern: /ruby/i, name: 'ruby', isPrimary: true },
        { pattern: /java(?!script)/i, name: 'java', isPrimary: true },
        { pattern: /c\+\+/i, name: 'cpp', isPrimary: true },
        { pattern: /c#|csharp/i, name: 'csharp', isPrimary: true },
        { pattern: /go(?:lang)?/i, name: 'go', isPrimary: true },
        { pattern: /rust/i, name: 'rust', isPrimary: true },
      ];

      for (const { pattern, name, isPrimary } of languagePatterns) {
        if (pattern.test(response)) {
          analysis.techStack.languages!.push(name);
          if (isPrimary && !analysis.repository.primaryLanguage) {
            analysis.repository.primaryLanguage = name;
          }
        }
      }

      // Parse testing frameworks
      const testingPatterns = [
        { pattern: /jest/i, name: 'jest' },
        { pattern: /mocha/i, name: 'mocha' },
        { pattern: /vitest/i, name: 'vitest' },
        { pattern: /cypress/i, name: 'cypress' },
        { pattern: /playwright/i, name: 'playwright' },
        { pattern: /testing[\s-]?library/i, name: 'testing-library' },
      ];

      for (const { pattern, name } of testingPatterns) {
        if (pattern.test(response)) {
          analysis.techStack.testing!.push(name);
        }
      }

      // Parse infrastructure
      const infrastructurePatterns = [
        { pattern: /docker/i, name: 'docker' },
        { pattern: /kubernetes|k8s/i, name: 'kubernetes' },
        { pattern: /github[\s-]?actions/i, name: 'github-actions' },
        { pattern: /gitlab[\s-]?ci/i, name: 'gitlab-ci' },
        { pattern: /jenkins/i, name: 'jenkins' },
        { pattern: /terraform/i, name: 'terraform' },
      ];

      for (const { pattern, name } of infrastructurePatterns) {
        if (pattern.test(response)) {
          analysis.techStack.infrastructure!.push(name);
        }
      }

      // Parse architecture patterns
      if (/clean[\s-]?architecture/i.test(response)) {
        analysis.patterns.architecture!.push('clean-architecture');
      }
      if (/mvc|model[\s-]?view[\s-]?controller/i.test(response)) {
        analysis.patterns.architecture!.push('mvc');
      }
      if (/microservice/i.test(response)) {
        analysis.patterns.architecture!.push('microservices');
      }
      if (/serverless/i.test(response)) {
        analysis.patterns.architecture!.push('serverless');
      }

      // Parse organization patterns
      if (/feature[\s-]?folder/i.test(response)) {
        analysis.patterns.organization!.push('feature-folders');
      }
      if (/domain[\s-]?driven/i.test(response)) {
        analysis.patterns.organization!.push('domain-driven-design');
      }

      // Parse repository type
      if (/monorepo/i.test(response)) {
        analysis.repository.type = 'monorepo';
      } else if (/single[\s-]?project/i.test(response)) {
        analysis.repository.type = 'single';
      }

      return analysis;
    } catch (error) {
      throw new ParsingError(
        `Failed to parse analysis response: ${error instanceof Error ? error.message : String(error)}`,
        'response',
        response
      );
    }
  }

  /**
   * Validate and normalize analysis data from JSON
   */
  private validateAnalysisData(data: any): AnalysisData {
    if (!data || typeof data !== 'object') {
      throw new ParsingError('Invalid analysis data: expected object');
    }

    // Ensure all required fields exist with defaults
    const validated: AnalysisData = {
      techStack: {
        frontend: data.techStack?.frontend || [],
        backend: data.techStack?.backend || [],
        databases: data.techStack?.databases || [],
        infrastructure: data.techStack?.infrastructure || [],
        testing: data.techStack?.testing || [],
        languages: data.techStack?.languages || [],
      },
      patterns: {
        architecture: data.patterns?.architecture || [],
        organization: data.patterns?.organization || [],
        practices: data.patterns?.practices || [],
      },
      repository: {
        type: data.repository?.type || 'unknown',
        mainFramework: data.repository?.mainFramework,
        primaryLanguage: data.repository?.primaryLanguage,
      },
    };

    return validated;
  }
}