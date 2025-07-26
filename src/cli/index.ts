#!/usr/bin/env node
import { createParser } from './parser.js';
import { GraphynInkApp } from './ink-app.js';
import { ErrorHandler } from './errors/index.js';

// Main CLI entry point
async function main() {
  try {
    const parser = createParser();
    const argv = await parser.parseAsync();
    
    await GraphynInkApp.run(argv);
  } catch (error) {
    ErrorHandler.handle(error);
  }
}

// Run the CLI
main().catch(ErrorHandler.handle);