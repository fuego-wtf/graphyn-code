#!/usr/bin/env node
// Fallback CLI for non-TTY environments (pipes, CI, etc.)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { AGENT_TYPES, isAgentType } from '../constants/agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let [, , rawCommand, ...args] = process.argv;

// Parse flags from rawCommand and args (same logic as main CLI)
let isDev = false;
let isDebug = false;

// Check if rawCommand is a flag
if (rawCommand === '--dev') {
  isDev = true;
  rawCommand = args.shift() || '';
}

// After processing --dev, check if the new rawCommand is --debug
if (rawCommand === '--debug') {
  isDebug = true;
  rawCommand = args.shift() || '';
}

// Also check for flags in args array
const devFlagIndex = args.indexOf('--dev');
if (devFlagIndex !== -1) {
  isDev = true;
  args.splice(devFlagIndex, 1);
}

const debugFlagIndex = args.indexOf('--debug');
if (debugFlagIndex !== -1) {
  isDebug = true;
  args.splice(debugFlagIndex, 1);
}

// Set debug mode globally
if (isDebug) {
  process.env.DEBUG_GRAPHYN = 'true';
}

// Set development environment variables
if (isDev) {
  process.env.NODE_ENV = 'development';
  process.env.GRAPHYN_DEV_MODE = 'true';
  process.env.GRAPHYN_API_URL = 'http://localhost:4000';
  process.env.GRAPHYN_APP_URL = 'http://localhost:3000';
  
  // Debug output to confirm variables are set
  if (process.env.DEBUG_GRAPHYN) {
    console.log('[Fallback CLI Debug] Dev mode environment variables set:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- GRAPHYN_DEV_MODE:', process.env.GRAPHYN_DEV_MODE);
    console.log('- GRAPHYN_API_URL:', process.env.GRAPHYN_API_URL);
    console.log('- GRAPHYN_APP_URL:', process.env.GRAPHYN_APP_URL);
  }
}

// Check if this is a natural language query (wrapped in quotes or starting with "I")
const isNaturalLanguage = rawCommand && (
  (rawCommand.startsWith('"') && args[args.length - 1]?.endsWith('"')) ||
  rawCommand.toLowerCase().startsWith('i ') ||
  (rawCommand === 'I' && args.length > 0)
);

let command: string | undefined;
let query: string;

if (isNaturalLanguage) {
  // Treat entire input as a natural language query
  command = 'squad';
  query = [rawCommand, ...args].join(' ').replace(/^"|"$/g, '');
} else {
  command = rawCommand?.toLowerCase(); // Make command case-insensitive
  query = args.join(' ');
}

// Define agent aliases
const agentAliases: Record<string, string> = {
  'a': 'architect',
  'b': 'backend',
  'f': 'frontend',
  'd': 'design',
  'c': 'cli'
};

// Normalize command if it's an alias
const normalizedCommand = agentAliases[command] || command;

// Show version
if (normalizedCommand === '--version' || normalizedCommand === '-v') {
  console.log('0.1.60');
  process.exit(0);
}

// Show help
if (normalizedCommand === '--help' || normalizedCommand === '-h') {
  console.log(`
Graphyn Code - AI Development Tool for Claude Code

Usage:
  graphyn <agent> <query>    Query an AI agent
  graphyn --version          Show version
  graphyn --help            Show this help

Agents:
  backend (b)    Backend development agent
  frontend (f)   Frontend development agent
  architect (a)  System architecture agent
  design (d)     Design system agent
  cli (c)        CLI development agent

Example:
  graphyn backend "add user authentication"
`);
  process.exit(0);
}

// If no command, show builder mode message
if (!normalizedCommand) {
  console.error('Graphyn Builder mode requires an interactive terminal.');
  console.error('');
  console.error('To use Builder mode, run "graphyn" in a proper terminal.');
  console.error('For direct agent queries: graphyn <agent> <query>');
  console.error('');
  console.error('Example: graphyn backend "add authentication"');
  process.exit(1);
}

// Handle orchestrate command 
if (normalizedCommand === 'orchestrate') {
  if (!query) {
    console.error('Orchestrate command requires a query.');
    console.error('Usage: graphyn orchestrate [--dev] "your task description"');
    process.exit(1);
  }
  
  // Check for --dev flag
  const isDev = args.includes('--dev');
  
  // Import and run orchestrate command
  import('../commands/orchestrate.js').then(({ orchestrateCommand }) => {
    return orchestrateCommand({
      query,
      repository: process.cwd(),
      dev: isDev,
      interactive: false // Non-interactive mode for fallback
    });
  }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Orchestration failed:', error.message);
    process.exit(1);
  });
  
  // Wait indefinitely for the async operation to complete
  setInterval(() => {
    // Keep the process alive until the orchestrate command completes
  }, 1000);
}

