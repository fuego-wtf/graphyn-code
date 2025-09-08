/**
 * REV-071: Streaming Output Panel - Top Panel (70% of screen)
 * 
 * Manages the main content display area for agent responses, 
 * task decomposition, and real-time streaming content.
 */

import { EventEmitter } from 'events';
import { ANSIController } from './ANSIController.js';
import { PanelConfiguration } from './TerminalLayoutManager.js';

export interface StreamContent {
  id: string;
  source: string;  // Agent name or system
  content: string;
  timestamp: Date;
  type: 'text' | 'progress' | 'error' | 'warning' | 'success' | 'task_decomposition';
  metadata?: any;
}

export interface AgentStatus {
  name: string;
  status: 'idle' | 'thinking' | 'executing' | 'completed' | 'error';
  currentTask?: string;
  progress?: number;
  eta?: number; // Estimated time remaining in seconds
}

export class StreamingOutputPanel extends EventEmitter {
  private panelConfig: PanelConfiguration;
  private contentBuffer: StreamContent[] = [];
  private maxBufferSize: number = 1000;
  private scrollPosition: number = 0;
  private autoScroll: boolean = true;
  
  // Display state
  private lastRenderedContent: string = '';
  private agentStatuses = new Map<string, AgentStatus>();
  
  // Animation state
  private spinnerFrame: number = 0;
  private animationTimer?: NodeJS.Timeout;

  constructor(panelConfig: PanelConfiguration) {
    super();
    this.panelConfig = panelConfig;
  }

  /**
   * Update panel configuration (e.g., after terminal resize)
   */
  updatePanelConfig(config: PanelConfiguration): void {
    this.panelConfig = config;
    this.render();
  }

  /**
   * Add content to the streaming output
   */
  addContent(content: StreamContent): void {
    this.contentBuffer.push(content);
    
    // Maintain buffer size
    if (this.contentBuffer.length > this.maxBufferSize) {
      this.contentBuffer = this.contentBuffer.slice(-this.maxBufferSize);
    }
    
    // Auto-scroll to bottom if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    this.render();
    this.emit('contentAdded', content);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName: string, status: AgentStatus): void {
    this.agentStatuses.set(agentName, status);
    this.render();
    this.emit('agentStatusChanged', { agentName, status });
  }

  /**
   * Clear all content
   */
  clearContent(): void {
    this.contentBuffer = [];
    this.scrollPosition = 0;
    this.render();
    this.emit('contentCleared');
  }

  /**
   * Scroll content up/down
   */
  scroll(direction: 'up' | 'down', lines: number = 1): void {
    const maxScroll = Math.max(0, this.contentBuffer.length - this.getContentDisplayHeight());
    
    if (direction === 'up') {
      this.scrollPosition = Math.min(maxScroll, this.scrollPosition + lines);
      this.autoScroll = false;
    } else {
      this.scrollPosition = Math.max(0, this.scrollPosition - lines);
      
      // Re-enable auto-scroll if scrolled to bottom
      if (this.scrollPosition === 0) {
        this.autoScroll = true;
      }
    }
    
    this.render();
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom(): void {
    this.scrollPosition = 0;
    this.autoScroll = true;
  }

  /**
   * Start animation timer for spinners and progress indicators
   */
  startAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
    }
    
    this.animationTimer = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % 10;
      
      // Only re-render if we have active agents
      const hasActiveAgents = Array.from(this.agentStatuses.values())
        .some(status => status.status === 'thinking' || status.status === 'executing');
      
