import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface GlobalOptions {
  dev: boolean;
  verbose: boolean;
  config?: string;
  color: boolean;
  forceInteractive?: boolean;
}

export function createParser() {
  return yargs(hideBin(process.argv))
    .options({
      dev: {
        type: 'boolean',
        description: 'Use development servers',
        default: false
      },
      verbose: {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose logging',
        default: false
      },
      config: {
        alias: 'c',
        type: 'string',
        description: 'Path to config file'
      },
      color: {
        type: 'boolean',
        description: 'Force color output',
        default: process.stdout.isTTY
      },
      'force-interactive': {
        type: 'boolean',
        description: 'Force interactive mode even in non-TTY',
        default: false
      }
    })
    .middleware((argv) => {
      // Apply global options
      process.env.GRAPHYN_VERBOSE = argv.verbose ? 'true' : 'false';
      process.env.FORCE_COLOR = argv.color ? '1' : '0';
      if (argv.dev) {
        process.env.GRAPHYN_ENV = 'development';
      }
    });
}