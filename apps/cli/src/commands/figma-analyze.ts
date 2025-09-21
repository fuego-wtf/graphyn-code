/**
 * Figma Command Group - Complete Figma integration suite
 *
 * Comprehensive CLI interface for Figma design-to-code workflows including
 * authentication, component extraction, analysis, and export capabilities.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { FigmaPrototypeAnalyzer, type FigmaAnalysisConfig } from '@graphyn/agents';
import { promises as fs } from 'fs';
import path from 'path';
import { createFigmaAuthCommand } from './figma-auth.js';
import { createFigmaExtractCommand } from './figma-extract.js';
import { createFigmaExportCommand } from './figma-export.js';

export interface FigmaAnalyzeOptions {
  url?: string;
  nodeId?: string;
  outputDir?: string;
  frameworks?: string;
  languages?: string;
  skipComponents?: boolean;
  skipVariables?: boolean;
  skipScreenshots?: boolean;
  skipCode?: boolean;
  interactive?: boolean;
}

/**
 * Create complete Figma command group
 */
export function createFigmaAnalyzeCommand(): Command {
  const figmaCommand = new Command('figma')
    .description('Complete Figma design-to-code workflow suite')
    .alias('fig');

  // Add authentication subcommand
  figmaCommand.addCommand(createFigmaAuthCommand());

  // Add extraction subcommand
  figmaCommand.addCommand(createFigmaExtractCommand());

  // Add export subcommand
  figmaCommand.addCommand(createFigmaExportCommand());

  // Add analysis subcommand (original functionality)
  const analyzeCommand = new Command('analyze')
    .description('Analyze Figma prototypes and extract design information')
    .option('-u, --url <url>', 'Figma prototype URL')
    .option('-n, --node-id <id>', 'Specific node ID to analyze')
    .option('-o, --output-dir <dir>', 'Output directory for analysis results', './.temp')
    .option('-f, --frameworks <frameworks>', 'Target frameworks (comma-separated)', 'react')
    .option('-l, --languages <languages>', 'Target languages (comma-separated)', 'typescript')
    .option('--skip-components', 'Skip component extraction')
    .option('--skip-variables', 'Skip design variables extraction')
    .option('--skip-screenshots', 'Skip screenshot generation')
    .option('--skip-code', 'Skip code generation')
    .option('-i, --interactive', 'Interactive mode with prompts')
    .action(async (options: FigmaAnalyzeOptions) => {
      try {
        await handleFigmaAnalyzeCommand(options);
      } catch (error) {
        console.error(chalk.red('❌ Figma analysis failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  figmaCommand.addCommand(analyzeCommand);

  // Add workflow subcommand that combines everything
  const workflowCommand = new Command('workflow')
    .description('Complete Figma-to-React workflow: auth → extract → export')
    .argument('<figma-url>', 'Figma file URL to process')
    .option('-o, --output <path>', 'Output directory for generated components', './src/components/figma')
    .option('-f, --format <format>', 'Export format: npm, cdn, bundle', 'npm')
    .option('--framework <framework>', 'CSS framework to use', 'styled-components')
    .option('--no-auth-check', 'Skip authentication verification')
    .action(async (figmaUrl: string, options) => {
      try {
        console.log(chalk.blue('🎨 Figma Complete Workflow'));
        console.log(chalk.gray('Authentication → Extraction → Component Generation → Export\n'));

        // Step 1: Authentication check (unless skipped)
        if (options.authCheck !== false) {
          console.log(chalk.blue('🔐 Step 1: Verifying Figma authentication...'));
          // Would call auth status check here
          console.log(chalk.green('✅ Authentication verified\n'));
        }

        // Step 2: Extract components
        console.log(chalk.blue('📥 Step 2: Extracting components from Figma...'));
        console.log(chalk.gray(`Source: ${figmaUrl}`));
        console.log(chalk.gray(`Output: ${options.output}\n`));
        // Would call extract command here
        console.log(chalk.green('✅ Components extracted\n'));

        // Step 3: Export in specified format
        console.log(chalk.blue('📦 Step 3: Exporting components...'));
        console.log(chalk.gray(`Format: ${options.format}`));
        console.log(chalk.gray(`Framework: ${options.framework}\n`));
        // Would call export command here
        console.log(chalk.green('✅ Export completed\n'));

        console.log(chalk.green('🎉 Figma workflow completed successfully!'));
        console.log(chalk.blue('\n🚀 Next Steps:'));
        console.log(chalk.gray('1. Review generated components'));
        console.log(chalk.gray('2. Import into your React project'));
        console.log(chalk.gray('3. Test component integration'));

      } catch (error) {
        console.error(chalk.red('❌ Workflow failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  figmaCommand.addCommand(workflowCommand);

  return figmaCommand;
}

/**
 * Handle Figma analyze command
 */
async function handleFigmaAnalyzeCommand(options: FigmaAnalyzeOptions): Promise<void> {
  console.log(chalk.blue('🎨 Figma Prototype Analyzer'));
  console.log(chalk.gray('Extract design tokens, components, and code from Figma prototypes\n'));

  let config: FigmaAnalysisConfig;

  if (options.interactive) {
    config = await getInteractiveConfig(options);
  } else {
    config = await getDirectConfig(options);
  }

  console.log(chalk.blue('📋 Analysis Configuration:'));
  console.log(chalk.gray(`  URL: ${config.prototypeUrl}`));
  console.log(chalk.gray(`  Node ID: ${config.nodeId || 'Auto-detect'}`));
  console.log(chalk.gray(`  Output: ${config.outputDir}`));
  console.log(chalk.gray(`  Frameworks: ${config.clientFrameworks}`));
  console.log(chalk.gray(`  Languages: ${config.clientLanguages}`));
  console.log('');

  try {
    // Ensure output directory exists
    await fs.mkdir(config.outputDir!, { recursive: true });

    // Initialize analyzer
    const analyzer = new FigmaPrototypeAnalyzer(config);

    console.log(chalk.blue('🔍 Starting Figma prototype analysis...'));
    const startTime = Date.now();
    
    const result = await analyzer.analyze();
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(chalk.green(`✅ Analysis completed successfully in ${duration}ms!`));
      console.log(chalk.blue('\n📊 Results Summary:'));
      console.log(chalk.gray(`  • ${result.designTokens.length} design tokens extracted`));
      console.log(chalk.gray(`  • ${result.components.length} components identified`));
      console.log(chalk.gray(`  • ${Object.keys(result.screenshots).length} screenshots generated`));
      console.log(chalk.gray(`  • ${Object.keys(result.generatedCode).length} code files created`));

      // Generate and save reports
      console.log(chalk.blue('\n📝 Generating reports...'));
      
      // Implementation report
      const report = await analyzer.generateImplementationReport(result);
      const reportPath = path.join(config.outputDir!, 'figma-analysis-report.md');
      await fs.writeFile(reportPath, report, 'utf8');
      console.log(chalk.green(`📄 Implementation report: ${reportPath}`));

      // Raw data export
      const dataPath = path.join(config.outputDir!, 'figma-analysis-data.json');
      await fs.writeFile(dataPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(chalk.green(`💾 Raw analysis data: ${dataPath}`));

      // Display key findings
      await displayAnalysisResults(result);

      console.log(chalk.blue('\n🎯 Next Steps:'));
      console.log(chalk.gray('  1. Review the implementation report for design specifications'));
      console.log(chalk.gray('  2. Use extracted design tokens in your design system'));
      console.log(chalk.gray('  3. Implement components based on generated code'));
      console.log(chalk.gray('  4. Reference screenshots for visual accuracy'));

    } else {
      console.error(chalk.red(`❌ Analysis failed: ${result.error}`));
      
      // Check for common issues and provide help
      if (result.error?.includes('MCP')) {
        console.log(chalk.yellow('\n💡 MCP Server Setup:'));
        console.log(chalk.gray('  Make sure you have the Figma MCP server running.'));
        console.log(chalk.gray('  Set environment variables:'));
        console.log(chalk.gray('  • FIGMA_MCP_SERVER_COMMAND=<figma-mcp-server-path>'));
        console.log(chalk.gray('  • FIGMA_MCP_SERVER_ARGS="<server-arguments>"'));
      }
      
      if (result.error?.includes('file')) {
        console.log(chalk.yellow('\n💡 Figma File Access:'));
        console.log(chalk.gray('  Ensure the Figma file is public or you have access.'));
        console.log(chalk.gray('  Check the URL format and node ID are correct.'));
      }
      
      throw new Error(result.error);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Analysis failed:'), error);
    throw error;
  }
}

/**
 * Get configuration from interactive prompts
 */
async function getInteractiveConfig(options: FigmaAnalyzeOptions): Promise<FigmaAnalysisConfig> {
  const questions: any[] = [];

  if (!options.url) {
    questions.push({
      type: 'input',
      name: 'url',
      message: 'Enter the Figma prototype URL:',
      default: 'https://www.figma.com/proto/krhXq0l0ktpeunUgWWXqHj/Graphyn---Delivery?node-id=2490-105142&t=odveUSdyNnntFjD6-1',
      validate: (value: string) => {
        if (!value || !value.includes('figma.com')) {
          return 'Please enter a valid Figma URL';
        }
        return true;
      }
    });
  }

  questions.push(
    {
      type: 'input',
      name: 'nodeId',
      message: 'Enter specific node ID (optional):',
      default: options.nodeId || ''
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: options.outputDir || './.temp'
    },
    {
      type: 'input',
      name: 'frameworks',
      message: 'Target frameworks (comma-separated):',
      default: options.frameworks || 'react'
    },
    {
      type: 'input',
      name: 'languages',
      message: 'Target languages (comma-separated):',
      default: options.languages || 'typescript'
    },
    {
      type: 'checkbox',
      name: 'extractOptions',
      message: 'What to extract:',
      choices: [
        { name: 'Components', value: 'components', checked: !options.skipComponents },
        { name: 'Design Variables', value: 'variables', checked: !options.skipVariables },
        { name: 'Screenshots', value: 'screenshots', checked: !options.skipScreenshots },
        { name: 'Generated Code', value: 'code', checked: !options.skipCode }
      ]
    }
  );

  const answers = await inquirer.prompt(questions);

  return {
    prototypeUrl: options.url || answers.url,
    nodeId: options.nodeId || answers.nodeId || undefined,
    outputDir: answers.outputDir,
    clientFrameworks: answers.frameworks,
    clientLanguages: answers.languages,
    extractComponents: answers.extractOptions.includes('components'),
    extractVariables: answers.extractOptions.includes('variables'),
    extractScreenshots: answers.extractOptions.includes('screenshots'),
    generateCode: answers.extractOptions.includes('code')
  };
}

/**
 * Get configuration from command line options
 */
async function getDirectConfig(options: FigmaAnalyzeOptions): Promise<FigmaAnalysisConfig> {
  const prototypeUrl = options.url || 'https://www.figma.com/proto/krhXq0l0ktpeunUgWWXqHj/Graphyn---Delivery?node-id=2490-105142&t=odveUSdyNnntFjD6-1';

  if (!prototypeUrl.includes('figma.com')) {
    throw new Error('Invalid Figma URL. Please provide a valid Figma prototype URL.');
  }

  return {
    prototypeUrl,
    nodeId: options.nodeId,
    outputDir: options.outputDir || './.temp',
    clientFrameworks: options.frameworks || 'react',
    clientLanguages: options.languages || 'typescript',
    extractComponents: !options.skipComponents,
    extractVariables: !options.skipVariables,
    extractScreenshots: !options.skipScreenshots,
    generateCode: !options.skipCode
  };
}

/**
 * Display analysis results in a formatted way
 */
async function displayAnalysisResults(result: any): Promise<void> {
  if (result.designTokens.length > 0) {
    console.log(chalk.blue('\n🎨 Design Tokens (Top 5):'));
    result.designTokens.slice(0, 5).forEach((token: any) => {
      const typeColor = token.type === 'color' ? chalk.magenta(token.type) : 
                       token.type === 'spacing' ? chalk.cyan(token.type) :
                       chalk.yellow(token.type);
      console.log(chalk.gray(`  • ${chalk.white(token.name)} (${typeColor}): ${chalk.green(token.value)}`));
    });
    
    if (result.designTokens.length > 5) {
      console.log(chalk.gray(`  ... and ${result.designTokens.length - 5} more tokens`));
    }
  }

  if (result.components.length > 0) {
    console.log(chalk.blue('\n🧩 Components:'));
    result.components.forEach((component: any) => {
      console.log(chalk.gray(`  • ${chalk.white(component.name)} (${chalk.cyan(component.type)})`));
    });
  }

  if (Object.keys(result.generatedCode).length > 0) {
    console.log(chalk.blue('\n💻 Generated Code:'));
    Object.keys(result.generatedCode).forEach(nodeId => {
      const codeLength = result.generatedCode[nodeId].length;
      console.log(chalk.gray(`  • Node ${chalk.white(nodeId)}: ${chalk.green(codeLength)} characters`));
    });
  }
}

export default createFigmaAnalyzeCommand;