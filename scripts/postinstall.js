#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log(`
═══════════════════════════════════════════════════════════
🎉 Graphyn Code installed successfully!
═══════════════════════════════════════════════════════════

✓ Installation complete

🚀 Quick Start:
  1. Get your FREE API key: https://graphyn.xyz/code
  2. Authenticate: graphyn auth gph_xxxxxxxxxxxx
  3. Start coding: graphyn frontend "build a dashboard"

📚 Commands:
  graphyn backend <query>    Query backend agent
  graphyn frontend <query>   Query frontend agent
  graphyn architect <query>  Query architect agent
  graphyn chain <query>      Chain all agents
  graphyn init               Initialize GRAPHYN.md
  graphyn status             Check customization status
  graphyn --help             Show all commands

🔗 Resources:
  Documentation: https://graphyn.xyz/code/docs
  GitHub: https://github.com/graphyn-xyz/graphyn-code
  Support: support@graphyn.xyz

Happy coding with AI! 🚀
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