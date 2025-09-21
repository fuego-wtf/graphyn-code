/**
 * Figma Component Extraction CLI Command
 *
 * Extracts Figma design components and generates React components
 * with full workflow progress tracking and user configuration options.
 */

import { Command } from 'commander';
import { createFigmaImplementorAgent, FigmaWorkflowConfig, FigmaWorkflowProgress } from '../../../../packages/agents/src/specialized/figma-implementor-agent.js';
import { UserDataManager } from '../utils/UserDataManager.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Progress tracking for the extraction workflow
 */
class ExtractionProgressDisplay {
  private startTime = Date.now();
  private lastStage = '';

  displayProgress(progress: FigmaWorkflowProgress): void {
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = `${Math.floor(elapsed / 1000)}s`;

    // Clear previous line and show current progress
    if (this.lastStage !== progress.stage) {
      console.log(`\n🎨 ${this.getStageEmoji(progress.stage)} ${this.getStageName(progress.stage)}`);
      this.lastStage = progress.stage;
    }

    // Progress bar visualization
    const progressBar = this.createProgressBar(progress.progress);
    const componentInfo = this.getComponentInfo(progress);

    process.stdout.write(`\r   ${progressBar} ${Math.round(progress.progress)}% | ${progress.message} ${componentInfo} [${elapsedStr}]`);

    // Show errors if any
    if (progress.errors && progress.errors.length > 0) {
      console.log('\n');
      for (const error of progress.errors) {
        console.log(`   ❌ Error: ${error}`);
      }
    }

    // Final completion message
    if (progress.stage === 'complete' && progress.progress === 100) {
      console.log('\n');
    }
  }

  private getStageEmoji(stage: string): string {
    const emojis: Record<string, string> = {
      'auth': '🔐',
      'extraction': '📥',
      'generation': '⚡',
      'i18n': '🌐',
      'integration': '🔗',
      'complete': '✅'
    };
    return emojis[stage] || '🔄';
  }

  private getStageName(stage: string): string {
    const names: Record<string, string> = {
      'auth': 'Authentication',
      'extraction': 'Component Extraction',
      'generation': 'Code Generation',
      'i18n': 'Internationalization',
      'integration': 'Project Integration',
      'complete': 'Complete'
    };
    return names[stage] || stage;
  }

  private createProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private getComponentInfo(progress: FigmaWorkflowProgress): string {
    if (progress.componentsProcessed && progress.totalComponents) {
      return `(${progress.componentsProcessed}/${progress.totalComponents})`;
    }
    return '';
  }
}

/**
 * Validate Figma URL format
 */
function validateFigmaUrl(url: string): boolean {
  const figmaUrlPattern = /^https:\/\/(?:www\.)?figma\.com\/(file|design)\/[a-zA-Z0-9]{22,128}\//;
  return figmaUrlPattern.test(url);
}

/**
 * Detect project settings from current directory
 */
