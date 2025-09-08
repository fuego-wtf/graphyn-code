import chalk from 'chalk';
// OAuthManager removed - auth disabled
import { GraphynAPIClient } from '../api-client.js';
import { RepositoryAnalyzerService } from '../services/repository-analyzer.js';
import { ConfigManager } from '../config-manager.js';
import fs from 'fs';
import path from 'path';

export interface AnalyzeOptions {
  mode?: string;
  save?: boolean;
  output?: string;
  dev?: boolean;
  query?: string;
  workDir?: string;
}

export async function analyzeRepository(options: AnalyzeOptions = {}) {
  const colors = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.gray,
    highlight: chalk.cyan,
  };

  try {
    console.log(colors.info('🚀 Starting repository analysis...\n'));

    // In dev mode, we can skip authentication and work locally
    if (!options.dev) {
      console.log(colors.info('⚠️  Authentication disabled - working in offline mode'));
    }

    // Create analyzer service (no longer needs apiClient)
    const analyzer = new RepositoryAnalyzerService();

    // Show available modes if mode is invalid
    const mode = options.mode || 'detailed';
    const availableModes = analyzer.getAvailableContextModes();
    
    if (!availableModes.includes(mode)) {
      console.log(colors.error(`❌ Invalid mode: ${mode}`));
      console.log(colors.info(`Available modes: ${availableModes.join(', ')}`));
      return;
    }

    console.log(colors.info(`Using context mode: ${colors.highlight(mode)}\n`));

    // Analyze repository
    const workDir = options.workDir || process.cwd();
    const result = await analyzer.analyze(workDir, mode);

    // Display results
    console.log(analyzer.formatAnalysisForDisplay(result));

    // In dev mode with query, provide AI explanation
    if (options.dev && options.query) {
      console.log(colors.info('\n🤖 Generating explanation...\n'));
      
      try {
        const explanation = await generateRepositoryExplanation(result, options.query);
        console.log(colors.highlight('📝 Repository Explanation:'));
        console.log(colors.info('─'.repeat(50)));
        console.log(explanation);
        console.log(colors.info('─'.repeat(50)));
      } catch (error) {
        console.log(colors.warning(`⚠️  Could not generate AI explanation (working offline): ${(error as any).message}`));
        console.log(colors.info('\nHere\'s what I found in your repository:'));
        console.log(colors.info('─'.repeat(50)));
        console.log(generateBasicExplanation(result, options.query));
        console.log(colors.info('─'.repeat(50)));
      }
    } else {
      // Save results if requested
      if (options.save) {
        await saveAnalysisResult(result, options.output);
        console.log(colors.success(`\n💾 Analysis saved!`));
      }

      // Save to cache for squad creation
      await cacheAnalysisResult(result);
      console.log(colors.info('\n📌 Analysis cached for squad creation'));
      console.log(colors.info('Run "graphyn <your request>" to create a squad with this context'));
    }

  } catch (error) {
    console.error(colors.error('❌ Analysis failed:'), error);
  }
}

/**
 * Save analysis result to file
 */
async function saveAnalysisResult(result: any, outputPath?: string): Promise<void> {
  const configManager = new ConfigManager();
  const graphynDir = path.join(configManager.getConfigDir(), 'analyses');
  
  // Ensure directory exists
  if (!fs.existsSync(graphynDir)) {
    fs.mkdirSync(graphynDir, { recursive: true });
  }

  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = outputPath || `analysis-${timestamp}.json`;
  const fullPath = path.isAbsolute(filename) 
    ? filename 
    : path.join(outputPath ? process.cwd() : graphynDir, filename);

  // Save result
  fs.writeFileSync(fullPath, JSON.stringify(result, null, 2));
  console.log(chalk.gray(`Saved to: ${fullPath}`));
}

/**
 * Cache analysis result for squad creation
 */
