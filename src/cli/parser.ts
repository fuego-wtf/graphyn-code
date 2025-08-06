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
    })
    .command(
      'spawn <agentTypes..> [query]',
      'Spawn multiple Graphyn agents concurrently with a query',
      (yargs) => {
        return yargs
          .positional('agentTypes', {
            describe: 'A space-separated list of agent types (e.g., "backend frontend")',
            type: 'string',
            array: true,
            demandOption: true,
          })
          .positional('query', {
            describe: 'The query to send to the agents',
            type: 'string',
            demandOption: false,
            default: ''
          });
      }
    )
    .help()
    .alias('h', 'help');
}