async function detectProjectSettings(outputPath: string): Promise<Partial<FigmaWorkflowConfig>> {
  const config: Partial<FigmaWorkflowConfig> = {};

  try {
    // Check for package.json
    const packageJsonPath = path.join(outputPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // Detect CSS framework
    if (packageJson.dependencies?.['styled-components'] || packageJson.devDependencies?.['styled-components']) {
      config.cssFramework = 'styled-components';
    } else if (packageJson.dependencies?.['tailwindcss'] || packageJson.devDependencies?.['tailwindcss']) {
      config.cssFramework = 'tailwind';
    } else {
      config.cssFramework = 'css-modules';
    }

    // Detect Storybook
    if (packageJson.devDependencies?.['@storybook/react']) {
      config.generateStorybook = true;
    }

    // Detect i18n
    if (packageJson.dependencies?.['react-i18next'] || packageJson.dependencies?.['i18next']) {
      config.includeI18n = true;
      config.languages = ['en']; // Default, could be enhanced to detect more
    }

    // Detect testing
    if (packageJson.devDependencies?.['@testing-library/react']) {
      config.generateTests = true;
    }

  } catch (error) {
    // Use defaults if package.json not found or invalid
  }

  return config;
}

/**
 * Create Figma extract command
 */
export function createFigmaExtractCommand(): Command {
  const extractCommand = new Command('extract');
  extractCommand
    .description('Extract components from Figma design file')
    .argument('<figma-url>', 'Figma file URL to extract components from')
    .option('-o, --output <path>', 'Output directory for generated components', './src/components/figma')
    .option('-f, --framework <framework>', 'CSS framework to use', 'styled-components')
    .option('--storybook', 'Generate Storybook stories', false)
    .option('--tests', 'Generate test files', false)
    .option('--i18n', 'Generate i18n translation keys', false)
    .option('--languages <languages>', 'Comma-separated list of language codes', 'en')
    .option('--preview', 'Preview extraction without generating files', false)
    .action(async (figmaUrl: string, options) => {
      try {
        // Validate Figma URL
        if (!validateFigmaUrl(figmaUrl)) {
          console.error('❌ Invalid Figma URL format');
          console.error('Expected format: https://figma.com/file/KEY/...');
          process.exit(1);
        }

        console.log('🎨 Figma Component Extraction');
        console.log('═════════════════════════════════\n');
        console.log(`📁 Source: ${figmaUrl}`);
        console.log(`📂 Output: ${path.resolve(options.output)}\n`);

        // Setup user data and configuration
        const userDataManager = new UserDataManager();
        const userPath = await userDataManager.getUserDataPath();

        // Detect project settings and merge with options
        const detectedSettings = await detectProjectSettings(process.cwd());

        const config: FigmaWorkflowConfig = {
          userDataPath: userPath,
          outputPath: path.resolve(options.output),
          cssFramework: options.framework || detectedSettings.cssFramework || 'styled-components',
          generateStorybook: options.storybook || detectedSettings.generateStorybook || false,
          generateTests: options.tests || detectedSettings.generateTests || false,
          includeI18n: options.i18n || detectedSettings.includeI18n || false,
          languages: options.languages.split(',').map((lang: string) => lang.trim()),
        };

        // Display configuration
        console.log('⚙️ Configuration:');
        console.log(`   Framework: ${config.cssFramework}`);
        console.log(`   Storybook: ${config.generateStorybook ? '✅' : '❌'}`);
        console.log(`   Tests: ${config.generateTests ? '✅' : '❌'}`);
        console.log(`   i18n: ${config.includeI18n ? '✅' : '❌'}`);
        if (config.includeI18n) {
          console.log(`   Languages: ${config.languages.join(', ')}`);
        }

        // Create progress display
        const progressDisplay = new ExtractionProgressDisplay();

        // Create agent with progress callback
        const agent = createFigmaImplementorAgent(config, (progress) => {
          progressDisplay.displayProgress(progress);
        });

        if (options.preview) {
          // Preview mode - show what would be extracted
          console.log('\n🔍 Preview Mode - Analyzing Figma file...\n');

          const preview = await agent.previewExtraction(figmaUrl);

          console.log('📊 Extraction Preview:');
          console.log(`   Components found: ${preview.componentCount}`);
          console.log(`   Text elements: ${preview.textContentCount}`);
          console.log(`   Estimated files: ${preview.estimatedFiles}\n`);

          console.log('🧩 Components:');
          for (const component of preview.components.slice(0, 10)) { // Show first 10
            const childCount = component.children.length;
            const textCount = component.textContent.length;
            console.log(`   ├─ ${component.name} (${childCount} children, ${textCount} text elements)`);
          }

          if (preview.components.length > 10) {
            console.log(`   └─ ... and ${preview.components.length - 10} more components\n`);
          }

          console.log('💡 Run without --preview to generate the components');
          return;
        }

        // Execute full workflow
        const result = await agent.executeFigmaWorkflow(figmaUrl, config);

        if (result.success) {
          console.log('\n🎉 Extraction completed successfully!\n');

          // Show results summary
          console.log('📊 Generation Summary:');
          console.log(`   ✅ Components: ${result.metrics.totalComponents}`);
          console.log(`   📄 Files generated: ${result.metrics.filesGenerated}`);
          if (result.i18nResult) {
            console.log(`   🌐 Translation keys: ${result.metrics.i18nKeysExtracted}`);
          }
          console.log(`   ⏱️ Processing time: ${Math.round(result.metrics.processingTimeMs / 1000)}s\n`);

          // Show warnings if any
          if (result.warnings.length > 0) {
            console.log('⚠️ Warnings:');
            for (const warning of result.warnings) {
              console.log(`   • ${warning}`);
            }
            console.log('');
          }

          // Show next steps
          console.log('🚀 Next Steps:');
          console.log(`   1. Review generated components in: ${config.outputPath}`);
          console.log('   2. Import components in your React app:');
          console.log(`      import { ComponentName } from '${path.relative(process.cwd(), config.outputPath)}'`);

          if (config.generateStorybook) {
            console.log('   3. View Storybook stories: npm run storybook');
          }

          if (config.generateTests) {
            console.log('   4. Run component tests: npm test');
          }

        } else {
          console.log('\n❌ Extraction failed!\n');

          if (result.errors.length > 0) {
            console.log('🔍 Errors:');
            for (const error of result.errors) {
              console.log(`   • ${error}`);
            }
          }

          process.exit(1);
        }

      } catch (error) {
        console.error('\n❌ Command failed:');
        console.error(error instanceof Error ? error.message : String(error));

        if (error instanceof Error && error.message.includes('authentication')) {
          console.log('\n💡 Try: graphyn figma auth login');
        }

        process.exit(1);
      }
    });

  return extractCommand;
}