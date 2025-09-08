/**
 * Interactive Orchestrator - Split-Screen Experience
 * 
 * Provides a split-screen terminal experience with:
 * - Streaming Claude responses in top section
 * - Persistent text input at bottom
 * - Non-blocking input during execution
 * - Real-time status indicators
 */

import { EventEmitter } from 'events';
import * as readline from 'readline';
import { RealTimeExecutor } from './RealTimeExecutor.js';
import { StreamingConsoleOutput } from '../console/StreamingConsoleOutput.js';
import { ContinuousInput } from '../console/ContinuousInput.js';

export interface InteractiveSession {
  id: string;
  startTime: number;
  queryCount: number;
  totalTokens: number;
  isActive: boolean;
}

export class InteractiveOrchestrator extends EventEmitter {
  private realTimeExecutor: RealTimeExecutor;
  private streamingOutput: StreamingConsoleOutput;
  private continuousInput: ContinuousInput;
  private currentSession?: InteractiveSession;
  private isExecuting = false;
  private inputQueue: string[] = [];
  private terminalHeight: number;
  private outputLines: string[] = [];
  private statusIndicators = new Map<string, string>();

  constructor() {
    super();
    this.realTimeExecutor = new RealTimeExecutor();
    this.streamingOutput = new StreamingConsoleOutput();
    this.continuousInput = new ContinuousInput({
      prompt: 'graphyn> ',
      enableHistory: true,
      enableCompletion: true,
      maxHistorySize: 100
    });
    this.terminalHeight = process.stdout.rows || 24;

    // Listen for terminal resize
    process.stdout.on('resize', () => {
      this.terminalHeight = process.stdout.rows || 24;
      this.redrawInterface();
    });

    // Set up input completions
    this.setupCompletions();
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.realTimeExecutor.initialize();
    this.setupInputHandler();
    this.createSession();
  }

  /**
   * Set up input completions
   */
  private setupCompletions(): void {
    const completions = [
      // Common commands
      'help', 'exit', 'quit', 'clear', 'status',
      // Agent types
      'backend', 'frontend', 'architect', 'designer', 'tester',
      // Common queries
      'build', 'create', 'implement', 'fix', 'update', 'analyze',
      'test', 'deploy', 'review', 'explain', 'optimize',
      // Project types
      'API', 'database', 'component', 'service', 'endpoint',
      'authentication', 'authorization', 'middleware', 'validation'
    ];
    
    this.continuousInput.setCompletions(completions);
  }

  /**
   * Start interactive orchestration experience
   */
  async startInteractive(): Promise<void> {
    this.clearScreen();
    this.showWelcomeScreen();
    this.redrawInterface();
    
    // Start continuous input
    await this.continuousInput.startContinuousInput();
    
    // Process input queue continuously
    this.processInputQueue();
    
    return new Promise((resolve) => {
      // Keep session alive until explicitly closed
      this.on('sessionEnded', resolve);
    });
  }

  /**
   * Setup persistent input handler with continuous input
   */
  private setupInputHandler(): void {
    this.continuousInput.on('input', (event) => {
      const input = event.data.text.trim();
      
      if (input === 'exit' || input === 'quit') {
        this.endSession();
        return;
      }

      if (input === 'clear') {
        this.clearOutput();
        return;
      }

      if (input === 'status') {
        this.showSessionStatus();
        return;
      }

      if (input) {
        this.inputQueue.push(input);
        this.addOutputLine(`🚀 Queued: "${input}"`);
        this.updateStatusIndicator('queue', `${this.inputQueue.length} pending`);
        this.redrawInterface();
      }
    });

    this.continuousInput.on('interrupt', () => {
      this.endSession();
    });
  }

