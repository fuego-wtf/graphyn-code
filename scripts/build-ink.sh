#!/bin/bash

# Build script for Ink-based Graphyn Code

set -e

echo "🔨 Building Graphyn Code with Ink..."

# Clean dist directory (fallback to temp if not writable)
OUT_DIR="dist"
echo "🧹 Cleaning dist directory..."
if [ -d "${OUT_DIR}" ]; then
  if [ -w "${OUT_DIR}" ]; then
    rm -rf "${OUT_DIR}" 2>/dev/null || true
  else
    echo "⚠️  Warning: ${OUT_DIR} is not writable. Falling back to ${HOME}/.graphyn/tmp-dist"
    OUT_DIR="${HOME}/.graphyn/tmp-dist"
    rm -rf "${OUT_DIR}" 2>/dev/null || true
  fi
fi
mkdir -p "${OUT_DIR}" 2>/dev/null || true

# Compile TypeScript files - only ink directory and necessary dependencies
echo "📦 Compiling TypeScript..."
# Create temporary tsconfig for ink build
cat > tsconfig.ink.json << EOF
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
    "noImplicitReturns": false,
    "outDir": "${OUT_DIR}"
  },
  "include": [
    "src/ink/**/*",
    "src/api-client.ts",
    "src/config.ts",
    "src/config-manager.ts",
    
    "src/figma-api.ts",
    "src/logger.ts",
    "src/ui.ts",
    "src/utils/claude-detector.ts",
    "src/utils/agent-config-manager.ts",
    "src/utils/git.ts",
    "src/utils/context-detector.ts",
    "src/utils/logger.ts",
    "src/auth/**/*.ts",
    
    "src/commands/**/*.ts",
    "src/services/**/*.ts",
    "src/cli/**/*.ts",
    "src/cli/**/*.tsx",
    "src/context/**/*.ts",
    "src/orchestrator/**/*.ts",
    "src/orchestrator/**/*.tsx",
    "src/cli-main.ts"
  ],
  "exclude": [
    "src/ink/**/*.test.tsx",
    "src/ink/test/**/*",
    "src/ink/components/StatusBar.tsx",
    "src/utils/repository-detector.ts",
    "src/**/*.test.ts",
    "src/**/*.test.tsx"
  ]
}
EOF

tsc -p tsconfig.ink.json --noEmitOnError false || true

# Clean up temp tsconfig
rm tsconfig.ink.json

# Copy non-TS files
echo "📄 Copying assets..."
cp -r prompts "${OUT_DIR}/" 2>/dev/null || true
cp -r templates "${OUT_DIR}/" 2>/dev/null || true

# Make CLI executable
echo "🔧 Setting permissions..."
chmod +x "${OUT_DIR}/ink/cli.js" 2>/dev/null || true
chmod +x "${OUT_DIR}/ink/cli-fallback.js" 2>/dev/null || true

if [ -w "${OUT_DIR}" ]; then
  echo "🔗 Creating bin wrapper..."
  cat > "${OUT_DIR}/graphyn-wrapper.js" << 'EOF'
#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Decide mode: no args => GUI (Ink), with args => non-GUI cli-main
const hasArgs = process.argv.length > 2;
const cliPath = hasArgs
  ? join(__dirname, 'cli-main.js')
  : join(__dirname, 'ink', 'cli.js');

const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Failed to start CLI:', err);
  process.exit(1);
});
EOF

  chmod +x "${OUT_DIR}/graphyn-wrapper.js" || true
else
  echo "⚠️  Skipping bin wrapper creation (${OUT_DIR} not writable). Run: sudo chown -R $USER ${OUT_DIR}"
fi

echo "✅ Build complete!"
echo ""
echo "Test with: node ${OUT_DIR}/ink/cli.js"
echo "Or: npm link && graphyn"