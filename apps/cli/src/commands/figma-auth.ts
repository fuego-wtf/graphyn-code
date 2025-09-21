/**
 * Figma Authentication CLI Command
 *
 * Handles Figma OAuth authentication workflow through the CLI.
 * Provides login, logout, and status check functionality with
 * user-friendly output and error handling.
 */

import { Command } from 'commander';
import { createFigmaImplementorAgent, FigmaWorkflowConfig } from '../../../../packages/agents/src/specialized/figma-implementor-agent.js';
import { UserDataManager } from '../utils/UserDataManager.js';

/**
 * Create Figma auth command with subcommands
 */
export function createFigmaAuthCommand(): Command {
  const figmaCommand = new Command('figma');
  figmaCommand.description('Figma integration commands');

  // Auth subcommand
  const authCommand = new Command('auth');
  authCommand.description('Manage Figma authentication');

  // Login command
  authCommand
    .command('login')
    .description('Authenticate with Figma using OAuth')
    .action(async () => {
      try {
        console.log('🎨 Figma Authentication Setup');
        console.log('═══════════════════════════════\n');

        const userDataManager = new UserDataManager();
        const userPath = await userDataManager.getUserDataPath();

        const config: FigmaWorkflowConfig = {
          userDataPath: userPath,
          outputPath: process.cwd(),
          cssFramework: 'styled-components',
          generateStorybook: false,
          generateTests: false,
          languages: ['en'],
          includeI18n: false,
        };

        const agent = createFigmaImplementorAgent(config);

        await agent.startAuthentication();

        console.log('\n🎉 Success! Figma authentication is now configured.');
        console.log('💡 You can now use: graphyn figma extract <figma-url>');

      } catch (error) {
        console.error('\n❌ Authentication failed:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Status command
  authCommand
    .command('status')
    .description('Check Figma authentication status')
    .action(async () => {
      try {
        console.log('🔍 Checking Figma authentication status...\n');

        const userDataManager = new UserDataManager();
        const userPath = await userDataManager.getUserDataPath();

        const config: FigmaWorkflowConfig = {
          userDataPath: userPath,
          outputPath: process.cwd(),
          cssFramework: 'styled-components',
          generateStorybook: false,
          generateTests: false,
          languages: ['en'],
          includeI18n: false,
        };

        const agent = createFigmaImplementorAgent(config);
        const status = await agent.checkAuthenticationStatus();

        if (status.authenticated && status.userInfo) {
          console.log('✅ Figma Authentication Status: AUTHENTICATED');
          console.log(`👤 User: ${status.userInfo.handle}`);
          console.log(`📧 Email: ${status.userInfo.email}\n`);
          console.log('💡 Ready to extract Figma components!');
        } else {
          console.log('❌ Figma Authentication Status: NOT AUTHENTICATED');
          if (status.error) {
            console.log(`🔍 Error: ${status.error}`);
          }
          console.log('\n💡 Run: graphyn figma auth login');
        }

      } catch (error) {
        console.error('❌ Failed to check authentication status:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Logout command
  authCommand
    .command('logout')
    .description('Logout from Figma and clear stored credentials')
    .action(async () => {
      try {
        console.log('🔒 Logging out from Figma...\n');

        const userDataManager = new UserDataManager();
        const userPath = await userDataManager.getUserDataPath();

        const config: FigmaWorkflowConfig = {
          userDataPath: userPath,
          outputPath: process.cwd(),
          cssFramework: 'styled-components',
          generateStorybook: false,
          generateTests: false,
          languages: ['en'],
          includeI18n: false,
        };

        const agent = createFigmaImplementorAgent(config);
        await agent.logout();

        console.log('✅ Successfully logged out from Figma');
        console.log('🔐 All stored credentials have been cleared');

      } catch (error) {
        console.error('❌ Logout failed:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  figmaCommand.addCommand(authCommand);
  return figmaCommand;
}