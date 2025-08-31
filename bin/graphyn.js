#!/usr/bin/env node
/**
 * Graphyn - Smart Claude Code Orchestrator
 * Entry point that routes to appropriate CLI based on arguments
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the unified CLI - fast, simple, direct GraphNeuralSystem execution
const cliPath = join(__dirname, '..', 'dist', 'cli.js');

// Start the appropriate CLI
const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Failed to start Graphyn CLI:', err);
  process.exit(1);
});