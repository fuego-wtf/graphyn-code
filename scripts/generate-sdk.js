#!/usr/bin/env node

/**
 * SDK Generation Script for @graphyn/code
 * 
 * This script generates a TypeScript SDK from OpenAPI specifications
 * found in the graphyn-workspace repository.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WORKSPACE_PATH = process.env.GRAPHYN_WORKSPACE_PATH || '../graphyn-workspace';
const OPENAPI_DIR = path.join(WORKSPACE_PATH, 'sdk/openapi');
const SDK_OUTPUT_DIR = path.join(__dirname, '../src/sdk');
const TYPES_OUTPUT_DIR = path.join(__dirname, '../src/types');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.cyan) {
  console.log(`${color}${colors.bright}[SDK Generator]${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}${colors.bright}[ERROR]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}${colors.bright}[SUCCESS]${colors.reset} ${message}`);
}

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

// Copy OpenAPI specs to local directory for processing
function copyOpenApiSpecs() {
  log('Copying OpenAPI specifications...');
  
  const specs = [
    'graphyn-api.public.yaml',
    'graphyn-api.manual.yaml'
  ];
  
  const localOpenApiDir = path.join(__dirname, '../openapi');
  ensureDir(localOpenApiDir);
  
  specs.forEach(spec => {
    const sourcePath = path.join(OPENAPI_DIR, spec);
    const destPath = path.join(localOpenApiDir, spec);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      log(`Copied ${spec}`);
    } else {
      error(`OpenAPI spec not found: ${sourcePath}`);
    }
  });
  
  return localOpenApiDir;
}

// Generate TypeScript types using openapi-typescript
function generateTypes(openApiDir) {
  log('Generating TypeScript types...');
  
  ensureDir(TYPES_OUTPUT_DIR);
  
  const specs = [
    { input: 'graphyn-api.public.yaml', output: 'public-api.ts' },
    { input: 'graphyn-api.manual.yaml', output: 'manual-api.ts' }
  ];
  
  specs.forEach(({ input, output }) => {
    const inputPath = path.join(openApiDir, input);
    const outputPath = path.join(TYPES_OUTPUT_DIR, output);
    
    if (fs.existsSync(inputPath)) {
      try {
        execSync(`npx openapi-typescript "${inputPath}" --output "${outputPath}"`, {
          stdio: 'inherit'
        });
        log(`Generated types: ${output}`);
      } catch (err) {
        error(`Failed to generate types for ${input}: ${err.message}`);
      }
    }
  });
}

// Generate SDK client using openapi-generator-cli
function generateSDKClient(openApiDir) {
  log('Generating SDK client...');
  
  ensureDir(SDK_OUTPUT_DIR);
  
  // Use the public API spec as the primary spec
  const specPath = path.join(openApiDir, 'graphyn-api.public.yaml');
  
  if (!fs.existsSync(specPath)) {
    error(`Primary OpenAPI spec not found: ${specPath}`);
    return;
  }
  
  try {
    // Generate TypeScript SDK with axios
    execSync([
      'npx @openapitools/openapi-generator-cli generate',
      `-i "${specPath}"`,
      `-g typescript-axios`,
      `-o "${SDK_OUTPUT_DIR}/generated"`,
      '--additional-properties=npmName=@graphyn/sdk,supportsES6=true,withSeparateModelsAndApi=true,modelPackage=models,apiPackage=api'
    ].join(' '), {
      stdio: 'inherit'
    });
    
    log('Generated SDK client files');
  } catch (err) {
    error(`Failed to generate SDK client: ${err.message}`);
  }
}

// Create wrapper SDK with authentication
function createSDKWrapper() {
  log('Creating SDK wrapper with authentication...');
  
  const wrapperContent = `/**
 * Graphyn SDK Client
 * 
 * This is a wrapper around the generated OpenAPI client that includes
 * OAuth authentication and other enhancements for the CLI.
 */

import { Configuration, DefaultApi } from './generated';
import { OAuthManager } from '../auth/oauth.js';

export interface GraphynSDKOptions {
  apiBaseUrl?: string;
  accessToken?: string;
  oauthManager?: OAuthManager;
}

/**
 * Main SDK client class with OAuth authentication
 */
