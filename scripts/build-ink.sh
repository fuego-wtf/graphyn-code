#!/bin/bash

# Build script for Ink-based Graphyn Code

set -e

echo "🔨 Building Graphyn Code with Ink..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
if [ -d "dist" ]; then
  if [ -w "dist" ]; then
    rm -rf dist 2>/dev/null || true
  else
    echo "⚠️  Warning: dist directory is not writable. You may need to run: sudo rm -rf dist"
    echo "   Attempting to continue with existing dist directory..."
  fi
fi
mkdir -p dist 2>/dev/null || true

# Compile TypeScript files - only ink directory and necessary dependencies
echo "📦 Compiling TypeScript..."
# Create temporary tsconfig for ink build
cat > tsconfig.ink.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "strict": false,
    "skipLibCheck": true,
    "noImplicitReturns": false
  },
  "include": [
    "src/ink/**/*",
    "src/api-client.ts",
    "src/config.ts",
    "src/config-manager.ts",
    "src/figma-oauth.ts",
    "src/figma-api.ts",
    "src/logger.ts",
    "src/ui.ts",
    "src/utils/claude-detector.ts",
    "src/utils/agent-config-manager.ts",
    "src/utils/git.ts",
    "src/utils/context-detector.ts",
    "src/utils/logger.ts",
    "src/auth/**/*.ts",
    "src/api/teams.ts",
    "src/commands/*.ts",
    "src/mcp/*.ts",
    "src/cli/**/*.ts",
    "src/cli/**/*.tsx",
    "src/context/**/*.ts",
    "src/cli-main.ts"
  ],
  "exclude": [
    "src/ink/**/*.test.tsx",
    "src/ink/test/**/*",
    "src/ink/components/StatusBar.tsx",
    "src/utils/repository-detector.ts"
  ]
}
EOF

npx tsc -p tsconfig.ink.json --noEmitOnError false || true

# Clean up temp tsconfig
rm tsconfig.ink.json

# Copy non-TS files
echo "📄 Copying assets..."
cp -r prompts dist/ 2>/dev/null || true
cp -r templates dist/ 2>/dev/null || true

# Make CLI executable
echo "🔧 Setting permissions..."
chmod +x dist/ink/cli.js 2>/dev/null || true
chmod +x dist/ink/cli-fallback.js 2>/dev/null || true

# Create bin wrapper
echo "🔗 Creating bin wrapper..."
cat > dist/graphyn-wrapper.js << 'EOF'
#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse arguments to determine which CLI to use
const args = process.argv.slice(2);
const firstArg = args[0]?.toLowerCase();

// Check if this is a natural language query
const isNaturalLanguageQuery = args.length > 0 && (
  // Quoted strings
  (args.join(' ').match(/^".*"$/) || args.join(' ').match(/^'.*'$/)) ||
  // Starts with "I need", "I want", "Create", "Help", etc.
  firstArg?.startsWith('i ') ||
  ['create', 'help', 'add', 'build', 'make', 'setup', 'implement'].includes(firstArg) ||
  // Not a known command
  !['backend', 'frontend', 'architect', 'design', 'cli', 'auth', 'logout', '--version', '-v', '--help', '-h'].includes(firstArg)
);

// Route to appropriate CLI
let cliPath;
if (isNaturalLanguageQuery || firstArg === 'auth' || firstArg === 'logout' || firstArg === 'mcp' || firstArg === 'squad' || firstArg === 'analyze' || firstArg === 'doctor') {
  // Use the new OAuth-based CLI for natural language queries and MCP commands
  cliPath = join(__dirname, 'cli-main.js');
} else {
  // Use the original Ink CLI for agent commands
  cliPath = join(__dirname, 'ink', 'cli.js');
}

// Create child process
const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

// Flag to prevent multiple exits and track if we're shutting down due to signal
let exiting = false;
let signalReceived = false;

// Forward all signals to child
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
  process.on(signal, () => {
    if (!exiting) {
      exiting = true;
      signalReceived = true;
      child.kill(signal);
      // Force exit after a timeout if child doesn't exit cleanly
      setTimeout(() => {
        process.exit(130); // 128 + 2 (SIGINT)
      }, 1000);
    }
  });
});

// When child exits, exit parent with same code
child.on('exit', (code, signal) => {
  if (!exiting) {
    exiting = true;
    // If we received a signal, always exit with signal code
    // This prevents tools from thinking it was a clean exit
    if (signalReceived) {
      process.exit(130); // 128 + 2 (SIGINT)
    } else {
      process.exit(code || 0);
    }
  }
});

// Handle errors
child.on('error', (err) => {
  console.error('Failed to start CLI:', err);
  process.exit(1);
});
EOF

chmod +x dist/graphyn-wrapper.js

echo "✅ Build complete!"
echo ""
echo "Test with: node dist/ink/cli.js"
echo "Or: npm link && graphyn"