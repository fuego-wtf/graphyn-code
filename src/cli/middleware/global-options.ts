import { Arguments } from 'yargs';
import { UnifiedConfig } from '../config/unified-config.js';
import { Logger } from '../../utils/logger.js';
import type { GlobalOptions } from '../parser.js';

export interface GlobalContext {
  options: GlobalOptions;
  config: UnifiedConfig;
  logger: Logger;
}

export class GlobalOptionsMiddleware {
  static async process(argv: Arguments): Promise<GlobalContext> {
    const options: GlobalOptions = {
      dev: argv.dev as boolean || false,
      verbose: argv.verbose as boolean || false,
      config: argv.config as string | undefined,
      color: argv.color as boolean || true,
      forceInteractive: argv.forceInteractive as boolean || false
    };
    
    // Initialize configuration
    const config = await UnifiedConfig.initialize(options);
    
    // Set up logging
    const logger = new Logger();
    if (options.verbose) {
      logger.setLevel('debug');
      process.env.GRAPHYN_VERBOSE = 'true';
    } else {
      logger.setLevel('info');
    }
    
    // Set development mode
    if (options.dev) {
      process.env.GRAPHYN_ENV = 'development';
      logger.debug('Running in development mode');
    }
    
    // Force color output
    if (options.color) {
      process.env.FORCE_COLOR = '1';
    }
    
    // Log configuration sources
    logger.debug('Configuration sources:', UnifiedConfig.getSources());
    
    return {
      options,
      config,
      logger
    };
  }
}