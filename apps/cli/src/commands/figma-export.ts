/**
 * Figma Component Export CLI Command
 *
 * Exports generated components to various formats and targets.
 * Supports multiple output formats, bundling, and deployment patterns
 * with integration into existing React projects.
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { UserDataManager } from '../utils/UserDataManager.js';

export interface ExportConfig {
  inputPath: string;
  outputPath: string;
  format: 'npm' | 'cdn' | 'zip' | 'storybook' | 'bundle';
  includeStories: boolean;
  includeTests: boolean;
  includeDocs: boolean;
  packageName?: string;
  version?: string;
  bundleTarget?: 'es5' | 'es2015' | 'es2020' | 'esnext';
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  files: string[];
  packageInfo?: {
    name: string;
    version: string;
    size: string;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Package.json generator for NPM exports
 */
class PackageGenerator {
  async generatePackageJson(config: ExportConfig, componentList: string[]): Promise<any> {
    const packageName = config.packageName || 'figma-components';
    const version = config.version || '1.0.0';

    return {
      name: packageName,
      version: version,
      description: 'React components generated from Figma designs',
      main: 'index.js',
      types: 'index.d.ts',
      files: [
        'components/',
        'types/',
        'stories/',
        'tests/',
        'translations/',
        'index.js',
        'index.d.ts'
      ].filter(file => {
        if (file === 'stories/' && !config.includeStories) return false;
        if (file === 'tests/' && !config.includeTests) return false;
        return true;
      }),
      scripts: {
        build: 'tsc',
        test: 'jest',
        storybook: 'start-storybook -p 6006',
        'build-storybook': 'build-storybook'
      },
      keywords: [
        'react',
        'components',
        'figma',
        'design-system',
        'typescript'
      ],
      peerDependencies: {
        react: '>=16.8.0',
        'react-dom': '>=16.8.0'
      },
      devDependencies: {
        '@types/react': '^18.0.0',
        '@types/react-dom': '^18.0.0',
        typescript: '^5.0.0',
        ...(config.includeTests && {
          '@testing-library/react': '^13.0.0',
          '@testing-library/jest-dom': '^5.0.0',
          jest: '^29.0.0'
        }),
        ...(config.includeStories && {
          '@storybook/react': '^7.0.0',
          '@storybook/addon-essentials': '^7.0.0'
        })
      },
      repository: {
        type: 'git',
        url: 'generated-from-figma'
      },
      license: 'MIT',
      author: 'Figma to React Generator',
      homepage: '#',
      bugs: {
        url: '#'
      }
    };
  }

  async generateTsConfig(config: ExportConfig): Promise<any> {
    return {
      compilerOptions: {
        target: config.bundleTarget || 'es2020',
        module: 'esnext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
        declaration: true,
        outDir: './dist',
        jsx: 'react-jsx',
        lib: ['dom', 'dom.iterable', 'es6']
      },
      include: [
        'components/**/*',
        'types/**/*',
        'index.ts'
      ],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.stories.ts',
        '**/*.stories.tsx'
      ]
    };
  }
}

/**
 * Bundle generator for CDN and standalone distributions
 */
class BundleGenerator {
  async generateCdnBundle(inputPath: string, outputPath: string): Promise<string[]> {
    const files: string[] = [];

    // Create UMD bundle structure
    const bundlePath = path.join(outputPath, 'figma-components.umd.js');
    const minBundlePath = path.join(outputPath, 'figma-components.umd.min.js');

    const bundleContent = await this.createUmdWrapper(inputPath);

    await fs.writeFile(bundlePath, bundleContent, 'utf-8');
    files.push(bundlePath);

    // Create minified version (simplified - would use actual minifier in production)
    const minifiedContent = bundleContent.replace(/\s+/g, ' ').trim();
    await fs.writeFile(minBundlePath, minifiedContent, 'utf-8');
    files.push(minBundlePath);

    // Create CSS bundle
    const cssPath = path.join(outputPath, 'figma-components.css');
    const cssContent = await this.extractAndBundleCss(inputPath);
    await fs.writeFile(cssPath, cssContent, 'utf-8');
    files.push(cssPath);

    return files;
  }

  private async createUmdWrapper(inputPath: string): Promise<string> {
    const components = await this.getComponentList(inputPath);

    return `(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FigmaComponents = {}, global.React));
}(this, (function (exports, React) { 'use strict';

  // Component implementations would be bundled here
  ${components.map(comp => `
  var ${comp} = function(props) {
    return React.createElement('div', props, props.children || '${comp}');
  };
  `).join('')}

  // Exports
  ${components.map(comp => `exports.${comp} = ${comp};`).join('\n  ')}

  Object.defineProperty(exports, '__esModule', { value: true });

})));`;
  }

  private async extractAndBundleCss(inputPath: string): Promise<string> {
    // Extract CSS from styled-components or CSS modules
    // This is a simplified version - would parse actual CSS in production
    return `/* Figma Components CSS Bundle */
.figma-component {
  box-sizing: border-box;
}

.figma-component * {
  box-sizing: inherit;
}`;
  }

  private async getComponentList(inputPath: string): Promise<string[]> {
    try {
      const indexPath = path.join(inputPath, 'components', 'index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Extract component names from export statements
      const exportMatches = indexContent.match(/export\s+\{\s*(\w+)\s*\}/g) || [];
      return exportMatches.map(match => {
        const componentMatch = match.match(/\{\s*(\w+)\s*\}/);
        return componentMatch ? componentMatch[1] : '';
      }).filter(Boolean);
    } catch (error) {
      return ['ExampleComponent'];
    }
  }
}

/**
 * Storybook export generator
 */
class StorybookExporter {
  async generateStorybookConfig(outputPath: string): Promise<string[]> {
    const files: string[] = [];

    // Create .storybook directory
    const storybookDir = path.join(outputPath, '.storybook');
    await fs.mkdir(storybookDir, { recursive: true });

    // Main Storybook config
    const mainConfigPath = path.join(storybookDir, 'main.js');
    const mainConfig = `module.exports = {
  stories: ['../components/stories/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-controls',
    '@storybook/addon-docs'
  ],
  framework: '@storybook/react',
  core: {
    builder: '@storybook/builder-webpack5'
  }
};`;

    await fs.writeFile(mainConfigPath, mainConfig, 'utf-8');
    files.push(mainConfigPath);

    // Preview config
    const previewConfigPath = path.join(storybookDir, 'preview.js');
    const previewConfig = `export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  docs: {
    inlineStories: true,
  },
};`;

    await fs.writeFile(previewConfigPath, previewConfig, 'utf-8');
    files.push(previewConfigPath);

    return files;
  }
}

/**
 * Documentation generator
 */
class DocumentationGenerator {
  async generateReadme(config: ExportConfig, componentList: string[]): Promise<string> {
    const packageName = config.packageName || 'figma-components';

    return `# ${packageName}

React components generated from Figma designs using Graphyn Figma Implementor Agent.

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Usage

\`\`\`jsx
import { ${componentList.slice(0, 3).join(', ')} } from '${packageName}';

function App() {
  return (
    <div>
      <${componentList[0]} />
      ${componentList.length > 1 ? `<${componentList[1]} />` : ''}
      ${componentList.length > 2 ? `<${componentList[2]} />` : ''}
    </div>
  );
}
\`\`\`

## Components

${componentList.map(comp => `### ${comp}

Generated from Figma design with full TypeScript support.

\`\`\`jsx
<${comp} />
\`\`\`
`).join('\n')}

## Development

${config.includeStories ? `### Storybook

\`\`\`bash
npm run storybook
\`\`\`
` : ''}

${config.includeTests ? `### Testing

\`\`\`bash
npm test
\`\`\`
` : ''}

### Building

\`\`\`bash
npm run build
\`\`\`

## Generated with Graphyn

This component library was automatically generated from Figma designs using Graphyn's AI-powered design-to-code workflow.

- **Source**: Figma Design File
- **Generated**: ${new Date().toISOString()}
- **Framework**: React + TypeScript
- **Styling**: Multiple framework support
- **i18n**: Translation-ready
`;
  }

  async generateChangelog(): Promise<string> {
    return `# Changelog

All notable changes to this component library will be documented in this file.

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial component library generated from Figma
- TypeScript definitions
- Component documentation
- Storybook stories
- Test files
- Translation support

### Generated Components
- Complete component list extracted from Figma designs
- Responsive layout support
- Design token integration
- Accessibility features
`;
  }
}

/**
 * Main export orchestrator
 */
class ComponentExporter {
  private packageGenerator = new PackageGenerator();
  private bundleGenerator = new BundleGenerator();
  private storybookExporter = new StorybookExporter();
  private docsGenerator = new DocumentationGenerator();

