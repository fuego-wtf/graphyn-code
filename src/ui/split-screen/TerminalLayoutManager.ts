/**
 * REV-071: Terminal Layout Management System
 * 
 * Manages precise terminal layout calculations for the split-screen interface
 * with support for responsive design and terminal resize handling.
 */

import { EventEmitter } from 'events';

export interface LayoutConfiguration {
  outputPanel: PanelConfiguration;
  approvalPanel: PanelConfiguration;
  inputPanel: PanelConfiguration;
  totalHeight: number;
  totalWidth: number;
}

export interface PanelConfiguration {
  startRow: number;
  endRow: number;
  height: number;
  width: number;
  startCol?: number;
  endCol?: number;
}

export interface LayoutMode {
  mode: 'compact' | 'standard' | 'wide';
  breakpoints: {
    minWidth: number;
    maxWidth?: number;
  };
  proportions: {
    output: number;
    approval: number;
    input: number;
  };
}

export class TerminalLayoutManager extends EventEmitter {
  private terminalHeight: number;
  private terminalWidth: number;
  private currentLayout?: LayoutConfiguration;
  
  // Layout modes for different terminal sizes
  private readonly layoutModes: LayoutMode[] = [
    {
      mode: 'compact',
      breakpoints: { minWidth: 0, maxWidth: 79 },
      proportions: { output: 0.60, approval: 0.25, input: 0.15 }
    },
    {
      mode: 'standard',
      breakpoints: { minWidth: 80, maxWidth: 119 },
      proportions: { output: 0.70, approval: 0.20, input: 0.10 }
    },
    {
      mode: 'wide',
      breakpoints: { minWidth: 120 },
      proportions: { output: 0.70, approval: 0.20, input: 0.10 }
    }
  ];

  constructor() {
    super();
    
    // Get initial terminal dimensions
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;
    
    // Listen for terminal resize events
    this.setupResizeHandling();
    
    // Calculate initial layout
    this.recalculateLayout();
  }

  /**
   * Setup terminal resize event handling
   */
  private setupResizeHandling(): void {
    process.stdout.on('resize', () => {
      this.updateTerminalDimensions();
      this.recalculateLayout();
      this.emit('layoutChanged', this.currentLayout);
    });
  }

  /**
   * Update terminal dimensions from current process state
   */
  private updateTerminalDimensions(): void {
    const oldHeight = this.terminalHeight;
    const oldWidth = this.terminalWidth;
    
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;
    
    if (oldHeight !== this.terminalHeight || oldWidth !== this.terminalWidth) {
      this.emit('dimensionsChanged', {
        oldDimensions: { height: oldHeight, width: oldWidth },
        newDimensions: { height: this.terminalHeight, width: this.terminalWidth }
      });
    }
  }

  /**
   * Calculate layout configuration based on current terminal dimensions
   */
  calculateLayout(): LayoutConfiguration {
    const reservedLines = 2; // Status bars and borders
    const usableHeight = Math.max(10, this.terminalHeight - reservedLines);
    const usableWidth = this.terminalWidth;
    
    // Determine layout mode based on width
    const layoutMode = this.getLayoutModeForWidth(usableWidth);
    const proportions = layoutMode.proportions;
    
    // Calculate panel heights
    const outputHeight = Math.max(3, Math.floor(usableHeight * proportions.output));
    const approvalHeight = Math.max(2, Math.floor(usableHeight * proportions.approval));
    const inputHeight = Math.max(1, Math.floor(usableHeight * proportions.input));
    
    // Adjust for any rounding differences
    const totalAllocated = outputHeight + approvalHeight + inputHeight;
    const adjustment = usableHeight - totalAllocated;
    const adjustedOutputHeight = outputHeight + adjustment;
    
    const layout: LayoutConfiguration = {
      outputPanel: {
        startRow: 1,
        endRow: adjustedOutputHeight,
        height: adjustedOutputHeight,
        width: usableWidth,
        startCol: 1,
        endCol: usableWidth
      },
      approvalPanel: {
        startRow: adjustedOutputHeight + 1,
        endRow: adjustedOutputHeight + approvalHeight,
        height: approvalHeight,
        width: usableWidth,
        startCol: 1,
        endCol: usableWidth
      },
      inputPanel: {
        startRow: adjustedOutputHeight + approvalHeight + 1,
        endRow: usableHeight,
        height: inputHeight,
        width: usableWidth,
        startCol: 1,
        endCol: usableWidth
      },
      totalHeight: usableHeight,
      totalWidth: usableWidth
    };

    return layout;
  }

  /**
   * Recalculate and update the current layout
   */
  recalculateLayout(): void {
    this.currentLayout = this.calculateLayout();
  }

