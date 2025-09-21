#!/usr/bin/env node

/**
 * Graphyn - Clean Entry Point with Streaming Interface
 * 
 * Temporarily redirected to use the new streaming TypeScript version
 * until the build system is updated
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use tsx to run the new streaming TypeScript interface directly
const tsxPath = path.join(__dirname, '../node_modules/.bin/tsx');
const entryPoint = path.join(__dirname, '../apps/cli/src/index.ts');

// Pass all command line arguments to tsx
const args = [entryPoint, ...process.argv.slice(2)];

const child = spawn(tsxPath, args, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