// Handle auth command in fallback mode
if (normalizedCommand === 'auth') {
  console.log('🔐 Initiating authentication...');
  
  // Import OAuth manager and start authentication
  import('../auth/oauth.js').then(({ OAuthManager }) => {
    const oauth = new OAuthManager();
    
    return oauth.authenticate();
  }).then(() => {
    console.log('✅ Authentication completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  });
  
  // Keep the process alive for authentication
  setInterval(() => {}, 1000);
}

// Handle commands that require interactive mode
if (['init', 'init-graphyn', 'thread', 'agent'].includes(normalizedCommand)) {
  console.error(`The "graphyn ${normalizedCommand}" command requires an interactive terminal.`);
  console.error('Please run this command in a proper terminal (not piped or in CI).');
  process.exit(1);
}


// Handle natural language (legacy squad label)
if (normalizedCommand === 'squad' && query) {
  // Process squad command (natural language)
  console.log('Creating squad with natural language query...');
  
  // For squad mode in non-TTY, we need to show a helpful message
  console.error('Squad creation requires an interactive terminal for authentication and team selection.');
  console.error('');
  console.error('Please run this command in a proper terminal:');
  console.error(`  graphyn "${query}"`);
  console.error('');
  console.error('Or use a specific agent directly:');
  console.error('  graphyn backend "add authentication"');
  process.exit(1);
}

// Process agent commands
if (isAgentType(normalizedCommand) && query) {
  console.log(`Preparing ${normalizedCommand} agent context...`);
  
  // Read agent prompt
  const promptPath = path.join(__dirname, '..', 'prompts', `${normalizedCommand}.md`);
  let agentPrompt = '';
  
  if (fs.existsSync(promptPath)) {
    agentPrompt = fs.readFileSync(promptPath, 'utf-8');
  } else {
    agentPrompt = `# ${normalizedCommand.charAt(0).toUpperCase() + normalizedCommand.slice(1)} Agent\n\nYou are a helpful ${normalizedCommand} development assistant.`;
  }

  // Read project context
  let projectContext = '';
  const focusPath = path.join(process.cwd(), '.graphyn', 'focus.md');
  const mapPath = path.join(process.cwd(), '.graphyn', 'map.md');
  
  if (fs.existsSync(focusPath)) {
    projectContext = fs.readFileSync(focusPath, 'utf-8');
  }
  
  if (fs.existsSync(mapPath)) {
    projectContext += (projectContext ? '\n\n' : '') + fs.readFileSync(mapPath, 'utf-8');
  }

  // Combine context
  const fullContext = `# ${normalizedCommand.charAt(0).toUpperCase() + normalizedCommand.slice(1)} Agent Context

${agentPrompt}

${projectContext ? `# Project Context\n${projectContext}\n\n` : ''}

# User Query
${query}

# Instructions
Please analyze the above query in the context of the ${normalizedCommand} agent role and provide a comprehensive response.`;

  // Save to temp file
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `graphyn-${normalizedCommand}-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, fullContext);

  // Launch Claude directly with the full context
  import('child_process').then(({ spawnSync }) => {
    import('../utils/claude-detector.js').then(({ findClaude }) => {
      findClaude().then((claudeResult) => {
        if (claudeResult.found && claudeResult.path) {
          // Launch Claude synchronously with the full context
          const result = spawnSync(claudeResult.path, [fullContext], {
            stdio: 'inherit',
            shell: false
          });
          
          // Exit with the same code as Claude
          process.exit(result.status || 0);
        } else {
          // Claude not found - show error and exit
          console.error('❌ Claude Code not found. Please install from https://claude.ai/code');
          process.exit(1);
        }
      }).catch((error) => {
        console.error('❌ Error finding Claude:', error.message);
        process.exit(1);
      });
    });
  });
} else if (normalizedCommand === 'orchestrate') {
  // This means orchestrate command has been initiated above
  // Set a timeout as a failsafe
  setTimeout(() => {
    console.error('Orchestrate command timed out.');
    process.exit(1);
  }, 120000); // 2 minute timeout
} else {
  console.error(`Unknown command: ${normalizedCommand}`);
  console.error('Run "graphyn --help" for usage information');
  process.exit(1);
}