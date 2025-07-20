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

const [, , rawCommand, ...args] = process.argv;
const command = rawCommand?.toLowerCase(); // Make command case-insensitive
const query = args.join(' ');

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

// If no command, show error
if (!normalizedCommand) {
  console.error('Interactive mode requires a TTY terminal.');
  console.error('Please use: graphyn <agent> <query>');
  console.error('Or run in a proper terminal for interactive mode.');
  process.exit(1);
}

// Handle commands that require interactive mode
if (['init', 'init-graphyn', 'thread', 'agent'].includes(normalizedCommand)) {
  console.error(`The "graphyn ${normalizedCommand}" command requires an interactive terminal.`);
  console.error('Please run this command in a proper terminal (not piped or in CI).');
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
  const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
  if (fs.existsSync(graphynPath)) {
    projectContext = fs.readFileSync(graphynPath, 'utf-8');
  }

  // Combine context
  const fullContext = `# ${normalizedCommand.charAt(0).toUpperCase() + normalizedCommand.slice(1)} Agent Context

${agentPrompt}

${projectContext ? `# Project Context (from GRAPHYN.md)\n${projectContext}\n\n` : ''}

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
} else {
  console.error(`Unknown command: ${normalizedCommand}`);
  console.error('Run "graphyn --help" for usage information');
  process.exit(1);
}