  /**
   * Get the current layout configuration
   */
  getCurrentLayout(): LayoutConfiguration {
    if (!this.currentLayout) {
      this.recalculateLayout();
    }
    return this.currentLayout!;
  }

  /**
   * Get layout mode for given terminal width
   */
  private getLayoutModeForWidth(width: number): LayoutMode {
    for (const mode of this.layoutModes) {
      if (width >= mode.breakpoints.minWidth && 
          (!mode.breakpoints.maxWidth || width <= mode.breakpoints.maxWidth)) {
        return mode;
      }
    }
    
    // Fallback to standard mode
    return this.layoutModes.find(m => m.mode === 'standard')!;
  }

  /**
   * Get current layout mode name
   */
  getCurrentLayoutMode(): string {
    const mode = this.getLayoutModeForWidth(this.terminalWidth);
    return mode.mode;
  }

  /**
   * Check if terminal dimensions are valid for split-screen interface
   */
  isValidForSplitScreen(): boolean {
    const minHeight = 10; // Minimum height for functional interface
    const minWidth = 40;  // Minimum width for functional interface
    
    return this.terminalHeight >= minHeight && this.terminalWidth >= minWidth;
  }

  /**
   * Get minimum dimensions required for split-screen interface
   */
  getMinimumDimensions(): { height: number; width: number } {
    return { height: 10, width: 40 };
  }

  /**
   * Get current terminal dimensions
   */
  getTerminalDimensions(): { height: number; width: number } {
    return { height: this.terminalHeight, width: this.terminalWidth };
  }

  /**
   * Calculate panel positions for horizontal split (wide mode)
   */
  calculateWideLayout(): LayoutConfiguration {
    const reservedLines = 2;
    const usableHeight = Math.max(10, this.terminalHeight - reservedLines);
    const usableWidth = this.terminalWidth;
    
    // In wide mode, create side panels
    const leftPanelWidth = Math.floor(usableWidth * 0.5);
    const rightPanelWidth = Math.floor(usableWidth * 0.25);
    const farRightPanelWidth = usableWidth - leftPanelWidth - rightPanelWidth;
    
    // Output takes left 50%, agent status takes 25%, logs take 25%
    // Input and approval are combined at bottom
    const inputApprovalHeight = Math.max(3, Math.floor(usableHeight * 0.25));
    const contentHeight = usableHeight - inputApprovalHeight;

    return {
      outputPanel: {
        startRow: 1,
        endRow: contentHeight,
        height: contentHeight,
        width: leftPanelWidth,
        startCol: 1,
        endCol: leftPanelWidth
      },
      approvalPanel: {
        startRow: contentHeight + 1,
        endRow: usableHeight,
        height: inputApprovalHeight,
        width: usableWidth,
        startCol: 1,
        endCol: usableWidth
      },
      inputPanel: {
        startRow: contentHeight + 1,
        endRow: usableHeight,
        height: inputApprovalHeight,
        width: usableWidth,
        startCol: 1,
        endCol: usableWidth
      },
      totalHeight: usableHeight,
      totalWidth: usableWidth
    };
  }

  /**
   * Force a specific layout mode (useful for testing)
   */
  setLayoutMode(mode: 'compact' | 'standard' | 'wide'): void {
    const layoutMode = this.layoutModes.find(m => m.mode === mode);
    if (layoutMode) {
      // Temporarily override the layout calculation
      const proportions = layoutMode.proportions;
      const reservedLines = 2;
      const usableHeight = Math.max(10, this.terminalHeight - reservedLines);
      
      const outputHeight = Math.max(3, Math.floor(usableHeight * proportions.output));
      const approvalHeight = Math.max(2, Math.floor(usableHeight * proportions.approval));
      const inputHeight = Math.max(1, Math.floor(usableHeight * proportions.input));
      
      this.currentLayout = {
        outputPanel: {
          startRow: 1,
          endRow: outputHeight,
          height: outputHeight,
          width: this.terminalWidth,
          startCol: 1,
          endCol: this.terminalWidth
        },
        approvalPanel: {
          startRow: outputHeight + 1,
          endRow: outputHeight + approvalHeight,
          height: approvalHeight,
          width: this.terminalWidth,
          startCol: 1,
          endCol: this.terminalWidth
        },
        inputPanel: {
          startRow: outputHeight + approvalHeight + 1,
          endRow: usableHeight,
          height: inputHeight,
          width: this.terminalWidth,
          startCol: 1,
          endCol: this.terminalWidth
        },
        totalHeight: usableHeight,
        totalWidth: this.terminalWidth
      };
      
      this.emit('layoutForced', { mode, layout: this.currentLayout });
    }
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    process.stdout.removeAllListeners('resize');
    this.removeAllListeners();
  }
}