  /**
   * Process queued input continuously
   */
  private async processInputQueue(): Promise<void> {
    while (this.currentSession?.isActive) {
      if (this.inputQueue.length > 0 && !this.isExecuting) {
        const query = this.inputQueue.shift()!;
        if (this.currentSession) {
          this.currentSession.queryCount++;
        }
        this.updateStatusIndicator('executing', query);
        await this.executeQuery(query);
        this.updateStatusIndicator('queue', `${this.inputQueue.length} pending`);
      }
      
      // Small delay to prevent busy loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Execute query with real-time streaming
   */
  private async executeQuery(query: string): Promise<void> {
    this.isExecuting = true;
    this.addOutputLine(`\n${'─'.repeat(60)}`);
    this.addOutputLine(`🚀 Processing: "${query}"`);
    this.addOutputLine(`${'─'.repeat(60)}`);

    let completedTasks = 0;
    let currentAgent = '';

    try {
      // Execute with real-time streaming
      for await (const event of this.realTimeExecutor.executeQueryStream(query, {
        workingDirectory: process.cwd()
      })) {
        
        switch (event.type) {
          case 'start':
            this.addOutputLine('🔍 Starting query analysis...');
            break;
            
          case 'context':
            this.addOutputLine(`📋 ${event.data.message || 'Building context...'}`);
            break;
            
          case 'analysis':
            if (event.data.agent && event.data.confidence) {
              this.addOutputLine(`🎯 Routing to @${event.data.agent} (${event.data.confidence}% confidence)`);
              if (event.data.reasoning) {
                this.addOutputLine(`💭 Reasoning: ${event.data.reasoning.slice(0, 80)}...`);
              }
            } else {
              this.addOutputLine(`🔍 ${event.data.message}`);
            }
            break;
            
          case 'agent_start':
            currentAgent = event.data.agent;
            this.updateStatusIndicator('agent', currentAgent);
            this.addOutputLine(`\n🤖 @${currentAgent}: Starting analysis...`);
            this.addOutputLine(`${'─'.repeat(40)}`);
            break;
            
          case 'message':
            if (event.data.message) {
              const message = event.data.message;
              
              if (message.type === 'assistant') {
                // Extract and display text content
                const content = this.extractTextContent(message.message?.content);
                if (content) {
                  // Add content line by line to prevent overwhelming
                  const lines = content.split('\n');
                  lines.forEach(line => {
                    if (line.trim()) {
                      this.addOutputLine(line);
                    }
                  });
                }
              } else if (message.type === 'tool_use') {
                const toolName = message.tool?.name || 'tool';
                this.updateStatusIndicator('tool', toolName);
                this.addOutputLine(`🔧 Using ${toolName}...`);
              } else if (message.type === 'result') {
                this.updateStatusIndicator('agent', `${currentAgent} completed`);
                this.addOutputLine(`✅ @${currentAgent} completed`);
              }
            }
            break;
            
          case 'result':
            completedTasks++;
            break;
            
          case 'error':
            this.addOutputLine(`❌ Error: ${event.data.error}`);
            break;
        }

        this.redrawInterface();
      }

      // Show completion
      this.addOutputLine(`\n${'─'.repeat(60)}`);
      this.addOutputLine(`🎉 Task completed! (${completedTasks} agent${completedTasks !== 1 ? 's' : ''} used)`);
      this.addOutputLine(`${'─'.repeat(60)}\n`);

    } catch (error) {
      this.addOutputLine(`❌ Execution failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isExecuting = false;
      // Clear execution status indicators
      this.statusIndicators.delete('executing');
      this.statusIndicators.delete('agent');
      this.statusIndicators.delete('tool');
      this.redrawInterface();
    }
  }

  /**
   * Extract text content from Claude message
   */
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
    }
    
    if (content && content.type === 'text' && content.text) {
      return content.text;
    }
    
    return '';
  }

  /**
   * Add line to output buffer
   */
  private addOutputLine(line: string): void {
    this.outputLines.push(line);
    
    // Keep only recent lines to prevent memory issues
    const maxLines = this.terminalHeight * 10; // Keep 10x screen worth
    if (this.outputLines.length > maxLines) {
      this.outputLines = this.outputLines.slice(-maxLines);
    }
  }

  /**
   * Redraw the split-screen interface
   */
  private redrawInterface(): void {
    // Clear screen and move to top
    this.clearScreen();
    
    // Calculate layout
    const inputAreaHeight = 3; // Input line + border + status
    const outputAreaHeight = this.terminalHeight - inputAreaHeight - 1;
    
    // Show output area (top section)
    const visibleLines = this.outputLines.slice(-outputAreaHeight);
    visibleLines.forEach(line => {
      console.log(line);
    });
    
    // Fill remaining space if needed
    const remainingLines = outputAreaHeight - visibleLines.length;
    for (let i = 0; i < remainingLines; i++) {
      console.log('');
    }
    
    // Draw separator
    console.log('═'.repeat(process.stdout.columns || 80));
    
    // Show status line with indicators
    const status = this.getStatusLine();
    const indicators = this.getIndicatorLine();
    console.log(status);
    if (indicators) {
      console.log(indicators);
    }
  }

  /**
   * Get current status line
   */
  private getStatusLine(): string {
    if (!this.currentSession) return '';
    
    const elapsed = Math.round((Date.now() - this.currentSession.startTime) / 1000);
    const queueStatus = this.inputQueue.length > 0 ? ` | Queue: ${this.inputQueue.length}` : '';
    const execStatus = this.isExecuting ? ' | 🔄 Executing...' : ' | ✅ Ready';
    
    return `Session: ${this.currentSession.id} | Queries: ${this.currentSession.queryCount} | ${elapsed}s${queueStatus}${execStatus}`;
  }

  /**
   * Get indicator line with real-time status
   */
  private getIndicatorLine(): string {
    if (this.statusIndicators.size === 0) return '';
    
    const indicators: string[] = [];
    
    this.statusIndicators.forEach((value, key) => {
      switch (key) {
        case 'queue':
          indicators.push(`📋 ${value}`);
          break;
        case 'executing':
          indicators.push(`⚡ ${value.slice(0, 40)}${value.length > 40 ? '...' : ''}`);
          break;
        case 'agent':
          indicators.push(`🤖 ${value}`);
          break;
        case 'tool':
          indicators.push(`🔧 ${value}`);
          break;
        default:
          indicators.push(`${key}: ${value}`);
      }
    });
    
    return indicators.join(' | ');
  }

  /**
   * Update status indicator
   */
  private updateStatusIndicator(key: string, value: string): void {
    this.statusIndicators.set(key, value);
  }

  /**
   * Clear output buffer
   */
  private clearOutput(): void {
    this.outputLines = [];
    this.addOutputLine('🧹 Output cleared');
    this.redrawInterface();
  }

  /**
   * Show current session status
   */
  private showSessionStatus(): void {
    if (this.currentSession) {
      const elapsed = Math.round((Date.now() - this.currentSession.startTime) / 1000);
      this.addOutputLine(`📊 Session Status:`);
      this.addOutputLine(`   • ID: ${this.currentSession.id}`);
      this.addOutputLine(`   • Duration: ${elapsed}s`);
      this.addOutputLine(`   • Queries: ${this.currentSession.queryCount}`);
      this.addOutputLine(`   • Queue: ${this.inputQueue.length}`);
      this.addOutputLine(`   • Executing: ${this.isExecuting ? 'Yes' : 'No'}`);
      this.redrawInterface();
    }
  }

  /**
   * Clear screen
   */
  private clearScreen(): void {
    console.clear();
    process.stdout.write('\x1b[H'); // Move cursor to top
  }

  /**
   * Show welcome screen
   */
  private showWelcomeScreen(): void {
    this.addOutputLine('🎯 Graphyn Interactive Orchestrator');
    this.addOutputLine('══════════════════════════════════');
    this.addOutputLine('Real-time AI agent orchestration with continuous interaction.');
    this.addOutputLine('Type your requests below - responses will stream above.');
    this.addOutputLine('Type "exit" or Ctrl+C to quit.');
    this.addOutputLine('');
  }

  /**
   * Create new session
   */
  private createSession(): void {
    this.currentSession = {
      id: `sess-${Date.now().toString(36)}`,
      startTime: Date.now(),
      queryCount: 0,
      totalTokens: 0,
      isActive: true
    };
  }

  /**
   * End current session
   */
  private endSession(): void {
    if (this.currentSession) {
      this.currentSession.isActive = false;
    }
    
    this.addOutputLine('\n👋 Ending session...');
    this.redrawInterface();
    
    // Stop continuous input
    this.continuousInput.stopContinuousInput();
    
    this.emit('sessionEnded');
  }

  /**
   * Get session stats
   */
  getSessionStats(): InteractiveSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.endSession();
    await this.realTimeExecutor.cleanup();
  }
}