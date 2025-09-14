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
    
    // Route to CLI orchestrator for all commands
    const { main: orchestratorMain } = await import('../cli-orchestrator.js');
    
    // Set up process.argv for the orchestrator
    const originalArgv = process.argv;
    const orchestratorArgs = ['node', 'cli-orchestrator.ts'];
    
    // Add command and args if provided
    if (command) orchestratorArgs.push(command);
    if (args.length > 0) orchestratorArgs.push(...args);
    
    process.argv = orchestratorArgs;
    
    try {
      // Call the orchestrator
      await orchestratorMain();
    } finally {
      // Restore original argv
      process.argv = originalArgv;
    }
  }
}