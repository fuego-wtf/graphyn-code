/**
 * Figma Implementor Agent
 *
 * Specialized Claude Code agent that orchestrates the complete Figma-to-code workflow.
 * Handles OAuth authentication, design extraction, component generation, and integration
 * into React applications with full transparency and error handling.
 */

import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
import { FigmaOAuthHandler, createFigmaOAuthHandler } from '../../../core/src/figma/figma-oauth-handler.js';
import { FigmaPrototypeExtractor, ExtractedComponent } from '../../../core/src/figma/prototype-extractor.js';
import { ComponentGenerator, createComponentGenerator, ComponentGenerationResult } from '../../../core/src/figma/component-generator.js';
import { I18nKeyMapper, createI18nKeyMapper, I18nExtractionResult } from '../../../core/src/figma/i18n-key-mapper.js';
import { promises as fs } from 'fs';
import path from 'path';

export interface FigmaWorkflowConfig {
  userDataPath: string;
  outputPath: string;
  cssFramework: 'styled-components' | 'tailwind' | 'css-modules';
  generateStorybook: boolean;
  generateTests: boolean;
  languages: string[];
  includeI18n: boolean;
}

export interface FigmaWorkflowProgress {
  stage: 'auth' | 'extraction' | 'generation' | 'i18n' | 'integration' | 'complete';
  progress: number;
  message: string;
  componentsProcessed?: number;
  totalComponents?: number;
  errors?: string[];
}

export interface FigmaWorkflowResult {
  success: boolean;
  components: ExtractedComponent[];
  generatedFiles: string[];
  i18nResult?: I18nExtractionResult;
  warnings: string[];
  errors: string[];
  metrics: {
    totalComponents: number;
    filesGenerated: number;
    i18nKeysExtracted: number;
    processingTimeMs: number;
  };
}

/**
 * Progress tracking and reporting
 */
class WorkflowProgressTracker {
  private progressCallback?: (progress: FigmaWorkflowProgress) => void;

  constructor(progressCallback?: (progress: FigmaWorkflowProgress) => void) {
    this.progressCallback = progressCallback;
  }

  reportProgress(stage: FigmaWorkflowProgress['stage'], progress: number, message: string, metadata?: Partial<FigmaWorkflowProgress>): void {
    const progressUpdate: FigmaWorkflowProgress = {
      stage,
      progress,
      message,
      ...metadata,
    };

    if (this.progressCallback) {
      this.progressCallback(progressUpdate);
    }

    // Also log to console for CLI transparency
    console.log(`🎨 [${stage.toUpperCase()}] ${Math.round(progress)}% - ${message}`);
  }
}

/**
 * File system operations for component output
 */
