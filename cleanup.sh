#!/bin/bash

# Cleanup script to remove 80% of repo bloat
# Run with: ./cleanup.sh

set -e

echo "🧹 Starting repo cleanup..."
echo "⚠️  This will DELETE files. Press Ctrl+C in next 5 seconds to cancel..."
sleep 5

# 1. Demo Pollution
echo "🗑️  Removing demo files..."
rm -f demo-*.ts
rm -f hello*.py  
rm -f minimal_streaming_test.js
rm -f debug_streaming.js
rm -f fixed-claude-streaming.mjs
rm -rf examples/ 2>/dev/null || true

# 2. NASA TUI Files
echo "🗑️  Removing TUI bloat..."
rm -rf src/tui/ 2>/dev/null || true
rm -rf tests/tui/ 2>/dev/null || true
rm -f docs/tui-components.md
rm -f TODO.md

# 3. Duplicate Files
echo "🗑️  Removing duplicates..."
rm -f src/orchestrator/MultiAgentOrchestrator.ts
rm -f .eslintrc.json
rm -f README-*.md
rm -rf .claude/agents_backup/ 2>/dev/null || true

# 4. Archive Pollution
echo "🗑️  Removing archive pollution..."
rm -rf archive/ 2>/dev/null || true
rm -rf docs/archive/ 2>/dev/null || true
rm -f CLAUDE*.md
rm -f HUMAN_IN_LOOP_DESIGN.md
rm -f SYSTEM_ARCHITECTURE.md
rm -f fix-claude-connectivity.md

# 5. Abandoned Features
echo "🗑️  Removing abandoned features..."
rm -rf src/clyde/ 2>/dev/null || true
rm -f src/claude-*
rm -f src/api-client.ts
rm -f src/auth.ts
rm -f docker-compose-cli.yml
rm -f openapitools.json

# 6. Script Pollution
echo "🗑️  Removing script pollution..."
rm -f scripts/completion.bash
rm -f scripts/create-agents.sh
rm -f scripts/generate-sdk.js
rm -f scripts/graphyn
rm -f scripts/graphyn-functions.sh
rm -f scripts/install.sh
rm -f scripts/postinstall.js
rm -f scripts/test-package.sh
rm -f scripts/validate-package.cjs

# Clean empty directories
echo "🗑️  Cleaning empty directories..."
find . -type d -empty -delete 2>/dev/null || true

echo "✅ Cleanup complete!"
echo ""
echo "📊 Repository reduced from 200+ files to ~20 essential files"
echo "🎯 Focus restored to core innovations:"
echo "   • MCP auto-discovery"
echo "   • Intelligent configuration"  
echo "   • Stable subprocess management"
echo "   • Parallel agent coordination"
echo ""
echo "Next: Test that orchestration still works"