/**
 * Progress Bar Component for Graphyn CLI
 * 
 * Provides various progress visualization styles for different use cases:
 * - Task completion progress
 * - Agent execution progress  
 * - File processing progress
 * - Multi-step workflow progress
 */

import { ANSI, COLORS, SYMBOLS } from './ansi-codes.js';

export interface ProgressBarOptions {
  /**
   * Total value for 100% completion
   * @default 100
   */
  total?: number;
  
  /**
   * Width of the progress bar in characters
   * @default 40
   */
  width?: number;
  
  /**
   * Style of the progress bar
   * @default 'blocks'
   */
  style?: 'blocks' | 'ascii' | 'dots' | 'gradient';
  
  /**
   * Show percentage text
   * @default true
   */
  showPercentage?: boolean;
  
  /**
   * Show current/total counts
   * @default false
   */
  showCounts?: boolean;
  
  /**
   * Show completion time estimate
   * @default false
   */
  showETA?: boolean;
  
  /**
   * Color scheme
   * @default 'auto'
   */
  color?: 'auto' | 'green' | 'blue' | 'yellow' | 'red' | 'none';
  
  /**
   * Prefix text before the progress bar
   */
  prefix?: string;
  
  /**
   * Suffix text after the progress bar
   */
  suffix?: string;
}

export class ProgressBar {
  private current = 0;
  private readonly total: number;
  private readonly width: number;
  private readonly style: string;
  private readonly showPercentage: boolean;
  private readonly showCounts: boolean;
  private readonly showETA: boolean;
  private readonly color: string;
  private readonly prefix: string;
  private readonly suffix: string;
  private readonly isInteractive: boolean;
  
  private startTime: number = Date.now();
  private lastUpdateTime: number = 0;
  private readonly throttleMs = 100; // 10fps max update rate

  constructor(options: ProgressBarOptions = {}) {
    this.total = options.total ?? 100;
    this.width = options.width ?? 40;
    this.style = options.style ?? 'blocks';
    this.showPercentage = options.showPercentage ?? true;
    this.showCounts = options.showCounts ?? false;
    this.showETA = options.showETA ?? false;
    this.color = options.color ?? 'auto';
    this.prefix = options.prefix ?? '';
    this.suffix = options.suffix ?? '';
    this.isInteractive = process.stdout.isTTY && process.env.CI !== 'true';
  }

