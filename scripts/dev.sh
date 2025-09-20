#!/bin/bash

# Development script for Graphyn Code
# All dev tasks built into this single script per rule

set -e

echo "🚀 Starting Graphyn Code development environment..."

# Check dependencies
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Add blessed.js for TUI if not installed
if ! npm list blessed &> /dev/null; then
    echo "📺 Installing TUI dependencies..."
    npm install blessed @types/blessed
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npx tsc

# Run basic tests
echo "🧪 Running tests..."
if [ -f "package.json" ] && grep -q "test" package.json; then
    npm test
else
    echo "ℹ️ No tests configured - skipping"
fi

echo "✅ Development environment ready!"
echo ""
echo "💡 Usage:"
echo "   Legacy: node dist/MultiAgentOrchestrator.js 'Build a REST API'"
echo "   Graphyn: node dist/graphyn-cli.js 'Build authentication system'"
echo "   Direct:  npm run graphyn 'Create REST API with JWT'"
echo ""
echo "🎮 TUI Controls:"
echo "   p/pause    - Pause all agents"
echo "   r/resume   - Resume all agents" 
echo "   clear      - Clear logs"
echo "   q/Ctrl+C   - Quit"