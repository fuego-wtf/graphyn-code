#!/usr/bin/env node
/**
 * Agent Bridge Command
 * Starts the Claude Agent Bridge for .claude/ directory integration
 */

import { startAgentBridge } from '../claude-agent-bridge.js';
import path from 'path';
import fs from 'fs';

export async function runAgentBridge(workspacePath?: string): Promise<void> {
  try {
    // Auto-detect workspace root
    let workspaceRoot = workspacePath || process.cwd();
    
    // Look for .claude directory to confirm workspace root
    const claudeDir = path.join(workspaceRoot, '.claude');
    if (!fs.existsSync(claudeDir)) {
      // Try parent directories
      let currentDir = workspaceRoot;
      let found = false;
      
      for (let i = 0; i < 5; i++) {
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // reached root
        
        const parentClaudeDir = path.join(parentDir, '.claude');
        if (fs.existsSync(parentClaudeDir)) {
          workspaceRoot = parentDir;
          found = true;
          break;
        }
        currentDir = parentDir;
      }
      
      if (!found) {
        console.error('No .claude directory found. Please run from a project with .claude/ agent configuration.');
        process.exit(1);
      }
    }
    
    console.error(`Starting Agent Bridge for workspace: ${workspaceRoot}`);
    
    // Start the agent bridge
    await startAgentBridge(workspaceRoot);
  } catch (error) {
    console.error('Failed to start agent bridge:', error);
    process.exit(1);
  }
}

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const workspacePath = process.argv[2];
  runAgentBridge(workspacePath);
}