class ComponentFileManager {
  private outputPath: string;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
  }

  /**
   * Create directory structure for generated components
   */
  async initializeOutputDirectory(): Promise<void> {
    const directories = [
      'components',
      'components/stories',
      'components/tests',
      'translations',
      'types',
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.outputPath, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Write component files to disk
   */
  async writeComponentFiles(results: ComponentGenerationResult[]): Promise<string[]> {
    const writtenFiles: string[] = [];

    for (const result of results) {
      for (const file of result.files) {
        let filePath: string;

        switch (file.type) {
          case 'component':
            filePath = path.join(this.outputPath, 'components', file.path);
            break;
          case 'styles':
            filePath = path.join(this.outputPath, 'components', file.path);
            break;
          case 'types':
            filePath = path.join(this.outputPath, 'types', file.path);
            break;
          case 'story':
            filePath = path.join(this.outputPath, 'components', 'stories', file.path);
            break;
          case 'test':
            filePath = path.join(this.outputPath, 'components', 'tests', file.path);
            break;
          default:
            filePath = path.join(this.outputPath, file.path);
        }

        await fs.writeFile(filePath, file.content, 'utf-8');
        writtenFiles.push(filePath);
      }
    }

    return writtenFiles;
  }

  /**
   * Write i18n translation files
   */
  async writeI18nFiles(i18nResult: I18nExtractionResult): Promise<string[]> {
    const writtenFiles: string[] = [];

    // Write translation JSON files
    for (const file of i18nResult.files) {
      const filePath = path.join(this.outputPath, 'translations', `${file.language}.json`);
      await fs.writeFile(filePath, JSON.stringify(file.translations, null, 2), 'utf-8');
      writtenFiles.push(filePath);
    }

    // Write TypeScript types for translations
    const keyMapper = createI18nKeyMapper();
    const typesContent = keyMapper.generateTranslationTypes(i18nResult.keys);
    const typesPath = path.join(this.outputPath, 'types', 'translations.ts');
    await fs.writeFile(typesPath, typesContent, 'utf-8');
    writtenFiles.push(typesPath);

    // Write React hooks for each component mapping
    for (const mapping of i18nResult.mappings) {
      if (mapping.textMappings.length > 0) {
        const hookContent = keyMapper.generateReactI18nHook(mapping);
        const hookPath = path.join(this.outputPath, 'components', `use${mapping.componentName}Translation.ts`);
        await fs.writeFile(hookPath, hookContent, 'utf-8');
        writtenFiles.push(hookPath);
      }
    }

    return writtenFiles;
  }

  /**
   * Generate component index file
   */
  async generateComponentIndex(components: ExtractedComponent[]): Promise<string> {
    const exports = components.map(component =>
      `export { ${component.name} } from './${component.name}';`
    ).join('\n');

    const indexContent = `/**
 * Generated component exports from Figma
 * Auto-generated by Graphyn Figma Implementor Agent
 */

${exports}

// Component type exports
${components.map(component =>
  `export type { ${component.name}Props } from './${component.name}';`
).join('\n')}
`;

    const indexPath = path.join(this.outputPath, 'components', 'index.ts');
    await fs.writeFile(indexPath, indexContent, 'utf-8');
    return indexPath;
  }
}

/**
 * Main Figma Implementor Agent
 */
export class FigmaImplementorAgent extends ClaudeCodeAgent {
  private oauthHandler: FigmaOAuthHandler;
  private extractor: FigmaPrototypeExtractor;
  private generator: ComponentGenerator;
  private i18nMapper: I18nKeyMapper;
  private fileManager: ComponentFileManager;
  private progressTracker: WorkflowProgressTracker;

  constructor(
    config: FigmaWorkflowConfig,
    progressCallback?: (progress: FigmaWorkflowProgress) => void
  ) {
    super({
      id: 'figma-implementor-001',
      name: 'Figma Implementor Agent',
      specialization: 'Figma-to-React code generation with i18n support',
      workingDirectory: config.outputPath,
      tools: ['write', 'read', 'bash'],
    });

    this.oauthHandler = createFigmaOAuthHandler(config.userDataPath);
    this.extractor = new FigmaPrototypeExtractor(this.oauthHandler);
    this.generator = createComponentGenerator(config.cssFramework);
    this.i18nMapper = createI18nKeyMapper();
    this.fileManager = new ComponentFileManager(config.outputPath);
    this.progressTracker = new WorkflowProgressTracker(progressCallback);
  }

  /**
   * Execute complete Figma-to-React workflow
   */
  async executeFigmaWorkflow(
    figmaUrl: string,
    config: FigmaWorkflowConfig
  ): Promise<FigmaWorkflowResult> {
    const startTime = Date.now();
    const result: FigmaWorkflowResult = {
      success: false,
      components: [],
      generatedFiles: [],
      warnings: [],
      errors: [],
      metrics: {
        totalComponents: 0,
        filesGenerated: 0,
        i18nKeysExtracted: 0,
        processingTimeMs: 0,
      },
    };

    try {
      // Stage 1: Authentication
      this.progressTracker.reportProgress('auth', 5, 'Verifying Figma authentication...');
      await this.ensureAuthentication();

      // Stage 2: Design Extraction
      this.progressTracker.reportProgress('extraction', 20, 'Extracting components from Figma...');
      result.components = await this.extractor.extractFromUrl(figmaUrl);
      result.metrics.totalComponents = result.components.length;

      this.progressTracker.reportProgress(
        'extraction',
        40,
        `Extracted ${result.components.length} components`,
        { totalComponents: result.components.length }
      );

      // Stage 3: Component Generation
      this.progressTracker.reportProgress('generation', 50, 'Generating React components...');
      await this.fileManager.initializeOutputDirectory();

      const generationResults = await this.generator.generateComponents(result.components);

      // Track generation progress
      for (let i = 0; i < generationResults.length; i++) {
        const progress = 50 + (i / generationResults.length) * 20;
        this.progressTracker.reportProgress(
          'generation',
          progress,
          `Generated ${generationResults[i].component.name}`,
          {
            componentsProcessed: i + 1,
            totalComponents: generationResults.length
          }
        );
      }

      // Write component files
      const componentFiles = await this.fileManager.writeComponentFiles(generationResults);
      result.generatedFiles.push(...componentFiles);

      // Generate component index
      const indexFile = await this.fileManager.generateComponentIndex(result.components);
      result.generatedFiles.push(indexFile);

      // Collect warnings from generation
      for (const genResult of generationResults) {
        result.warnings.push(...genResult.warnings);
      }

      result.metrics.filesGenerated = result.generatedFiles.length;

      // Stage 4: i18n Processing (if enabled)
      if (config.includeI18n) {
        this.progressTracker.reportProgress('i18n', 75, 'Extracting translation keys...');

        result.i18nResult = await this.i18nMapper.extractI18nKeys(
          result.components,
          config.languages
        );

        const i18nFiles = await this.fileManager.writeI18nFiles(result.i18nResult);
        result.generatedFiles.push(...i18nFiles);
        result.warnings.push(...result.i18nResult.warnings);
        result.metrics.i18nKeysExtracted = result.i18nResult.keys.length;

        this.progressTracker.reportProgress(
          'i18n',
          85,
          `Generated ${result.i18nResult.keys.length} translation keys`
        );
      }

      // Stage 5: Integration (Claude Code integration)
      this.progressTracker.reportProgress('integration', 90, 'Integrating with project...');
      await this.integrateWithProject(config);

      // Stage 6: Complete
      result.metrics.processingTimeMs = Date.now() - startTime;
      result.success = true;

      this.progressTracker.reportProgress(
        'complete',
        100,
        `Workflow complete! Generated ${result.metrics.filesGenerated} files`,
        {
          componentsProcessed: result.metrics.totalComponents,
          totalComponents: result.metrics.totalComponents,
        }
      );

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      result.metrics.processingTimeMs = Date.now() - startTime;

      this.progressTracker.reportProgress(
        'complete',
        100,
        `Workflow failed: ${errorMessage}`,
        { errors: [errorMessage] }
      );

      return result;
    }
  }

  /**
   * Ensure Figma authentication is valid
   */
  private async ensureAuthentication(): Promise<void> {
    const isAuthenticated = await this.oauthHandler.isAuthenticated();

    if (!isAuthenticated) {
      throw new Error(
        'Figma authentication required. Please run `graphyn figma auth` to authenticate.'
      );
    }

    // Verify token works by getting user info
    try {
      await this.oauthHandler.getUserInfo();
    } catch (error) {
      throw new Error(
        'Figma authentication invalid. Please run `graphyn figma auth` to re-authenticate.'
      );
    }
  }

  /**
   * Integrate generated components with existing project
   */
  private async integrateWithProject(config: FigmaWorkflowConfig): Promise<void> {
    // Check if this is a React project
    const packageJsonPath = path.join(config.outputPath, '..', 'package.json');

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Add necessary dependencies if they don't exist
      const requiredDeps = this.getRequiredDependencies(config);
      const missingDeps = requiredDeps.filter(dep =>
        !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
      );

      if (missingDeps.length > 0) {
        console.log(`📦 Recommended dependencies to install: ${missingDeps.join(', ')}`);
        console.log('Run: npm install ' + missingDeps.join(' '));
      }

    } catch (error) {
      // Not a Node.js project or package.json not accessible
      console.log('ℹ️ Integration skipped: Not a Node.js project or package.json not accessible');
    }
  }

  /**
   * Get required dependencies based on configuration
   */
  private getRequiredDependencies(config: FigmaWorkflowConfig): string[] {
    const deps = ['react', '@types/react'];

    switch (config.cssFramework) {
      case 'styled-components':
        deps.push('styled-components', '@types/styled-components');
        break;
      case 'tailwind':
        deps.push('tailwindcss', '@types/tailwindcss');
        break;
    }

    if (config.includeI18n) {
      deps.push('react-i18next', 'i18next');
    }

    if (config.generateStorybook) {
      deps.push('@storybook/react', '@storybook/addon-essentials');
    }

    if (config.generateTests) {
      deps.push('@testing-library/react', '@testing-library/jest-dom');
    }

    return deps;
  }

  /**
   * Quick authentication check for CLI
   */
  async checkAuthenticationStatus(): Promise<{
    authenticated: boolean;
    userInfo?: {
      email: string;
      handle: string;
    };
    error?: string;
  }> {
    try {
      const isAuthenticated = await this.oauthHandler.isAuthenticated();

      if (!isAuthenticated) {
        return { authenticated: false };
      }

      const userInfo = await this.oauthHandler.getUserInfo();
      return {
        authenticated: true,
        userInfo: {
          email: userInfo.email,
          handle: userInfo.handle,
        },
      };

    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start OAuth authentication flow
   */
  async startAuthentication(): Promise<void> {
    try {
      console.log('🔐 Starting Figma OAuth authentication...');
      console.log('📱 Opening browser for authorization...');

      await this.oauthHandler.startAuthFlow();

      console.log('✅ Authentication successful!');
      const userInfo = await this.oauthHandler.getUserInfo();
      console.log(`👤 Logged in as: ${userInfo.handle} (${userInfo.email})`);

    } catch (error) {
      console.error('❌ Authentication failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Logout from Figma
   */
  async logout(): Promise<void> {
    try {
      await this.oauthHandler.logout();
      console.log('👋 Logged out from Figma successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Preview extracted components without generating files
   */
  async previewExtraction(figmaUrl: string): Promise<{
    components: ExtractedComponent[];
    componentCount: number;
    textContentCount: number;
    estimatedFiles: number;
  }> {
    await this.ensureAuthentication();

    const components = await this.extractor.extractFromUrl(figmaUrl);
    const textContentCount = components.reduce((total, comp) => total + comp.textContent.length, 0);

    // Estimate files that would be generated
    let estimatedFiles = components.length; // Main component files

    if (this.generator['config'].includeStorybook) {
      estimatedFiles += components.length; // Story files
    }

    if (this.generator['config'].includeTests) {
      estimatedFiles += components.length; // Test files
    }

    // Add CSS modules if applicable
    if (this.generator['config'].cssFramework === 'css-modules') {
      estimatedFiles += components.length;
    }

    return {
      components,
      componentCount: components.length,
      textContentCount,
      estimatedFiles,
    };
  }
}

/**
 * Factory function to create Figma Implementor Agent
 */
export function createFigmaImplementorAgent(
  config: FigmaWorkflowConfig,
  progressCallback?: (progress: FigmaWorkflowProgress) => void
): FigmaImplementorAgent {
  return new FigmaImplementorAgent(config, progressCallback);
}