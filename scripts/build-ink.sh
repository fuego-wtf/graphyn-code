#!/bin/bash

# Build script for Ink-based Graphyn Code

set -e

echo "🔨 Building Graphyn Code with Ink..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist

# Compile TypeScript files
echo "📦 Compiling TypeScript..."
npx tsc \
  --module ESNext \
  --target ES2022 \
  --jsx react \
  --esModuleInterop \
  --skipLibCheck \
  --moduleResolution bundler \
  --outDir dist \
  --declaration false \
  src/ink/cli.tsx \
  src/ink/cli-fallback.ts \
  src/ink/App.tsx \
  src/ink/store.ts \
  src/ink/components/MainMenu.tsx \
  src/ink/components/AgentContext.tsx \
  src/ink/components/Loading.tsx

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

const cliPath = join(__dirname, 'ink', 'cli.js');
const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
EOF

chmod +x dist/graphyn-wrapper.js

echo "✅ Build complete!"
echo ""
echo "Test with: node dist/ink/cli.js"
echo "Or: npm link && graphyn"