import type { ReactElement } from 'react';
import type { GlobalOptions } from '../parser.js';

export interface CommandOptions {
  [key: string]: {
    type: 'string' | 'boolean' | 'number';
    required?: boolean;
    description?: string;
    alias?: string;
  };
}

export interface CommandHandler {
  (options: GlobalOptions & Record<string, any>): ReactElement | Promise<ReactElement>;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  options?: CommandOptions;
  handler: CommandHandler;
  category?: string;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private categories = new Map<string, Command[]>();
  
  register(command: Command) {
    this.commands.set(command.name, command);
    command.aliases?.forEach(alias => 
      this.commands.set(alias, command)
    );
    
    // Group by category
    if (command.category) {
      const categoryCommands = this.categories.get(command.category) || [];
      categoryCommands.push(command);
      this.categories.set(command.category, categoryCommands);
    }
  }
  
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }
  
  getAll(): Command[] {
    return Array.from(new Set(this.commands.values()));
  }
  
  getByCategory(category: string): Command[] {
    return this.categories.get(category) || [];
  }
  
  getAllCategories(): string[] {
    return Array.from(this.categories.keys());
  }
}

export const commandRegistry = new CommandRegistry();