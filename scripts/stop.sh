#!/bin/bash

# Stop script for Graphyn Code
# Clean up any running processes per rule

echo "🛑 Stopping Graphyn Code processes..."

# Kill any running node processes from this project
pkill -f "MultiAgentOrchestrator" 2>/dev/null || true
pkill -f "graphyn" 2>/dev/null || true

# Clean up any temp files
rm -f /tmp/graphyn-* 2>/dev/null || true

# Clean build artifacts if requested
if [ "$1" = "clean" ]; then
    echo "🧹 Cleaning build artifacts..."
    rm -rf dist/ 2>/dev/null || true
    rm -rf node_modules/.cache/ 2>/dev/null || true
fi

echo "✅ Cleanup complete!"