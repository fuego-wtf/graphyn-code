#!/usr/bin/env node
import { OAuthManager } from './auth/oauth.js';
import { switchSquad, showCurrentSquad, clearSquadSelection } from './commands/squad-manage.js';
import { analyzeRepository } from './commands/analyze.js';
import { createSquad } from './commands/squad.js';
import { ensureOrganizationSelected } from './utils/squad-selection.js';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

async function main() {
  const [,, ...args] = process.argv;
  
  // Join all arguments as the user message
  const userMessage = args.join(' ').trim();
  
  // Handle special commands
  if (userMessage === '--version' || userMessage === '-v') {
    console.log('0.1.60');
    process.exit(0);
  }
  
  if (userMessage === '--help' || userMessage === '-h' || userMessage === 'help' || !userMessage) {
    console.log(`
Graphyn Code - AI Development Tool

Usage:
  graphyn <request>              Create an AI development squad
  graphyn auth                   Authenticate with Graphyn
  graphyn logout                 Log out from Graphyn
  graphyn analyze [--mode mode]  Analyze repository for tech stack
  graphyn squad                  Show current squad
  graphyn squad switch           Switch to a different squad
  graphyn squad clear            Clear squad selection
  graphyn --version              Show version
  graphyn --help                 Show help

Examples:
  graphyn "I need to add user authentication to my Next.js app"
  graphyn "Create a REST API with Express and PostgreSQL"
  graphyn "Help me refactor this React component to use hooks"
  graphyn analyze                Analyze your repository
  graphyn analyze --mode summary Get a summary analysis
  graphyn squad switch           Switch between your squads
`);
    process.exit(0);
  }
  
  // Handle auth command
  if (userMessage === 'auth') {
    const oauthManager = new OAuthManager();
    await oauthManager.authenticate();
    process.exit(0);
  }
  
  // Handle logout command
  if (userMessage === 'logout') {
    const oauthManager = new OAuthManager();
    await oauthManager.logout();
    process.exit(0);
  }
  
  
  // Handle squad commands
  if (userMessage === 'squad') {
    await showCurrentSquad();
    process.exit(0);
  }
  
  if (userMessage === 'squad switch') {
    await switchSquad();
    process.exit(0);
  }
  
  if (userMessage === 'squad clear') {
    await clearSquadSelection();
    process.exit(0);
  }
  
  // Handle analyze command
  if (userMessage.startsWith('analyze')) {
    const options: any = {};
    const parts = userMessage.split(' ');
    
    // Parse options
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] === '--mode' && parts[i + 1]) {
        options.mode = parts[i + 1];
        i++;
      } else if (parts[i] === '--save') {
        options.save = true;
      } else if (parts[i] === '--output' && parts[i + 1]) {
        options.output = parts[i + 1];
        i++;
      }
    }
    
    await analyzeRepository(options);
    process.exit(0);
  }
  
  // Main flow: authenticate, select squad, then create request
  try {
    // Step 1: Check authentication
    const oauthManager = new OAuthManager();
    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.info('\n🔗 Connecting to Graphyn platform...'));
      console.log(colors.info('🌐 Opening browser for authentication...\n'));
      
      // Authenticate user
      await oauthManager.authenticate();
      console.log(colors.success('\n✓ Authentication successful!\n'));
    }
    
    // Step 2: Get valid token
    let token = await oauthManager.getValidToken();
    if (!token) {
      // Token might be expired, try to re-authenticate
      console.log(colors.warning('⚠️  Session expired. Re-authenticating...'));
      console.log(colors.info('🌐 Opening browser for authentication...\n'));
      
      await oauthManager.authenticate();
      
      // Try to get token again
      token = await oauthManager.getValidToken();
      if (!token) {
        console.log(colors.error('❌ Authentication failed. Please try "graphyn auth" manually.'));
        process.exit(1);
      }
      
      console.log(colors.success('\n✓ Re-authentication successful!\n'));
    }
    
    // Step 3: Ensure organization is selected
    const organization = await ensureOrganizationSelected(token);
    
    // Step 4: Create a new squad for this request
    console.log(colors.info(`\n🎆 Creating a new AI squad for: ${colors.highlight(organization.name)}\n`));
    await createSquad(userMessage, { organizationId: organization.id });
  } catch (error) {
    console.error(colors.error('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(colors.error('Error:'), error.message);
  process.exit(1);
});