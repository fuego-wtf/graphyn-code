/**
 * SplitScreenOrchestrator
 * 
 * Main orchestrator that coordinates all enhanced UX components:
 * - Split-screen terminal interface
 * - Repository-aware context management
 * - Task decomposition and approval workflow
 * - Exit protection and session preservation
 */

import { EventEmitter } from 'events';
import { SplitScreenInterface } from './services/split-screen-interface.js';
import { RepositoryContextManager } from './services/repository-context-manager.js';
import { ApprovalWorkflowHandler } from './services/approval-workflow-handler.js';
import type {
  TerminalDimensions,
  EnhancedUXConfig,
  EnhancedUXEvent,
  TaskDecompositionResult,
  ApprovalState,
  InputState,
  PerformanceMetrics
} from './types.js';

export class SplitScreenOrchestrator extends EventEmitter {
  private splitScreen: SplitScreenInterface;
  private contextManager: RepositoryContextManager;
  private workflowHandler: ApprovalWorkflowHandler;
  private config: EnhancedUXConfig;
  private currentDirectory: string = process.cwd();
  private isActive: boolean = false;
  private currentApprovalState: ApprovalState | null = null;
  private inputState: InputState = {
    text: '',
    cursorPosition: 0,
    history: [],
    historyIndex: -1
  };

