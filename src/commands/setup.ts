import { Command } from 'commander';
import { runFirstTimeSetup } from '../setup/first-run-wizard';

export function createSetupCommand(): Command {
  const command = new Command('setup');
  
  command
    .description('Run the Graphyn setup wizard to configure your environment')
    .action(async () => {
      await runFirstTimeSetup();
    });
  
  return command;
}