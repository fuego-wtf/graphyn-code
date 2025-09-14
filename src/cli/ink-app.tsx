import { Arguments } from 'yargs';
import { GlobalOptionsMiddleware, GlobalContext } from './middleware/global-options.js';
import { ErrorHandler } from './errors/index.js';
import { commandRegistry } from './commands/index.js';

/**
 * Legacy GraphynInkApp - now routes to CLI orchestrator
 * Ink.js UI removed in favor of pure orchestration
 */
export class GraphynInkApp {
  static async run(argv: Arguments): Promise<void> {
    try {
      // Initialize global context
      const context = await GlobalOptionsMiddleware.process(argv);
      
      // Route to CLI orchestrator instead of Ink UI
      await GraphynInkApp.runFallback(context, argv);
    } catch (error) {
      ErrorHandler.handle(error);
    }
  }
  
  private static async runFallback(
    context: GlobalContext,
    argv: Arguments
  ): Promise<void> {
    const command = argv._[0] as string;
    const args = argv._.slice(1) as string[];
    
    context.logger.debug('Running in CLI orchestrator mode (Ink.js removed)');
    
    // Route to new clean CLI for all commands
    const { main: cleanMain } = await import('./main.js');
    
    // Set up process.argv for the clean CLI
    const originalArgv = process.argv;
    const cleanArgs = ['node', 'cli-main'];
    
    // Add command and args if provided
    if (command) cleanArgs.push(command);
    if (args.length > 0) cleanArgs.push(...args);
    
    process.argv = cleanArgs;
    
    try {
      // Call the clean CLI
      await cleanMain();
    } finally {
      // Restore original argv
      process.argv = originalArgv;
    }
  }
}