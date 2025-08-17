#!/usr/bin/env node
/**
 * MCP Server Command
 * Starts the Graphyn MCP Bridge for Claude Code integration
 */

import { startMCPServer } from '../mcp/bridge-implementation.js';

export async function runMCPServer(): Promise<void> {
  try {
    // Start the MCP server
    await startMCPServer();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runMCPServer();
}