export class GraphynSDK {
  private api: DefaultApi;
  private oauthManager?: OAuthManager;

  constructor(options: GraphynSDKOptions = {}) {
    const apiBaseUrl = options.apiBaseUrl || process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    
    // Configure the generated client
    const configuration = new Configuration({
      basePath: apiBaseUrl,
      accessToken: options.accessToken,
    });

    this.api = new DefaultApi(configuration);
    this.oauthManager = options.oauthManager;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string | undefined> {
    if (this.oauthManager) {
      return await this.oauthManager.getValidToken();
    }
    return undefined;
  }

  /**
   * Update the API configuration with a new access token
   */
  private async updateConfiguration() {
    const token = await this.getAccessToken();
    if (token) {
      this.api.configuration.accessToken = token;
    }
  }

  // Threads API
  async createThread(data: any) {
    await this.updateConfiguration();
    return this.api.apiThreadsPost(data);
  }

  async getThread(id: string) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdGet(id);
  }

  async listThreads() {
    await this.updateConfiguration();
    return this.api.apiThreadsGet();
  }

  async sendMessage(threadId: string, content: string) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdMessagesPost(threadId, { content });
  }

  async getMessages(threadId: string, limit?: number, offset?: number) {
    await this.updateConfiguration();
    return this.api.apiThreadsIdMessagesGet(threadId, limit, offset);
  }

  // Auth API
  async validateApiKey(apiKey: string) {
    return this.api.apiAuthValidatePost({ api_key: apiKey });
  }

  async refreshToken(refreshToken: string) {
    return this.api.apiAuthRefreshPost({ refresh_token: refreshToken });
  }

  // Chat Completions (OpenAI-compatible)
  async createChatCompletion(data: any) {
    await this.updateConfiguration();
    return this.api.apiChatCompletionsPost(data);
  }

  async listModels() {
    await this.updateConfiguration();
    return this.api.apiModelsGet();
  }

  // Direct access to the underlying API client
  get client() {
    return this.api;
  }
}

// Re-export generated types
export * from './generated';
`;

  const wrapperPath = path.join(SDK_OUTPUT_DIR, 'index.ts');
  fs.writeFileSync(wrapperPath, wrapperContent);
  log('Created SDK wrapper');
}

// Create index file for easy imports
function createIndexFile() {
  log('Creating index file...');
  
  const indexContent = `/**
 * @graphyn/code SDK
 * 
 * Generated TypeScript SDK for Graphyn API
 */

// Main SDK export
export { GraphynSDK } from './sdk';
export type { GraphynSDKOptions } from './sdk';

// Generated API types
export * from './types/public-api';
export * from './types/manual-api';

// Re-export existing client for compatibility
export { GraphynAPIClient as LegacyClient } from './api/client';
`;

  const indexPath = path.join(__dirname, '../src/index-sdk.ts');
  fs.writeFileSync(indexPath, indexContent);
  log('Created index file');
}

// Main execution
async function main() {
  try {
    log('Starting SDK generation...');
    
    // Check if workspace exists
    if (!fs.existsSync(OPENAPI_DIR)) {
      error(`OpenAPI directory not found: ${OPENAPI_DIR}`);
      error('Please ensure the graphyn-workspace repository is available');
      process.exit(1);
    }
    
    // Copy OpenAPI specs locally
    const localOpenApiDir = copyOpenApiSpecs();
    
    // Generate TypeScript types
    generateTypes(localOpenApiDir);
    
    // Generate SDK client
    generateSDKClient(localOpenApiDir);
    
    // Create wrapper with authentication
    createSDKWrapper();
    
    // Create index file
    createIndexFile();
    
    success('SDK generation completed successfully!');
    log('');
    log('Generated files:');
    log('  - src/types/public-api.ts    (TypeScript types from public API)');
    log('  - src/types/manual-api.ts    (TypeScript types from manual API)');
    log('  - src/sdk/generated/         (Generated API client)');
    log('  - src/sdk/index.ts           (SDK wrapper with OAuth)');
    log('  - src/index-sdk.ts           (Main SDK exports)');
    
  } catch (err) {
    error(`SDK generation failed: ${err.message}`);
    process.exit(1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };