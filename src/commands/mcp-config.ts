/**
 * MCP Config Command
 * Generate and manage MCP configuration for Claude Desktop
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { MCPConfigGenerator } from '../services/mcp-config-generator.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface MCPConfigOptions {
  update?: boolean;
  validate?: boolean;
  force?: boolean;
}

/**
 * Run MCP configuration command
 */
export async function mcpConfig(options: MCPConfigOptions = {}): Promise<void> {
  const generator = new MCPConfigGenerator();
  
  try {
    console.log(colors.bold('\n🤖 MCP Configuration Generator\n'));
    console.log(colors.info('This will create .claude/settings.json for Claude Desktop integration.\n'));
    
    // Check for existing configuration
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const settingsPath = join(process.cwd(), '.claude', 'settings.json');
    
    if (existsSync(settingsPath) && !options.force) {
      if (!options.update) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'MCP settings already exist. What would you like to do?',
            choices: [
              { name: 'Update existing configuration', value: 'update' },
              { name: 'Overwrite with new configuration', value: 'overwrite' },
              { name: 'Cancel', value: 'cancel' }
            ]
          }
        ]);
        
        if (action === 'cancel') {
          console.log(colors.info('Configuration cancelled.'));
          return;
        }
        
        options.update = action === 'update';
        options.force = action === 'overwrite';
      }
    }
    
    let settings;
    
    if (options.update) {
      console.log(colors.highlight('\nUpdating MCP configuration...\n'));
      settings = await generator.update();
    } else {
      console.log(colors.highlight('\nGenerating MCP configuration...\n'));
      settings = await generator.generate();
      await generator.save(settings);
    }
    
    // Validate servers if requested
    if (options.validate) {
      console.log(colors.highlight('\nValidating MCP servers...\n'));
      await generator.validateServers(settings);
    } else {
      const { validate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'validate',
          message: 'Would you like to validate MCP server availability?',
          default: false
        }
      ]);
      
      if (validate) {
        await generator.validateServers(settings);
      }
    }
    
    // Show final instructions
    console.log(colors.bold('\n✅ MCP Configuration Complete!\n'));
    console.log(colors.highlight('To use with Claude Desktop:'));
    console.log(colors.info('1. Make sure Claude Desktop is installed'));
    console.log(colors.info('2. Open this project in Claude Desktop'));
    console.log(colors.info('3. Claude will automatically load .claude/settings.json'));
    console.log(colors.info('4. Restart Claude Desktop if it was already running\n'));
    
    // Check for environment variables
    const envVars = new Set<string>();
    for (const server of Object.values(settings.mcpServers)) {
      if (server && typeof server === 'object' && 'env' in server && server.env) {
        Object.keys(server.env).forEach(key => envVars.add(key));
      }
    }
    
    if (envVars.size > 0) {
      console.log(colors.warning('⚠️  Don\'t forget to set required environment variables:'));
      for (const envVar of envVars) {
        console.log(colors.info(`   export ${envVar}="your-value-here"`));
      }
      console.log();
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(colors.error(`\n❌ MCP configuration failed: ${errorMessage}`));
    process.exit(1);
  }
}

