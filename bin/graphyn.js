#!/usr/bin/env node

/**
 * Graphyn - Clean Entry Point
 * 
 * Simple wrapper that imports and runs the main CLI
 * Replaces the verbose and cluttered bin/graphyn.js
 */

import { main } from '../dist/cli/main.js';

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
