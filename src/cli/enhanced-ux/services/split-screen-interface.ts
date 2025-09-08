/**
 * SplitScreenInterface Service
 * 
 * Manages the split-screen terminal layout with 70% streaming output,
 * 20% approval workflow, and 10% persistent input areas.
 */

import { EventEmitter } from 'events';
import type {
  TerminalDimensions,
  LayoutRegions,
  RegionBounds,
  EnhancedUXConfig,
  PerformanceMetrics,
  ApprovalState,
  InputState
} from '../types.js';

export class SplitScreenInterface extends EventEmitter {
  private dimensions: TerminalDimensions;
  private config: EnhancedUXConfig;
  private regions: LayoutRegions;
  private streamingContent: string[] = [];
  private approvalState: ApprovalState | null = null;
  private inputState: InputState = {
    text: '',
    cursorPosition: 0,
    history: [],
    historyIndex: -1
  };
  private performanceMetrics: PerformanceMetrics = {
    renderTime: 0,
    analysisTime: 0,
    inputResponseTime: 0,
    memoryUsage: 0
  };

  constructor(config: EnhancedUXConfig) {
    super();
    this.config = config;
    this.dimensions = { width: 120, height: 40 }; // Default dimensions
    this.regions = this.calculateLayout(this.dimensions);
  }

  /**
   * Calculate layout regions based on terminal dimensions
   */
  calculateLayout(dimensions: TerminalDimensions): LayoutRegions {
    // Apply minimum constraints
    const minWidth = 40;
    const minHeight = 10;
    const width = Math.max(dimensions.width, minWidth);
    const height = Math.max(dimensions.height, minHeight);

    // Calculate heights using configured ratios
    const streamingHeight = Math.floor(height * this.config.layout.streamingRatio);
    const approvalHeight = Math.floor(height * this.config.layout.approvalRatio);
    const inputHeight = Math.max(1, height - streamingHeight - approvalHeight); // Ensure at least 1 line

    return {
      streaming: {
        x: 0,
        y: 0,
        width: width,
        height: streamingHeight
      },
      approval: {
        x: 0,
        y: streamingHeight,
        width: width,
        height: approvalHeight
      },
      input: {
        x: 0,
        y: streamingHeight + approvalHeight,
        width: width,
        height: inputHeight
      }
    };
  }

