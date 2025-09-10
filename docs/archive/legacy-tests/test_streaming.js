#!/usr/bin/env node

// Quick test of streaming functionality
import { main } from './src/cli-orchestrator.js';

// Override process.argv to simulate CLI call
process.argv = ['node', 'cli', 'help me understand what is going on here'];

main().catch(console.error);