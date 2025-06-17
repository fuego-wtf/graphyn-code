#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Simple color codes without external dependencies
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

console.log(`
═══════════════════════════════════════════════════════════
🎉 ${colors.green}${colors.bright}Graphyn Code installed successfully!${colors.reset}
═══════════════════════════════════════════════════════════

✓ Installation complete

🚀 ${colors.bright}Quick Start:${colors.reset}
  1. Get your FREE API key: ${colors.cyan}https://graphyn.xyz/code${colors.reset}
  2. Authenticate: ${colors.yellow}graphyn auth gph_xxxxxxxxxxxx${colors.reset}
  3. Start coding: ${colors.yellow}graphyn frontend "build a dashboard"${colors.reset}

📚 ${colors.bright}Commands:${colors.reset}
  ${colors.yellow}graphyn backend <query>${colors.reset}    Query backend agent
  ${colors.yellow}graphyn frontend <query>${colors.reset}   Query frontend agent
  ${colors.yellow}graphyn architect <query>${colors.reset}  Query architect agent
  ${colors.yellow}graphyn chain <query>${colors.reset}      Chain all agents
  ${colors.yellow}graphyn init${colors.reset}               Initialize GRAPHYN.md
  ${colors.yellow}graphyn status${colors.reset}             Check customization status
  ${colors.yellow}graphyn --help${colors.reset}             Show all commands

🔗 ${colors.bright}Resources:${colors.reset}
  Documentation: ${colors.cyan}https://graphyn.xyz/code/docs${colors.reset}
  GitHub: ${colors.cyan}https://github.com/graphyn-xyz/graphyn-code${colors.reset}
  Support: ${colors.cyan}support@graphyn.xyz${colors.reset}

${colors.green}${colors.bright}Happy coding with AI! 🚀${colors.reset}
`);

// Create .graphyn directory
const graphynDir = path.join(os.homedir(), '.graphyn');
const dirs = [
  graphynDir,
  path.join(graphynDir, 'prompts'),
  path.join(graphynDir, 'templates'),
  path.join(graphynDir, 'cache'),
  path.join(graphynDir, 'sessions'),
  path.join(graphynDir, 'history')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy template files if they don't exist
const templateSource = path.join(__dirname, '..', 'templates', 'GRAPHYN.md');
const templateDest = path.join(graphynDir, 'templates', 'GRAPHYN.md');

if (fs.existsSync(templateSource) && !fs.existsSync(templateDest)) {
  fs.copyFileSync(templateSource, templateDest);
}