      if (hasActiveAgents) {
        this.renderAgentStatusBar();
      }
    }, 150); // Update spinner every 150ms
  }

  /**
   * Stop animation timer
   */
  stopAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = undefined;
    }
  }

  /**
   * Main render method
   */
  render(): void {
    let output = '';
    
    // Clear the panel area
    output += this.clearPanelArea();
    
    // Render border
    output += this.renderBorder();
    
    // Render agent status bar
    output += this.renderAgentStatusBar();
    
    // Render content
    output += this.renderContent();
    
    // Render scroll indicator if needed
    output += this.renderScrollIndicator();
    
    // Write to stdout
    process.stdout.write(output);
    
    this.lastRenderedContent = output;
  }

  /**
   * Clear the panel area
   */
  private clearPanelArea(): string {
    return ANSIController.clearRegion(
      this.panelConfig.startRow,
      this.panelConfig.endRow,
      this.panelConfig.startCol,
      this.panelConfig.endCol
    );
  }

  /**
   * Render panel border
   */
  private renderBorder(): string {
    return ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      '🎯 Streaming Output'
    );
  }

  /**
   * Render agent status bar
   */
  private renderAgentStatusBar(): string {
    let output = '';
    const statusBarRow = this.panelConfig.startRow + 1;
    const statusBarWidth = this.panelConfig.width - 4; // Account for borders
    
    output += ANSIController.moveCursor(statusBarRow, this.panelConfig.startCol! + 2);
    
    if (this.agentStatuses.size === 0) {
      output += ANSIController.positionText(
        ANSIController.color('No active agents', { foreground: 'gray' }),
        statusBarWidth,
        'left'
      );
    } else {
      // Create status indicators for each agent
      const statusIndicators: string[] = [];
      
      this.agentStatuses.forEach((status, agentName) => {
        let indicator = '';
        let color: any = {};
        
        switch (status.status) {
          case 'idle':
            indicator = '💤';
            color = { foreground: 'gray' };
            break;
          case 'thinking':
            indicator = ANSIController.createSpinnerFrame(this.spinnerFrame);
            color = { foreground: 'yellow' };
            break;
          case 'executing':
            indicator = '⚡';
            color = { foreground: 'green' };
            break;
          case 'completed':
            indicator = '✅';
            color = { foreground: 'green' };
            break;
          case 'error':
            indicator = '❌';
            color = { foreground: 'red' };
            break;
        }
        
        const agentDisplay = `${indicator} @${agentName}`;
        const coloredAgent = ANSIController.color(agentDisplay, color);
        
        // Add progress if available
        if (status.progress !== undefined) {
          const progressBar = ANSIController.createProgressBar(status.progress, 10, '█', '▓', false);
          statusIndicators.push(`${coloredAgent} ${progressBar}`);
        } else {
          statusIndicators.push(coloredAgent);
        }
      });
      
      // Join and truncate if necessary
      const statusText = statusIndicators.join(' │ ');
      output += ANSIController.positionText(statusText, statusBarWidth, 'left');
    }
    
    return output;
  }

  /**
   * Render main content area
   */
  private renderContent(): string {
    let output = '';
    const contentStartRow = this.panelConfig.startRow + 3; // Account for border and status bar
    const contentHeight = this.getContentDisplayHeight();
    const contentWidth = this.panelConfig.width - 4; // Account for borders
    
    // Get visible content based on scroll position
    const visibleContent = this.getVisibleContent(contentHeight);
    
    visibleContent.forEach((content, index) => {
      const row = contentStartRow + index;
      if (row >= this.panelConfig.endRow - 1) return; // Don't overwrite bottom border
      
      output += ANSIController.moveCursor(row, this.panelConfig.startCol! + 2);
      output += this.formatContentLine(content, contentWidth);
    });
    
    return output;
  }

  /**
   * Render scroll indicator
   */
  private renderScrollIndicator(): string {
    if (this.contentBuffer.length <= this.getContentDisplayHeight()) {
      return ''; // No scroll indicator needed
    }
    
    let output = '';
    const indicatorCol = this.panelConfig.endCol! - 1;
    const indicatorHeight = Math.max(3, this.panelConfig.height - 4);
    
    // Calculate scroll thumb position and size
    const totalContent = this.contentBuffer.length;
    const visibleContent = this.getContentDisplayHeight();
    const scrollRatio = this.scrollPosition / Math.max(1, totalContent - visibleContent);
    
    const thumbSize = Math.max(1, Math.floor((visibleContent / totalContent) * indicatorHeight));
    const thumbPosition = Math.floor(scrollRatio * (indicatorHeight - thumbSize));
    
    for (let i = 0; i < indicatorHeight; i++) {
      const row = this.panelConfig.startRow + 2 + i;
      output += ANSIController.moveCursor(row, indicatorCol);
      
      if (i >= thumbPosition && i < thumbPosition + thumbSize) {
        output += ANSIController.color('█', { foreground: 'blue' });
      } else {
        output += ANSIController.color('▓', { foreground: 'gray' });
      }
    }
    
    return output;
  }

  /**
   * Get visible content based on scroll position
   */
  private getVisibleContent(maxLines: number): StreamContent[] {
    if (this.contentBuffer.length === 0) {
      return [];
    }
    
    // Calculate start index based on scroll position
    const startIndex = Math.max(0, this.contentBuffer.length - maxLines - this.scrollPosition);
    const endIndex = Math.min(this.contentBuffer.length, startIndex + maxLines);
    
    return this.contentBuffer.slice(startIndex, endIndex);
  }

  /**
   * Format a single content line for display
   */
  private formatContentLine(content: StreamContent, maxWidth: number): string {
    const timestamp = content.timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    // Get type indicator
    let typeIndicator = '';
    let typeColor: any = {};
    
    switch (content.type) {
      case 'text':
        typeIndicator = '💬';
        typeColor = { foreground: 'white' };
        break;
      case 'progress':
        typeIndicator = '📊';
        typeColor = { foreground: 'blue' };
        break;
      case 'error':
        typeIndicator = '❌';
        typeColor = { foreground: 'red' };
        break;
      case 'warning':
        typeIndicator = '⚠️ ';
        typeColor = { foreground: 'yellow' };
        break;
      case 'success':
        typeIndicator = '✅';
        typeColor = { foreground: 'green' };
        break;
      case 'task_decomposition':
        typeIndicator = '📋';
        typeColor = { foreground: 'cyan' };
        break;
    }
    
    // Format: [timestamp] indicator @source: content
    const prefix = `[${timestamp}] ${typeIndicator} @${content.source}: `;
    const availableWidth = maxWidth - ANSIController.stripAnsi(prefix).length;
    
    let displayContent = content.content;
    if (displayContent.length > availableWidth) {
      displayContent = displayContent.substring(0, availableWidth - 3) + '...';
    }
    
    const coloredPrefix = ANSIController.color(prefix, typeColor);
    return coloredPrefix + displayContent;
  }

  /**
   * Get available height for content display
   */
  private getContentDisplayHeight(): number {
    // Total height minus border (2) and status bar (1)
    return Math.max(1, this.panelConfig.height - 3);
  }

  /**
   * Enable/disable auto-scroll
   */
  setAutoScroll(enabled: boolean): void {
    this.autoScroll = enabled;
    if (enabled) {
      this.scrollToBottom();
      this.render();
    }
  }

  /**
   * Get current auto-scroll state
   */
  isAutoScrollEnabled(): boolean {
    return this.autoScroll;
  }

  /**
   * Get content buffer statistics
   */
  getStats() {
    return {
      totalContent: this.contentBuffer.length,
      scrollPosition: this.scrollPosition,
      autoScroll: this.autoScroll,
      activeAgents: Array.from(this.agentStatuses.entries()).filter(([, status]) => 
        status.status === 'thinking' || status.status === 'executing'
      ).length
    };
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.stopAnimation();
    this.contentBuffer = [];
    this.agentStatuses.clear();
    this.removeAllListeners();
  }
}