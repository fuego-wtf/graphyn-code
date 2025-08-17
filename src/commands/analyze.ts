import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { GraphynAPIClient } from '../api-client.js';
import { RepositoryAnalyzerService } from '../services/repository-analyzer.js';
import { ConfigManager } from '../config-manager.js';
import fs from 'fs';
import path from 'path';

export interface AnalyzeOptions {
  mode?: string;
  save?: boolean;
  output?: string;
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

    // Check authentication
    const oauthManager = new OAuthManager();
    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.error('❌ Not authenticated. Please run "graphyn auth" first.'));
      return;
    }

    // Get valid token
    const token = await oauthManager.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Initialize API client
    const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    const apiClient = new GraphynAPIClient(apiUrl);
    apiClient.setToken(token);

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
    const result = await analyzer.analyze(process.cwd(), mode);

    // Display results
    console.log(analyzer.formatAnalysisForDisplay(result));

    // Save results if requested
    if (options.save) {
      await saveAnalysisResult(result, options.output);
      console.log(colors.success(`\n💾 Analysis saved!`));
    }

    // Save to cache for squad creation
    await cacheAnalysisResult(result);
    console.log(colors.info('\n📌 Analysis cached for squad creation'));
    console.log(colors.info('Run "graphyn <your request>" to create a squad with this context'));

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