  async exportComponents(config: ExportConfig): Promise<ExportResult> {
    const result: ExportResult = {
      success: false,
      outputPath: config.outputPath,
      files: [],
      warnings: [],
      errors: []
    };

    try {
      // Verify input directory exists
      if (!await this.verifyInputDirectory(config.inputPath)) {
        result.errors.push(`Input directory not found: ${config.inputPath}`);
        return result;
      }

      // Create output directory
      await fs.mkdir(config.outputPath, { recursive: true });

      // Get component list for documentation
      const componentList = await this.getComponentList(config.inputPath);
      if (componentList.length === 0) {
        result.warnings.push('No components found in input directory');
      }

      // Copy base components
      const copiedFiles = await this.copyComponentFiles(config);
      result.files.push(...copiedFiles);

      // Generate based on format
      switch (config.format) {
        case 'npm':
          await this.generateNpmPackage(config, componentList, result);
          break;
        case 'cdn':
          await this.generateCdnBundle(config, result);
          break;
        case 'zip':
          await this.generateZipArchive(config, result);
          break;
        case 'storybook':
          await this.generateStorybookExport(config, result);
          break;
        case 'bundle':
          await this.generateBundle(config, result);
          break;
      }

      // Generate documentation if requested
      if (config.includeDocs) {
        await this.generateDocumentation(config, componentList, result);
      }

      result.success = true;
      console.log(`✅ Export completed: ${result.files.length} files generated`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error('❌ Export failed:', error);
    }

    return result;
  }

  private async verifyInputDirectory(inputPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(inputPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async getComponentList(inputPath: string): Promise<string[]> {
    try {
      const componentsDir = path.join(inputPath, 'components');
      const files = await fs.readdir(componentsDir);

      return files
        .filter(file => file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.'))
        .map(file => path.basename(file, '.tsx'));
    } catch {
      return [];
    }
  }

  private async copyComponentFiles(config: ExportConfig): Promise<string[]> {
    const files: string[] = [];
    const sourceDir = config.inputPath;
    const targetDir = config.outputPath;

    // Copy components directory
    await this.copyDirectory(
      path.join(sourceDir, 'components'),
      path.join(targetDir, 'components'),
      files
    );

    // Copy types directory
    if (await this.directoryExists(path.join(sourceDir, 'types'))) {
      await this.copyDirectory(
        path.join(sourceDir, 'types'),
        path.join(targetDir, 'types'),
        files
      );
    }

    // Copy translations if they exist
    if (await this.directoryExists(path.join(sourceDir, 'translations'))) {
      await this.copyDirectory(
        path.join(sourceDir, 'translations'),
        path.join(targetDir, 'translations'),
        files
      );
    }

    return files;
  }

  private async copyDirectory(source: string, target: string, fileList: string[]): Promise<void> {
    await fs.mkdir(target, { recursive: true });

    const items = await fs.readdir(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);

      const stats = await fs.stat(sourcePath);

      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath, fileList);
      } else {
        await fs.copyFile(sourcePath, targetPath);
        fileList.push(targetPath);
      }
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async generateNpmPackage(config: ExportConfig, componentList: string[], result: ExportResult): Promise<void> {
    // Generate package.json
    const packageJson = await this.packageGenerator.generatePackageJson(config, componentList);
    const packagePath = path.join(config.outputPath, 'package.json');
    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf-8');
    result.files.push(packagePath);

    // Generate tsconfig.json
    const tsConfig = await this.packageGenerator.generateTsConfig(config);
    const tsConfigPath = path.join(config.outputPath, 'tsconfig.json');
    await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf-8');
    result.files.push(tsConfigPath);

    // Store package info
    result.packageInfo = {
      name: packageJson.name,
      version: packageJson.version,
      size: 'TBD' // Would calculate actual size
    };
  }

  private async generateCdnBundle(config: ExportConfig, result: ExportResult): Promise<void> {
    const bundleFiles = await this.bundleGenerator.generateCdnBundle(config.inputPath, config.outputPath);
    result.files.push(...bundleFiles);
  }

  private async generateZipArchive(config: ExportConfig, result: ExportResult): Promise<void> {
    // Would use archiving library in production
    result.warnings.push('ZIP generation requires additional dependencies');
  }

  private async generateStorybookExport(config: ExportConfig, result: ExportResult): Promise<void> {
    const storybookFiles = await this.storybookExporter.generateStorybookConfig(config.outputPath);
    result.files.push(...storybookFiles);
  }

  private async generateBundle(config: ExportConfig, result: ExportResult): Promise<void> {
    // Generate both NPM and CDN formats
    await this.generateNpmPackage(config, await this.getComponentList(config.inputPath), result);
    await this.generateCdnBundle(config, result);
  }

  private async generateDocumentation(config: ExportConfig, componentList: string[], result: ExportResult): Promise<void> {
    // Generate README
    const readme = await this.docsGenerator.generateReadme(config, componentList);
    const readmePath = path.join(config.outputPath, 'README.md');
    await fs.writeFile(readmePath, readme, 'utf-8');
    result.files.push(readmePath);

    // Generate CHANGELOG
    const changelog = await this.docsGenerator.generateChangelog();
    const changelogPath = path.join(config.outputPath, 'CHANGELOG.md');
    await fs.writeFile(changelogPath, changelog, 'utf-8');
    result.files.push(changelogPath);
  }
}

/**
 * Create Figma export command
 */
export function createFigmaExportCommand(): Command {
  const exportCommand = new Command('export');
  exportCommand
    .description('Export generated Figma components to various formats')
    .argument('<input-path>', 'Input directory containing generated components')
    .option('-o, --output <path>', 'Output directory for exported package', './dist')
    .option('-f, --format <format>', 'Export format: npm, cdn, zip, storybook, bundle', 'npm')
    .option('-n, --name <name>', 'Package name for NPM export')
    .option('-v, --version <version>', 'Package version', '1.0.0')
    .option('--target <target>', 'Bundle target: es5, es2015, es2020, esnext', 'es2020')
    .option('--no-stories', 'Exclude Storybook stories')
    .option('--no-tests', 'Exclude test files')
    .option('--no-docs', 'Skip documentation generation')
    .action(async (inputPath: string, options) => {
      try {
        console.log('📦 Figma Component Export');
        console.log('════════════════════════════\n');
        console.log(`📁 Input: ${path.resolve(inputPath)}`);
        console.log(`📂 Output: ${path.resolve(options.output)}`);
        console.log(`📋 Format: ${options.format}\n`);

        // Validate input path
        if (!await fs.stat(inputPath).catch(() => false)) {
          console.error('❌ Input directory not found:', inputPath);
          process.exit(1);
        }

        const config: ExportConfig = {
          inputPath: path.resolve(inputPath),
          outputPath: path.resolve(options.output),
          format: options.format as ExportConfig['format'],
          includeStories: options.stories !== false,
          includeTests: options.tests !== false,
          includeDocs: options.docs !== false,
          packageName: options.name,
          version: options.version,
          bundleTarget: options.target as ExportConfig['bundleTarget'],
        };

        // Display configuration
        console.log('⚙️ Export Configuration:');
        console.log(`   Format: ${config.format}`);
        console.log(`   Stories: ${config.includeStories ? '✅' : '❌'}`);
        console.log(`   Tests: ${config.includeTests ? '✅' : '❌'}`);
        console.log(`   Documentation: ${config.includeDocs ? '✅' : '❌'}`);
        if (config.packageName) {
          console.log(`   Package: ${config.packageName}@${config.version}`);
        }
        console.log(`   Target: ${config.bundleTarget}\n`);

        const exporter = new ComponentExporter();
        const result = await exporter.exportComponents(config);

        if (result.success) {
          console.log('🎉 Export completed successfully!\n');

          console.log('📊 Export Summary:');
          console.log(`   ✅ Files generated: ${result.files.length}`);
          console.log(`   📍 Output location: ${result.outputPath}`);

          if (result.packageInfo) {
            console.log(`   📦 Package: ${result.packageInfo.name}@${result.packageInfo.version}`);
          }

          if (result.warnings.length > 0) {
            console.log('\n⚠️ Warnings:');
            for (const warning of result.warnings) {
              console.log(`   • ${warning}`);
            }
          }

          console.log('\n🚀 Next Steps:');
          switch (config.format) {
            case 'npm':
              console.log('   1. Review generated package.json');
              console.log('   2. Run: npm install (in output directory)');
              console.log('   3. Build: npm run build');
              console.log('   4. Publish: npm publish');
              break;
            case 'cdn':
              console.log('   1. Upload bundle files to CDN');
              console.log('   2. Include script tag in HTML');
              console.log('   3. Use: window.FigmaComponents.ComponentName');
              break;
            case 'storybook':
              console.log('   1. Run: npm install (in output directory)');
              console.log('   2. Start: npm run storybook');
              console.log('   3. View stories at http://localhost:6006');
              break;
            default:
              console.log(`   1. Review generated files in: ${result.outputPath}`);
              console.log('   2. Integrate into your project as needed');
          }

        } else {
          console.log('❌ Export failed!\n');

          if (result.errors.length > 0) {
            console.log('🔍 Errors:');
            for (const error of result.errors) {
              console.log(`   • ${error}`);
            }
          }

          process.exit(1);
        }

      } catch (error) {
        console.error('\n❌ Export command failed:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return exportCommand;
}