  /**
   * Update progress to a specific value
   */
  update(current: number, message?: string): void {
    // Throttle updates for performance
    const now = Date.now();
    if (now - this.lastUpdateTime < this.throttleMs) {
      return;
    }
    this.lastUpdateTime = now;

    this.current = Math.min(Math.max(current, 0), this.total);
    
    if (this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${this.render(message)}`);
    } else {
      // Non-interactive: only log at specific milestones
      const percentage = (this.current / this.total) * 100;
      const milestone = Math.floor(percentage / 10) * 10; // Every 10%
      
      if (milestone > 0 && milestone % 10 === 0) {
        const key = `progress_${milestone}`;
        if (!this.hasLoggedMilestone(key)) {
          process.stdout.write(`Progress: ${milestone}% complete\n`);
        }
      }
    }
  }

  private milestoneCache = new Set<string>();
  private hasLoggedMilestone(key: string): boolean {
    if (this.milestoneCache.has(key)) {
      return true;
    }
    this.milestoneCache.add(key);
    return false;
  }

  /**
   * Increment progress by a specific amount
   */
  increment(amount = 1, message?: string): void {
    this.update(this.current + amount, message);
  }

  /**
   * Complete the progress bar
   */
  complete(message?: string): void {
    this.current = this.total;
    const completedBar = this.render(message);
    
    if (this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${completedBar}\n`);
    } else {
      process.stdout.write(`${message || 'Complete!'}\n`);
    }
  }

  /**
   * Fail the progress bar with error message
   */
  fail(errorMessage: string): void {
    const failedBar = this.renderFailed(errorMessage);
    
    if (this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${failedBar}\n`);
    } else {
      process.stdout.write(`Failed: ${errorMessage}\n`);
    }
  }

  /**
   * Get current progress percentage
   */
  getPercentage(): number {
    return (this.current / this.total) * 100;
  }

  /**
   * Get current progress value
   */
  getCurrent(): number {
    return this.current;
  }

  /**
   * Get total value
   */
  getTotal(): number {
    return this.total;
  }

  /**
   * Check if progress is complete
   */
  isComplete(): boolean {
    return this.current >= this.total;
  }

  /**
   * Render the progress bar as a string
   */
  private render(message?: string): string {
    const percentage = (this.current / this.total);
    const filled = Math.floor(percentage * this.width);
    const empty = this.width - filled;
    
    const bar = this.renderBar(filled, empty, percentage);
    const percentText = this.showPercentage ? ` ${Math.round(percentage * 100)}%` : '';
    const countText = this.showCounts ? ` (${this.current}/${this.total})` : '';
    const etaText = this.showETA ? ` ${this.getETAText()}` : '';
    const messageText = message ? ` ${message}` : '';
    
    let result = '';
    if (this.prefix) result += `${this.prefix} `;
    result += `[${bar}]${percentText}${countText}${etaText}`;
    if (this.suffix) result += ` ${this.suffix}`;
    if (messageText) result += messageText;
    
    return this.applyColor(result);
  }

  /**
   * Render failed progress bar
   */
  private renderFailed(errorMessage: string): string {
    const failedBar = SYMBOLS.ERROR.repeat(Math.min(this.width, errorMessage.length));
    const padded = failedBar.padEnd(this.width, ' ');
    
    let result = `[${padded}] ${SYMBOLS.ERROR} ${errorMessage}`;
    if (this.prefix) result = `${this.prefix} ${result}`;
    
    return `${COLORS.ERROR}${result}${ANSI.RESET}`;
  }

  /**
   * Render the actual progress bar based on style
   */
  private renderBar(filled: number, empty: number, percentage: number): string {
    switch (this.style) {
      case 'blocks':
        return SYMBOLS.PROGRESS_FULL.repeat(filled) + SYMBOLS.PROGRESS_EMPTY.repeat(empty);
        
      case 'ascii':
        return '='.repeat(filled) + '-'.repeat(empty);
        
      case 'dots':
        return '●'.repeat(filled) + '○'.repeat(empty);
        
      case 'gradient':
        return this.renderGradientBar(filled, empty, percentage);
        
      default:
        return SYMBOLS.PROGRESS_FULL.repeat(filled) + SYMBOLS.PROGRESS_EMPTY.repeat(empty);
    }
  }

  /**
   * Render gradient-style progress bar
   */
  private renderGradientBar(filled: number, empty: number, percentage: number): string {
    if (!this.isInteractive) {
      // Fallback to blocks for non-interactive
      return SYMBOLS.PROGRESS_FULL.repeat(filled) + SYMBOLS.PROGRESS_EMPTY.repeat(empty);
    }
    
    // Use different characters for gradient effect
    const chars = ['░', '▒', '▓', '█'];
    const result: string[] = [];
    
    for (let i = 0; i < this.width; i++) {
      const pos = i / this.width;
      if (pos <= percentage) {
        const intensity = Math.min(Math.floor((pos / percentage) * chars.length), chars.length - 1);
        result.push(chars[intensity]);
      } else {
        result.push(chars[0]);
      }
    }
    
    return result.join('');
  }

  /**
   * Apply color scheme to the progress bar
   */
  private applyColor(text: string): string {
    if (!this.isInteractive || this.color === 'none') {
      return text;
    }
    
    let colorCode: string;
    
    switch (this.color) {
      case 'auto':
        // Auto-select based on progress
        const percentage = (this.current / this.total) * 100;
        if (percentage < 30) colorCode = COLORS.ERROR;
        else if (percentage < 70) colorCode = COLORS.WARNING;
        else colorCode = COLORS.SUCCESS;
        break;
        
      case 'green':
        colorCode = COLORS.SUCCESS;
        break;
        
      case 'blue':
        colorCode = COLORS.INFO;
        break;
        
      case 'yellow':
        colorCode = COLORS.WARNING;
        break;
        
      case 'red':
        colorCode = COLORS.ERROR;
        break;
        
      default:
        return text;
    }
    
    return `${colorCode}${text}${ANSI.RESET}`;
  }

  /**
   * Get estimated time remaining text
   */
  private getETAText(): string {
    if (this.current === 0) {
      return 'ETA: calculating...';
    }
    
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / elapsed; // progress per ms
    const remaining = this.total - this.current;
    const etaMs = remaining / rate;
    
    if (etaMs < 1000) {
      return 'ETA: <1s';
    } else if (etaMs < 60000) {
      return `ETA: ${Math.round(etaMs / 1000)}s`;
    } else {
      const minutes = Math.round(etaMs / 60000);
      return `ETA: ${minutes}m`;
    }
  }
}

/**
 * Multi-step progress tracker for complex workflows
 */
export class MultiStepProgress {
  private steps: { name: string; weight: number; completed: boolean }[] = [];
  private currentStepIndex = 0;
  private progressBar: ProgressBar;
  
  constructor(steps: Array<{ name: string; weight?: number }>, options: ProgressBarOptions = {}) {
    this.steps = steps.map(step => ({
      name: step.name,
      weight: step.weight ?? 1,
      completed: false
    }));
    
    const totalWeight = this.steps.reduce((sum, step) => sum + step.weight, 0);
    
    this.progressBar = new ProgressBar({
      ...options,
      total: totalWeight,
      prefix: options.prefix ?? 'Progress'
    });
  }
  
  /**
   * Start the next step
   */
  nextStep(): void {
    if (this.currentStepIndex < this.steps.length) {
      const currentStep = this.steps[this.currentStepIndex];
      const completedWeight = this.steps
        .slice(0, this.currentStepIndex)
        .reduce((sum, step) => sum + step.weight, 0);
      
      this.progressBar.update(completedWeight, `${currentStep.name}...`);
    }
  }
  
  /**
   * Complete the current step
   */
  completeCurrentStep(): void {
    if (this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].completed = true;
      const completedWeight = this.steps
        .slice(0, this.currentStepIndex + 1)
        .reduce((sum, step) => sum + step.weight, 0);
      
      const currentStep = this.steps[this.currentStepIndex];
      this.progressBar.update(completedWeight, `✅ ${currentStep.name} complete`);
      this.currentStepIndex++;
    }
  }
  
  /**
   * Complete all steps
   */
  complete(): void {
    this.progressBar.complete('All steps completed successfully! 🎉');
  }
  
  /**
   * Fail with error message
   */
  fail(errorMessage: string): void {
    this.progressBar.fail(errorMessage);
  }
}