async function cacheAnalysisResult(result: any): Promise<void> {
  const configManager = new ConfigManager();
  
  // Save as current analysis
  await configManager.set('currentAnalysis', {
    ...result,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Get cached analysis if available
 */
export async function getCachedAnalysis(): Promise<any> {
  const configManager = new ConfigManager();
  const cached = await configManager.get('currentAnalysis');
  
  if (!cached) return null;
  
  // Check if cache is still fresh (1 hour)
  const cachedAt = new Date(cached.cachedAt);
  const now = new Date();
  const hoursSinceCache = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceCache > 1) {
    // Cache is stale
    await configManager.delete('currentAnalysis');
    return null;
  }
  
  return cached;
}

/**
 * Generate AI-powered explanation of repository contents
 */
async function generateRepositoryExplanation(analysis: any, query: string): Promise<string> {
  // Try to use the API client to get an AI explanation
  try {
    // First, let's try to connect to the backend
    const apiUrl = process.env.GRAPHYN_API_URL || 'http://localhost:4000';
    const apiClient = new GraphynAPIClient(apiUrl);
    
    // Check if backend is available with a simple ping
    try {
      await apiClient.ping();
      console.log(chalk.gray(`✓ Connected to backend at ${apiUrl}`));
    } catch (pingError) {
      throw new Error(`Backend not reachable at ${apiUrl}: ${(pingError as any).message}`);
    }
    
    // Auth disabled - continue without token
    
    // Create a prompt for the AI to explain the repository
    const prompt = `Based on this repository analysis, please answer the user's question: "${query}"

Repository Analysis:
- Name: ${analysis.name}
- Type: ${analysis.type}
- Language: ${analysis.language}
- Framework: ${analysis.framework || 'Not detected'}
- Packages: ${analysis.packages?.length || 0}${analysis.packages ? '\n  - ' + analysis.packages.join('\n  - ') : ''}
- Git Branch: ${analysis.gitInfo?.branch || 'Unknown'}
- Directory Structure: ${analysis.structure.directories.length} directories
- File Types: ${Object.entries(analysis.structure.files).map(([ext, count]) => `${ext}: ${count}`).join(', ')}

Please provide a clear, helpful explanation of what's in this repository and answer the user's specific question.`;

    // Try to call an AI explanation endpoint
    try {
      const response = await apiClient.post<{explanation?: string; message?: string}>('/api/code/explain', {
        prompt,
        analysis,
        query
      });
      
      return response.explanation || response.message || 'AI explanation received but empty';
    } catch (apiError) {
      // If the endpoint doesn't exist, suggest creating it
      if ((apiError as any).message.includes('404')) {
        throw new Error(`Backend connected but /api/code/explain endpoint not found. Please implement this endpoint in your backend.`);
      }
      throw new Error(`Backend API error: ${(apiError as any).message}`);
    }
    
  } catch (error) {
    // Fall back to basic explanation with more detailed error
    throw new Error(`AI explanation failed: ${(error as any).message}`);
  }
}

/**
 * Generate basic explanation without AI
 */
function generateBasicExplanation(analysis: any, query: string): string {
  const lines: string[] = [];
  
  lines.push(`📂 **${analysis.name}** is a ${analysis.type} repository`);
  
  if (analysis.language && analysis.language !== 'unknown') {
    lines.push(`🔧 Primary language: **${analysis.language}**${analysis.framework ? ` (${analysis.framework} framework)` : ''}`);
  }
  
  if (analysis.type === 'monorepo' && analysis.packages?.length) {
    lines.push(`📦 Contains ${analysis.packages.length} packages:`);
    analysis.packages.slice(0, 10).forEach((pkg: any) => lines.push(`   • ${pkg}`));
    if (analysis.packages.length > 10) {
      lines.push(`   • ... and ${analysis.packages.length - 10} more`);
    }
  }
  
  if (analysis.gitInfo?.branch) {
    lines.push(`🌲 Currently on branch: **${analysis.gitInfo.branch}**`);
  }
  
  lines.push(`📁 Structure: ${analysis.structure.directories.length} directories with ${Object.keys(analysis.structure.files).length} different file types`);
  
  if (Object.keys(analysis.structure.files).length > 0) {
    const topFileTypes = Object.entries(analysis.structure.files)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `${ext} (${count})`)
      .join(', ');
    lines.push(`📄 Main file types: ${topFileTypes}`);
  }
  
  // Try to answer the specific query
  const queryWords = query.toLowerCase();
  const shouldExplain = queryWords.includes('what') || 
                       queryWords.includes('explain') || 
                       queryWords.includes('understand') ||
                       queryWords.includes('tell') ||
                       queryWords.includes('describe') ||
                       queryWords.includes('analyze') ||
                       queryWords.includes('help');
                       
  if (shouldExplain) {
    lines.push('');
    lines.push('💡 **Summary**: This appears to be ' + describeRepository(analysis));
  }
  
  return lines.join('\n');
}

/**
 * Check if the analysis indicates an Encore.dev backend project
 */
function isEncoreBackend(analysis: any): boolean {
  const directories = analysis.structure?.directories || [];
  const files = Object.keys(analysis.structure?.files || {});
  
  // Look for encore-specific files and structure
  const hasEncoreConfig = directories.some((dir: string) => dir.includes('encore.toml') || dir.includes('encore.app'));
  const hasServiceFiles = directories.some((dir: string) => dir.includes('encore.service.ts'));
  const hasEncoreGenDir = directories.some((dir: string) => dir.includes('encore.gen'));
  const hasTypescriptFiles = files.includes('.ts');
  
  return hasEncoreConfig || hasServiceFiles || hasEncoreGenDir || (hasTypescriptFiles && directories.some((dir: string) => 
    ['auth', 'api-gateway', 'threads', 'monitoring', 'identity'].some(service => dir.includes(service))
  ));
}

/**
 * Extract Encore.dev services from analysis
 */
function getEncoreServicesLocal(analysis: any): string[] {
  const directories = analysis.structure?.directories || [];
  const knownServices = [
    'auth', 'api-gateway', 'threads', 'monitoring', 'identity', 
    'settings', 'admin-bff', 'database', 'core'
  ];
  
  return knownServices.filter(service => 
    directories.some((dir: string) => dir.includes(service) && !dir.includes('node_modules'))
  );
}

/**
 * Describe what the repository likely contains based on analysis
 */
function describeRepository(analysis: any): string {
  // Check for CLI-specific indicators first
  if (analysis.name === 'code' || analysis.path.includes('/code')) {
    // Look for CLI indicators in the structure
    const hasInkComponents = analysis.structure.directories.some((dir: any) => dir.includes('ink'));
    const hasCliCommands = analysis.structure.directories.some((dir: any) => dir.includes('commands'));
    const hasBinScript = analysis.structure.files['.js'] > 0; // likely has bin scripts
    
    if (hasInkComponents && hasCliCommands) {
      return 'a TypeScript CLI (command-line interface) tool with interactive UI components built using Ink (React for CLIs). This appears to be a development tool that provides both interactive and command-line interfaces.';
    }
  }

  // Check for Encore.dev backend indicators
  if (analysis.name === 'backyard' || isEncoreBackend(analysis)) {
    const services = getEncoreServicesLocal(analysis);
    return `an Encore.dev distributed backend system with ${services.length} microservices: ${services.join(', ')}. This appears to be a sophisticated backend API platform built with Encore.dev framework for type-safe microservices, featuring OAuth authentication, real-time messaging, agent orchestration, and monitoring capabilities.`;
  }

  // Check package.json content for more specific detection
  if (analysis.language === 'typescript' && analysis.framework === 'react') {
    // If it has React but also CLI-like structure, it's likely a CLI with UI
    const hasCliStructure = analysis.structure.directories.some((dir: any) => 
      dir.includes('commands') || dir.includes('cli') || dir.includes('bin')
    );
    
    if (hasCliStructure) {
      return 'a TypeScript CLI tool that uses React components for interactive terminal interfaces (likely built with Ink framework).';
    }
    
    return 'a React application for building user interfaces.';
  }
  
  if (analysis.framework === 'nextjs') {
    return 'a Next.js web application with TypeScript/JavaScript frontend and backend capabilities.';
  } else if (analysis.framework === 'nestjs') {
    return 'a NestJS backend API application with TypeScript.';
  } else if (analysis.framework === 'express') {
    return 'an Express.js backend server application.';
  } else if (analysis.language === 'python' && analysis.framework === 'django') {
    return 'a Django web application written in Python.';
  } else if (analysis.language === 'python' && analysis.framework === 'flask') {
    return 'a Flask web application written in Python.';
  } else if (analysis.language === 'python') {
    return 'a Python application or script collection.';
  } else if (analysis.language === 'go') {
    return 'a Go application, likely a backend service or CLI tool.';
  } else if (analysis.language === 'rust') {
    return 'a Rust application, known for performance and safety.';
  } else if (analysis.type === 'monorepo') {
    return `a monorepo containing ${analysis.packages?.length || 'multiple'} packages/applications.`;
  } else if (analysis.language === 'typescript' || analysis.language === 'javascript') {
    return 'a TypeScript/JavaScript project, possibly a web application or Node.js service.';
  } else {
    return 'a software development project with various components and files.';
  }
}