#!/usr/bin/env node
import { createSquad } from './commands/squad.js';
import { OAuthManager } from './auth/oauth.js';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
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
  graphyn --version              Show version
  graphyn --help                 Show help

Examples:
  graphyn "I need to add user authentication to my Next.js app"
  graphyn "Create a REST API with Express and PostgreSQL"
  graphyn "Help me refactor this React component to use hooks"
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
  
  // Create squad for the user's request
  await createSquad(userMessage);
}

main().catch(error => {
  console.error(colors.error('Error:'), error.message);
  process.exit(1);
});