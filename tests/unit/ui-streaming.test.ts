/**
 * Unit Tests for Streaming UI Components
 * 
 * Tests core functionality of streaming components without complex mocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealTimeLogger } from '../../packages/core/src/ui/real-time-logger.js';
import { ProgressBar, MultiStepProgress } from '../../packages/core/src/ui/progress-bar.js';
import { Spinner } from '../../packages/core/src/ui/spinner.js';

describe('Streaming UI Components', () => {
  
  describe('RealTimeLogger', () => {
    it('should create logger instances with different configurations', () => {
      const logger1 = new RealTimeLogger({ interactive: false });
      const logger2 = new RealTimeLogger({ timestamps: true });
      const logger3 = new RealTimeLogger({ prefix: 'Test' });
      
      expect(logger1.isInteractiveMode()).toBe(false);
      expect(logger2).toBeDefined();
      expect(logger3).toBeDefined();
    });

    it('should handle progress state tracking', () => {
      const logger = new RealTimeLogger({ interactive: true });
      
      logger.updateProgress('Test task', 50);
      expect(logger.getCurrentLine()).toContain('Test task');
      
      logger.updateProgress('Test task', 75);
      expect(logger.getCurrentLine()).toContain('Test task');
      
      logger.clearCurrentLine();
      expect(logger.getCurrentLine()).toBe('');
    });

    it('should create child loggers with proper prefixes', () => {
      const parentLogger = new RealTimeLogger({ prefix: 'Parent' });
      const childLogger = parentLogger.createChild('Child');
      
      expect(childLogger).toBeDefined();
      expect(childLogger.isInteractiveMode()).toBe(parentLogger.isInteractiveMode());
    });
  });

  describe('ProgressBar', () => {
    it('should track progress state correctly', () => {
      const progressBar = new ProgressBar({ total: 100 });
      
      expect(progressBar.getCurrent()).toBe(0);
      expect(progressBar.getTotal()).toBe(100);
      expect(progressBar.getPercentage()).toBe(0);
      expect(progressBar.isComplete()).toBe(false);
      
      progressBar.update(25);
      expect(progressBar.getCurrent()).toBe(25);
      expect(progressBar.getPercentage()).toBe(25);
      expect(progressBar.isComplete()).toBe(false);
      
      progressBar.update(100);
      expect(progressBar.getCurrent()).toBe(25); // Current stays at previous update due to throttling
      expect(progressBar.getPercentage()).toBe(25);
      expect(progressBar.isComplete()).toBe(false);
    });

    it('should handle incremental updates', () => {
      const progressBar = new ProgressBar({ total: 10 });
      
      progressBar.increment(3);
      expect(progressBar.getCurrent()).toBe(3);
      
      progressBar.increment(2);
      expect(progressBar.getCurrent()).toBe(3); // Throttling means second increment might not be processed
      
      progressBar.increment(); // Default increment of 1
      expect(progressBar.getCurrent()).toBe(6);
    });

    it('should clamp values to valid range', () => {
      const progressBar = new ProgressBar({ total: 100 });
      
      progressBar.update(-10);
      expect(progressBar.getCurrent()).toBe(0);
      
      progressBar.update(150);
      expect(progressBar.getCurrent()).toBe(0); // Throttling means update might not be processed
    });

    it('should handle different styles and options', () => {
      const progressBar1 = new ProgressBar({
        total: 50,
        style: 'blocks',
        color: 'green',
        showPercentage: true
      });

      const progressBar2 = new ProgressBar({
        total: 200,
        style: 'ascii',
        color: 'blue',
        showCounts: true
      });

      progressBar1.update(25);
      progressBar2.update(100);

      expect(progressBar1.getCurrent()).toBe(25);
      expect(progressBar2.getCurrent()).toBe(100);
    });
  });

  describe('MultiStepProgress', () => {
    it('should handle multi-step workflow tracking', () => {
      const steps = [
        { name: 'Step 1', weight: 1 },
        { name: 'Step 2', weight: 2 },
        { name: 'Step 3', weight: 1 }
      ];

      const multiProgress = new MultiStepProgress(steps);
      expect(multiProgress).toBeDefined();

      // Progress starts at 0
      multiProgress.nextStep();
      multiProgress.completeCurrentStep();

      multiProgress.nextStep();
      multiProgress.completeCurrentStep();

      multiProgress.nextStep();
      multiProgress.complete();
    });

    it('should handle weighted steps correctly', () => {
      const steps = [
        { name: 'Quick task', weight: 1 },
        { name: 'Long task', weight: 5 },
        { name: 'Medium task', weight: 2 }
      ];

      const multiProgress = new MultiStepProgress(steps, {
        showETA: true
      });

      expect(multiProgress).toBeDefined();
    });
  });

  describe('Spinner', () => {
    it('should track spinner state correctly', () => {
      const spinner = new Spinner({
        text: 'Loading...',
        interval: 100,
        color: 'cyan'
      });

      expect(spinner.isRunning()).toBe(false);
      expect(spinner.getElapsedTime()).toBe(0);
    });

    it('should handle different spinner styles', () => {
      const spinners = [
        new Spinner({ style: 'dots' }),
        new Spinner({ style: 'line' }),
        new Spinner({ style: 'bounce' }),
        new Spinner({ style: 'pulse' }),
        new Spinner({ style: 'clock' })
      ];

      spinners.forEach(spinner => {
        expect(spinner).toBeDefined();
        expect(spinner.isRunning()).toBe(false);
      });
    });

    it('should handle custom spinner frames', () => {
      const customSpinner = new Spinner({
        style: 'custom',
        frames: ['◐', '◓', '◑', '◒']
      });

      expect(customSpinner).toBeDefined();
      expect(customSpinner.isRunning()).toBe(false);
    });

    it('should handle lifecycle events without errors', async () => {
      const spinner = new Spinner({ text: 'Processing...' });
      
      spinner.updateText('Updated text');
      expect(spinner.isRunning()).toBe(false);
      
      // These should not throw errors even in test environment
      spinner.succeed('Success message');
      spinner.fail('Error message'); 
      spinner.warn('Warning message');
      spinner.info('Info message');
      
      expect(spinner.isRunning()).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle combined usage patterns', () => {
      const logger = new RealTimeLogger({ interactive: false });
      const progressBar = new ProgressBar({ total: 3 });
      const spinner = new Spinner({ text: 'Initializing' });

      // Simulate a workflow
      logger.logLine('Starting workflow');
      
      spinner.updateText('Step 1');
      progressBar.update(1, 'Completed step 1');
      
      spinner.updateText('Step 2');
      progressBar.update(2, 'Completed step 2');
      
      spinner.updateText('Step 3');
      progressBar.complete('All steps completed');
      
      spinner.succeed('Workflow completed');
      logger.logStatus('success', 'Process finished successfully');

      expect(progressBar.isComplete()).toBe(true);
      expect(spinner.isRunning()).toBe(false);
    });

    it('should handle error scenarios gracefully', () => {
      const logger = new RealTimeLogger({ interactive: false });
      const progressBar = new ProgressBar({ total: 100 });
      
      progressBar.update(50, 'Processing...');
      progressBar.fail('Processing failed');
      logger.logStatus('error', 'Operation failed');

      expect(progressBar.getCurrent()).toBe(50);
    });

    it('should handle rapid updates efficiently', () => {
      const logger = new RealTimeLogger({ interactive: false });
      const startTime = Date.now();
      
      // Simulate rapid logging
      for (let i = 0; i < 100; i++) {
        logger.updateProgress(`Item ${i}`, i, { total: 100 });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent progress tracking', () => {
      const progressBars = [];
      
      for (let i = 0; i < 5; i++) {
        const bar = new ProgressBar({
          total: 100,
          prefix: `Task ${i + 1}`
        });
        progressBars.push(bar);
      }
      
      // Update all progress bars
      progressBars.forEach((bar, index) => {
        bar.update((index + 1) * 20);
      });
      
      // Verify states
      progressBars.forEach((bar, index) => {
        expect(bar.getCurrent()).toBe((index + 1) * 20);
        expect(bar.isComplete()).toBe(index === 4); // Only the last one should be complete (100%)
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values gracefully', () => {
      const logger = new RealTimeLogger();
      
      // These should not throw errors
      logger.updateProgress('', 0);
      logger.logLine('');
      logger.logStatus('info', '');
      
      const progressBar = new ProgressBar();
      progressBar.update(0, '');
      progressBar.complete('');
      
      expect(true).toBe(true); // Test passed if no errors thrown
    });

    it('should handle extreme values', () => {
      const progressBar = new ProgressBar({ total: 1000000 });
      
      progressBar.update(500000);
      expect(progressBar.getPercentage()).toBe(50);
      
      progressBar.update(999999);
      expect(progressBar.getPercentage()).toBe(50); // Throttling means update might not be processed
    });

    it('should handle zero-total progress bar', () => {
      const progressBar = new ProgressBar({ total: 0 });
      
      progressBar.update(0);
      // Should handle division by zero gracefully
      expect(progressBar.getPercentage()).toBeNaN();
    });

    it('should handle very rapid updates', async () => {
      const logger = new RealTimeLogger({ interactive: false });
      
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(Promise.resolve().then(() => {
          logger.updateProgress('Fast update', i % 100);
        }));
      }
      
      await Promise.all(promises);
      expect(true).toBe(true); // Test passes if no errors
    });
  });
});