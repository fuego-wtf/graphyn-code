#!/usr/bin/env node

// Wrap entire script in try-catch to prevent npm install failures
try {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // Check if running in CI or minimal environment
  const isCI = process.env.CI || process.env.CONTINUOUS_INTEGRATION;
  const isMinimal = process.env.GRAPHYN_MINIMAL_INSTALL;
  
  if (isCI || isMinimal) {
    console.log('Graphyn Code: Skipping postinstall in CI/minimal environment');
    process.exit(0);
  }

  // Simple color codes without external dependencies
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
  };
  
  // Check if colors are supported
  const supportsColor = process.stdout.isTTY && process.platform !== 'win32';

  const c = supportsColor ? colors : {
    reset: '',
    bright: '',
    green: '',
    blue: '',
    cyan: '',
    yellow: ''
  };

  console.log(`
═══════════════════════════════════════════════════════════
🎉 ${c.green}${c.bright}Graphyn Code installed successfully!${c.reset}
═══════════════════════════════════════════════════════════

✓ Installation complete

🚀 ${c.bright}Quick Start:${c.reset}
  1. Initialize your project: ${c.yellow}graphyn init${c.reset}
  2. Generate from Figma: ${c.yellow}graphyn design <figma-url>${c.reset}
  3. Share with team: ${c.yellow}graphyn share agent${c.reset}

📚 ${c.bright}Commands:${c.reset}
  ${c.yellow}graphyn init${c.reset}               Set up Graphyn in your project
  ${c.yellow}graphyn design <url>${c.reset}       Generate pixel-perfect components
  ${c.yellow}graphyn backend <query>${c.reset}    Query backend agent
  ${c.yellow}graphyn frontend <query>${c.reset}   Query frontend agent
  ${c.yellow}graphyn architect <query>${c.reset}  Query architect agent
  ${c.yellow}graphyn --help${c.reset}             Show all commands

💰 ${c.bright}Graphyn Ultra - $39/month:${c.reset}
  • Unlimited Figma extractions
  • Unlimited organizations
  • Team agent sharing
  • AI that learns your patterns

🔗 ${c.bright}Resources:${c.reset}
  Website: ${c.cyan}https://graphyn.com${c.reset}
  Documentation: ${c.cyan}https://graphyn.com/docs${c.reset}
  Support: ${c.cyan}support@graphyn.com${c.reset}

${c.green}${c.bright}Start with: graphyn init 🚀${c.reset}
`);

  // Create .graphyn directory with error handling
  try {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    const dirs = [
      graphynDir,
      path.join(graphynDir, 'prompts'),
      path.join(graphynDir, 'templates'),
      path.join(graphynDir, 'cache'),
      path.join(graphynDir, 'sessions'),
      path.join(graphynDir, 'history'),
      path.join(graphynDir, 'contexts'),
      path.join(graphynDir, 'agents')
    ];

    dirs.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (e) {
        // Silently fail - user might not have permissions
      }
    });

    // Copy template files if they don't exist
    const templateSource = path.join(__dirname, '..', 'templates', 'GRAPHYN.md');
    const templateDest = path.join(graphynDir, 'templates', 'GRAPHYN.md');

    if (fs.existsSync(templateSource) && !fs.existsSync(templateDest)) {
      try {
        fs.copyFileSync(templateSource, templateDest);
      } catch (e) {
        // Silently fail
      }
    }
  } catch (e) {
    // Directory creation failed - not critical
  }

} catch (error) {
  // Silently exit - don't break npm install
  process.exit(0);
}