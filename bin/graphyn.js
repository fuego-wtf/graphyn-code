#!/usr/bin/env node
/**
 * Graphyn - Smart Claude Code Orchestrator
 * Entry point that routes to appropriate CLI based on arguments
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Always use tsx for development until module resolution is fixed
const sourcePath = join(__dirname, '..', 'src', 'cli-orchestrator.ts');

if (!existsSync(sourcePath)) {
  console.error('❌ CLI orchestrator source not found:', sourcePath);
  process.exit(1);
}

const cmd = 'npx';
const args = ['tsx', sourcePath, ...process.argv.slice(2)];

// Start the appropriate CLI
const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: join(__dirname, '..')
});

child.on('exit', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Failed to start Graphyn CLI:', err);
  process.exit(1);
});