  constructor(config?: Partial<EnhancedUXConfig>) {
    super();

    // Default configuration
    this.config = {
      performance: {
        maxRenderTime: 16,
        maxAnalysisTime: 3000,
        maxInputResponseTime: 50,
        maxMemoryUsage: 150 * 1024 * 1024
      },
      layout: {
        streamingRatio: 0.7,
        approvalRatio: 0.2,
        inputRatio: 0.1
      },
      features: {
        enableExitProtection: true,
        enableContextCaching: true,
        enablePerformanceMonitoring: true
      },
      ...config
    };

    // Initialize services
    this.splitScreen = new SplitScreenInterface(this.config);
    this.contextManager = new RepositoryContextManager(this.config);
    this.workflowHandler = new ApprovalWorkflowHandler(this.config);

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers between components
   */
  private setupEventHandlers(): void {
    // Handle terminal resize events
    process.stdout.on('resize', () => {
      const dimensions: TerminalDimensions = {
        width: process.stdout.columns || 120,
        height: process.stdout.rows || 40
      };
      this.splitScreen.handleTerminalResize(dimensions);
    });

    // Handle directory changes
    this.contextManager.on('directory_change', async (path: string) => {
      if (this.isActive) {
        await this.updateRepositoryContext(path);
      }
    });

    // Handle workflow completion
    this.workflowHandler.on('approval_completed', (approvalState: ApprovalState) => {
      this.currentApprovalState = approvalState;
      this.emit('workflow_approved', approvalState);
    });

    // Handle performance warnings
    const handlePerformanceWarning = (warning: string) => {
      this.emit('performance_warning', warning);
    };

    this.splitScreen.on('performance_warning', handlePerformanceWarning);
    this.contextManager.on('performance_warning', handlePerformanceWarning);
    this.workflowHandler.on('performance_warning', handlePerformanceWarning);

    // Handle process exit signals if exit protection is enabled
    if (this.config.features.enableExitProtection) {
      this.setupExitProtection();
    }
  }

  /**
   * Start the enhanced UX interface
   */
  async start(query?: string): Promise<void> {
    if (this.isActive) {
      throw new Error('Enhanced UX interface is already active');
    }

    try {
      this.isActive = true;

      // Get terminal dimensions
      const dimensions: TerminalDimensions = {
        width: process.stdout.columns || 120,
        height: process.stdout.rows || 40
      };

      // Initialize split-screen layout
      this.splitScreen.handleTerminalResize(dimensions);

      // Analyze current repository context
      await this.updateRepositoryContext(this.currentDirectory);

      // If query provided, start with task decomposition
      if (query) {
        await this.processQuery(query);
      } else {
        // Start with empty interface
        await this.render();
      }

      // Start watching current directory for changes
      if (this.config.features.enableContextCaching) {
        await this.contextManager.watchDirectory(this.currentDirectory);
      }

      this.emit('started');

    } catch (error) {
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Process user query with enhanced UX workflow
   */
  async processQuery(query: string): Promise<void> {
    try {
      // Update input state
      this.inputState.text = query;
      this.inputState.history.unshift(query);
      
      // Add query to streaming output
      const streamingContent = [
        `🤖 Processing query: "${query}"`,
        '📊 Decomposing into tasks...'
      ];

      await this.splitScreen.updateStreamingRegion(streamingContent);

      // Decompose query into tasks
      const decomposition = await this.workflowHandler.decomposeQuery(query);
      
      streamingContent.push(
        `✅ Found ${decomposition.tasks.length} tasks`,
        `⏱️ Estimated time: ${Math.round(decomposition.totalEstimatedTime / 60)} minutes`,
        `🔀 Parallelizable: ${decomposition.parallelizable ? 'Yes' : 'No'}`,
        `🎯 Complexity: ${decomposition.complexity}`,
        '',
        '📋 Review tasks in approval panel below:'
      );

      // Initialize approval workflow
      this.currentApprovalState = await this.workflowHandler.initializeApproval(decomposition.tasks);

      // Update display
      await this.render();

      this.emit('query_processed', { query, decomposition });

    } catch (error) {
      const errorMessage = `❌ Error processing query: ${error instanceof Error ? error.message : String(error)}`;
      await this.splitScreen.updateStreamingRegion([errorMessage]);
      throw error;
    }
  }

  /**
   * Handle keyboard input
   */
  async handleKeyboardInput(key: string): Promise<void> {
    if (!this.isActive) return;

    const startTime = performance.now();

    try {
      // Handle input based on context
      if (this.currentApprovalState && !this.currentApprovalState.approved) {
        // In approval mode
        await this.handleApprovalKeyboard(key);
      } else {
        // In input mode
        await this.handleInputKeyboard(key);
      }

      // Check input response performance
      const responseTime = performance.now() - startTime;
      if (responseTime > this.config.performance.maxInputResponseTime) {
        this.emit('performance_warning', `Input response time ${responseTime.toFixed(2)}ms exceeds ${this.config.performance.maxInputResponseTime}ms target`);
      }

    } catch (error) {
      const errorMessage = `Input error: ${error instanceof Error ? error.message : String(error)}`;
      await this.splitScreen.updateStreamingRegion([errorMessage]);
    }
  }

  /**
   * Handle keyboard input during approval workflow
   */
  private async handleApprovalKeyboard(key: string): Promise<void> {
    if (!this.currentApprovalState) return;

    const action = this.mapKeyToAction(key);
    if (!action) return;

    try {
      this.currentApprovalState = await this.workflowHandler.handleKeyboardInput(
        this.currentApprovalState,
        action
      );

      await this.render();

    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        await this.stop();
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle keyboard input during text input
   */
  private async handleInputKeyboard(key: string): Promise<void> {
    switch (key) {
      case '\r': // Enter
      case '\n':
        if (this.inputState.text.trim()) {
          await this.processQuery(this.inputState.text.trim());
          this.inputState.text = '';
          this.inputState.cursorPosition = 0;
        }
        break;

      case '\x7f': // Backspace
      case '\b':
        if (this.inputState.cursorPosition > 0) {
          this.inputState.text = 
            this.inputState.text.slice(0, this.inputState.cursorPosition - 1) +
            this.inputState.text.slice(this.inputState.cursorPosition);
          this.inputState.cursorPosition--;
        }
        break;

      case '\x1b[A': // Up arrow - history
        if (this.inputState.history.length > 0 && this.inputState.historyIndex < this.inputState.history.length - 1) {
          this.inputState.historyIndex++;
          this.inputState.text = this.inputState.history[this.inputState.historyIndex];
          this.inputState.cursorPosition = this.inputState.text.length;
        }
        break;

      case '\x1b[B': // Down arrow - history
        if (this.inputState.historyIndex > 0) {
          this.inputState.historyIndex--;
          this.inputState.text = this.inputState.history[this.inputState.historyIndex];
          this.inputState.cursorPosition = this.inputState.text.length;
        } else if (this.inputState.historyIndex === 0) {
          this.inputState.historyIndex = -1;
          this.inputState.text = '';
          this.inputState.cursorPosition = 0;
        }
        break;

      case '\x1b[C': // Right arrow
        this.inputState.cursorPosition = Math.min(
          this.inputState.cursorPosition + 1,
          this.inputState.text.length
        );
        break;

      case '\x1b[D': // Left arrow
        this.inputState.cursorPosition = Math.max(this.inputState.cursorPosition - 1, 0);
        break;

      default:
        // Regular character input
        if (key.length === 1 && key >= ' ') {
          this.inputState.text = 
            this.inputState.text.slice(0, this.inputState.cursorPosition) +
            key +
            this.inputState.text.slice(this.inputState.cursorPosition);
          this.inputState.cursorPosition++;
        }
        break;
    }

    await this.render();
  }

  /**
   * Map keyboard key to approval action
   */
  private mapKeyToAction(key: string) {
    const keyMap = {
      'a': { key, action: 'approve' as const },
      'm': { key, action: 'modify' as const },
      'f': { key, action: 'filter' as const },
      'c': { key, action: 'cancel' as const },
      '\x1b[A': { key, action: 'previous' as const }, // Up arrow
      '\x1b[B': { key, action: 'next' as const },     // Down arrow
      ' ': { key, action: 'toggle' as const }         // Space
    };

    return keyMap[key as keyof typeof keyMap];
  }

  /**
   * Update repository context
   */
  private async updateRepositoryContext(directoryPath: string): Promise<void> {
    try {
      const contextResult = await this.contextManager.analyzeRepository(directoryPath);
      
      // Update streaming output with context information
      const contextInfo = [
        `📁 Repository: ${contextResult.repository.name}`,
        `🛠️ Tech Stack: ${contextResult.repository.techStack.join(', ')}`,
        `📦 Frameworks: ${contextResult.repository.frameworks.join(', ')}`,
        `📊 Scale: ${contextResult.repository.scale} (${contextResult.repository.complexity})`,
        `⚡ Analysis time: ${contextResult.analysisTime.toFixed(2)}ms`
      ];

      await this.splitScreen.updateStreamingRegion(contextInfo);

      this.emit('context_updated', contextResult);

    } catch (error) {
      const fallbackContext = this.contextManager.getFallbackContext(directoryPath);
      this.emit('context_updated', fallbackContext);
    }
  }

  /**
   * Render current interface state
   */
  private async render(): Promise<void> {
    const streamingContent = await this.splitScreen.getStreamingContent();
    
    await this.splitScreen.render({
      streaming: streamingContent,
      approval: this.currentApprovalState || {
        tasks: [],
        selectedIndex: -1,
        modified: false,
        approved: false
      },
      input: this.inputState
    });
  }

  /**
   * Stop the enhanced UX interface
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    try {
      this.isActive = false;

      // Stop watching directories
      await this.contextManager.stopWatching(this.currentDirectory);

      // Clear screen and restore cursor
      process.stdout.write('\x1B[2J\x1B[0f');
      process.stdout.write('\x1B[?25h'); // Show cursor

      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping enhanced UX:', error);
    }
  }

  /**
   * Setup exit protection
   */
  private setupExitProtection(): void {
    const handleExit = async (signal: NodeJS.Signals) => {
      if (!this.isActive) {
        process.exit(0);
      }

      console.log(`\n⚠️ Received ${signal}. Enhanced UX session active.`);
      console.log('Press Ctrl+C again within 5 seconds to force exit, or wait to continue...');

      const timeout = setTimeout(async () => {
        console.log('✅ Continuing session...');
      }, 5000);

      // Set up second Ctrl+C handler
      const forceExit = () => {
        clearTimeout(timeout);
        console.log('\n🛑 Force exit requested. Cleaning up...');
        this.stop().finally(() => process.exit(0));
      };

      process.once('SIGINT', forceExit);
      process.once('SIGTERM', forceExit);

      // Remove force exit handler after timeout
      setTimeout(() => {
        process.removeListener('SIGINT', forceExit);
        process.removeListener('SIGTERM', forceExit);
      }, 5000);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): Record<string, PerformanceMetrics> {
    return {
      splitScreen: this.splitScreen.getPerformanceMetrics(),
      contextManager: this.contextManager.getPerformanceMetrics(),
      workflowHandler: this.workflowHandler.getPerformanceMetrics()
    };
  }

  /**
   * Change working directory and update context
   */
  async changeDirectory(directoryPath: string): Promise<void> {
    const oldDirectory = this.currentDirectory;
    
    try {
      // Stop watching old directory
      if (this.config.features.enableContextCaching) {
        await this.contextManager.stopWatching(oldDirectory);
      }

      this.currentDirectory = directoryPath;
      
      // Start watching new directory and update context
      if (this.config.features.enableContextCaching) {
        await this.contextManager.watchDirectory(directoryPath);
      }
      
      await this.updateRepositoryContext(directoryPath);

    } catch (error) {
      // Revert on error
      this.currentDirectory = oldDirectory;
      throw error;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      currentDirectory: this.currentDirectory,
      hasApprovalState: !!this.currentApprovalState,
      inputText: this.inputState.text
    };
  }
}