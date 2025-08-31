/**
 * Clyde Orchestrator - Main entry point
 * Revolutionary AI agent orchestrator with dual-mode architecture
 */

import { ModeManager, type Mode } from './mode-manager.js';
import { SmartCoordinator } from '../coordinator/smart-coordinator.js';
import { InteractiveShell } from './interactive-shell.js';
import { ContextPreservingSession } from './context-preserving-session.js';
import { StandaloneEngine } from '../engines/standalone-engine.js';
import { DynamicEngine } from '../engines/dynamic-engine.js';
import chalk from 'chalk';

export class ClydeOrchestrator {
  private modeManager: ModeManager;
  private coordinator: SmartCoordinator;
  private session: ContextPreservingSession;
  private shell: InteractiveShell;
  private standaloneEngine: StandaloneEngine;
  private dynamicEngine: DynamicEngine;

  constructor() {
    this.modeManager = new ModeManager();
    this.session = new ContextPreservingSession();
    this.standaloneEngine = new StandaloneEngine();
    this.dynamicEngine = new DynamicEngine();
    
    this.coordinator = new SmartCoordinator({
      modeManager: this.modeManager,
      standaloneEngine: this.standaloneEngine,
      dynamicEngine: this.dynamicEngine,
      session: this.session
    });
    
    this.shell = new InteractiveShell({
      coordinator: this.coordinator,
      modeManager: this.modeManager,
      session: this.session
    });
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan.bold('🤖 Initializing Clyde...'));
    
    // Detect and set mode
    await this.modeManager.detectMode();
    
    // Initialize session
    await this.session.initialize();
    
    // Initialize appropriate engine
    const mode = this.modeManager.getCurrentMode();
    if (mode === 'dynamic') {
      await this.dynamicEngine.initialize();
    } else {
      await this.standaloneEngine.initialize();
    }
    
    console.log(chalk.green('✅ Clyde initialized successfully'));
  }

  async executeCommand(command: string): Promise<void> {
    // Direct command execution
    console.log(chalk.gray(`🧠 Processing: ${command}`));
    await this.coordinator.processCommand(command);
  }

  async startInteractive(): Promise<void> {
    // Interactive shell mode
    await this.shell.start();
  }

  async start(): Promise<void> {
    // Legacy method - check for command line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      await this.executeCommand(args.join(' '));
    } else {
      await this.startInteractive();
    }
  }

  async shutdown(): Promise<void> {
    console.log(chalk.yellow('👋 Shutting down Clyde...'));
    
    await this.session.save();
    
    if (this.modeManager.getCurrentMode() === 'dynamic') {
      await this.dynamicEngine.disconnect();
    }
    
    console.log(chalk.green('✨ Goodbye!'));
  }
}