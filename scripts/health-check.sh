#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || true)}"

if [[ -z "${CLAUDE_BIN}" ]]; then
  echo "❌ Claude CLI not found. Set CLAUDE_BIN or run scripts/setup-claude.sh"
  exit 1
fi

echo "✅ Found Claude CLI at ${CLAUDE_BIN}"

echo "🔍 Checking MCP mock server..."
USE_MOCK_DB=true GRAPHYN_USE_MOCK_MCP=true node "${ROOT_DIR}/services/mcp/dist/server.js" --health || {
  echo "❌ MCP server health check failed"
  exit 1
}

echo "✅ MCP server responded to health check"