  /**
   * Render the split-screen interface with current content
   */
  async render(content: {
    streaming: string[];
    approval: ApprovalState;
    input: InputState;
  }): Promise<void> {
    const startTime = performance.now();

    try {
      // Update internal state
      this.streamingContent = content.streaming;
      this.approvalState = content.approval;
      this.inputState = content.input;

      // Clear screen and move cursor to top
      process.stdout.write('\x1B[2J\x1B[0f');

      // Render streaming region
      await this.renderStreamingRegion();
      
      // Render approval region
      await this.renderApprovalRegion();
      
      // Render input region
      await this.renderInputRegion();

      // Update performance metrics
      const renderTime = performance.now() - startTime;
      this.performanceMetrics.renderTime = renderTime;
      this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;

      // Check performance targets
      if (renderTime > this.config.performance.maxRenderTime) {
        this.emit('performance_warning', `Render time ${renderTime.toFixed(2)}ms exceeds ${this.config.performance.maxRenderTime}ms target`);
      }

    } catch (error) {
      throw new Error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Render the streaming output region
   */
  private async renderStreamingRegion(): Promise<void> {
    const region = this.regions.streaming;
    const content = this.streamingContent;

    // Move cursor to streaming region start
    process.stdout.write(`\x1B[${region.y + 1};${region.x + 1}H`);

    // Render border
    process.stdout.write(`┌${'─'.repeat(region.width - 2)}┐\n`);

    // Render content lines (limit to region height - 2 for borders)
    const maxLines = region.height - 2;
    const displayLines = content.slice(-maxLines); // Show most recent lines

    for (let i = 0; i < maxLines; i++) {
      process.stdout.write(`\x1B[${region.y + i + 2};${region.x + 1}H`);
      const line = displayLines[i] || '';
      const truncatedLine = line.substring(0, region.width - 2);
      process.stdout.write(`│${truncatedLine.padEnd(region.width - 2)}│`);
    }

    // Bottom border
    process.stdout.write(`\x1B[${region.y + region.height};${region.x + 1}H`);
    process.stdout.write(`└${'─'.repeat(region.width - 2)}┘`);
  }

  /**
   * Render the approval workflow region
   */
  private async renderApprovalRegion(): Promise<void> {
    const region = this.regions.approval;
    const state = this.approvalState;

    // Move cursor to approval region start
    process.stdout.write(`\x1B[${region.y + 1};${region.x + 1}H`);

    // Render border with title
    const title = 'Task Approval [A]pprove [M]odify [F]ilter [C]ancel';
    const titleTruncated = title.substring(0, region.width - 4);
    process.stdout.write(`┌─${titleTruncated}${'─'.repeat(Math.max(0, region.width - titleTruncated.length - 4))}┐\n`);

    if (!state || state.tasks.length === 0) {
      // No tasks to show
      process.stdout.write(`\x1B[${region.y + 2};${region.x + 1}H`);
      process.stdout.write(`│${'No tasks pending approval'.padEnd(region.width - 2)}│`);
    } else {
      // Render tasks (limit to region height - 2 for borders)
      const maxLines = region.height - 2;
      const displayTasks = state.tasks.slice(0, maxLines);

      for (let i = 0; i < maxLines; i++) {
        process.stdout.write(`\x1B[${region.y + i + 2};${region.x + 1}H`);
        
        if (i < displayTasks.length) {
          const task = displayTasks[i];
          const isSelected = i === state.selectedIndex;
          const prefix = isSelected ? '▶ ' : '  ';
          const status = task.status === 'approved' ? '✓' : task.status === 'rejected' ? '✗' : '○';
          const taskText = `${prefix}${status} ${task.title} (${task.agent}, ${Math.round(task.estimatedTime/60)}m)`;
          const truncated = taskText.substring(0, region.width - 2);
          
          if (isSelected) {
            // Highlight selected task
            process.stdout.write(`│\x1B[7m${truncated.padEnd(region.width - 2)}\x1B[0m│`);
          } else {
            process.stdout.write(`│${truncated.padEnd(region.width - 2)}│`);
          }
        } else {
          process.stdout.write(`│${' '.repeat(region.width - 2)}│`);
        }
      }
    }

    // Bottom border
    process.stdout.write(`\x1B[${region.y + region.height};${region.x + 1}H`);
    process.stdout.write(`└${'─'.repeat(region.width - 2)}┘`);
  }

  /**
   * Render the persistent input region
   */
  private async renderInputRegion(): Promise<void> {
    const region = this.regions.input;
    const state = this.inputState;

    // Move cursor to input region start
    process.stdout.write(`\x1B[${region.y + 1};${region.x + 1}H`);

    // Render input box
    const prompt = '> ';
    const inputText = state.text;
    const maxInputWidth = region.width - prompt.length - 2;
    const displayText = inputText.length > maxInputWidth 
      ? '...' + inputText.slice(-(maxInputWidth - 3))
      : inputText;

    // Input line with border
    process.stdout.write(`┌${'─'.repeat(region.width - 2)}┐`);
    process.stdout.write(`\x1B[${region.y + 2};${region.x + 1}H`);
    process.stdout.write(`│${prompt}${displayText.padEnd(region.width - prompt.length - 2)}│`);

    // Calculate cursor position
    const cursorOffset = Math.min(state.cursorPosition, maxInputWidth);
    const cursorX = region.x + 1 + prompt.length + cursorOffset;
    const cursorY = region.y + 2;

    // Move cursor to input position
    process.stdout.write(`\x1B[${cursorY};${cursorX}H`);
  }

  /**
   * Handle terminal resize events
   */
  handleTerminalResize(newDimensions: TerminalDimensions): void {
    this.dimensions = newDimensions;
    this.regions = this.calculateLayout(newDimensions);
    this.emit('resize', this.regions);
  }

  /**
   * Update streaming region content
   */
  async updateStreamingRegion(content: string[]): Promise<void> {
    this.streamingContent = content;
    // Re-render just the streaming region
    await this.renderStreamingRegion();
  }

  /**
   * Update approval region state
   */
  async updateApprovalRegion(state: ApprovalState): Promise<void> {
    this.approvalState = state;
    // Re-render just the approval region
    await this.renderApprovalRegion();
  }

  /**
   * Update input region state
   */
  async updateInputRegion(state: InputState): Promise<void> {
    this.inputState = state;
    // Re-render just the input region
    await this.renderInputRegion();
  }

  /**
   * Get current streaming content
   */
  getStreamingContent(): string[] {
    return [...this.streamingContent];
  }

  /**
   * Get current approval state
   */
  getApprovalState(): ApprovalState | null {
    return this.approvalState ? { ...this.approvalState } : null;
  }

  /**
   * Get current input state
   */
  getInputState(): InputState {
    return { ...this.inputState };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Simulate slow render for testing
   */
  async simulateSlowRender(delayMs: number): Promise<void> {
    const startTime = performance.now();
    await new Promise(resolve => setTimeout(resolve, delayMs));
    const renderTime = performance.now() - startTime;
    
    if (renderTime > this.config.performance.maxRenderTime) {
      this.emit('performance_warning', `Simulated render time ${renderTime.toFixed(2)}ms exceeds target`);
    }
  }
}