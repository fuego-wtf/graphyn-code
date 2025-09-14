/**
 * Performance Monitor - Real-time performance tracking and optimization
 *
 * Monitors and enforces Ultimate Orchestration Platform performance targets:
 * - Complex features: <30 seconds completion
 * - Memory usage: <150MB during peak execution
 * - Reliability: 99% task completion rate
 * - UI performance: 60fps (<16ms render)
 *
 * Features:
 * - Real-time metric collection and analysis
 * - Performance threshold enforcement with warnings
 * - Automatic optimization recommendations
 * - Reliability tracking with statistical analysis
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  TASK_COMPLETION_TARGET_MS,
  MEMORY_LIMIT_MB,
  MEMORY_WARNING_THRESHOLD_MB,
  CPU_WARNING_THRESHOLD_PERCENT,
  PERFORMANCE_SAMPLE_INTERVAL_MS,
  UI_RENDER_TARGET_MS,
  RELIABILITY_TARGET
} from '../orchestrator/constants.js';

/**
 * Performance monitor configuration
 */
export interface PerformanceMonitorConfig {
  readonly memoryLimitMb?: number;
  readonly taskTargetMs?: number;
  readonly enabled?: boolean;
  readonly sampleIntervalMs?: number;
  readonly retentionPeriodMs?: number;
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
  readonly timestamp: Date;
  readonly memoryUsageMb: number;
  readonly cpuUsagePercent: number;
  readonly taskCompletionMs: number | null;
  readonly uiRenderTimeMs: number | null;
  readonly reliabilityScore: number;
  readonly activeExecutions: number;
  readonly queuedTasks: number;
}

/**
 * Performance statistics over time
 */
export interface PerformanceStatistics {
  readonly avgMemoryMb: number;
  readonly peakMemoryMb: number;
  readonly avgCpuPercent: number;
  readonly avgTaskCompletionMs: number;
  readonly avgUiRenderMs: number;
  readonly reliabilityScore: number;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly warningCount: number;
  readonly violationCount: number;
}

/**
 * Performance warning event
 */
export interface PerformanceWarning {
  readonly type: 'memory' | 'cpu' | 'task_timeout' | 'ui_render' | 'reliability';
  readonly severity: 'warning' | 'critical';
  readonly value: number;
  readonly threshold: number;
  readonly timestamp: Date;
  readonly message: string;
  readonly recommendation?: string;
}

/**
 * Execution tracking entry
 */
interface ExecutionEntry {
  readonly id: string;
  readonly query: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly success?: boolean;
  readonly memoryPeakMb: number;
  readonly taskCount: number;
}

/**
 * Performance Monitor - Real-time system performance tracking
 */
export class PerformanceMonitor extends EventEmitter {
  private readonly config: Required<PerformanceMonitorConfig>;
  private readonly metrics: PerformanceMetrics[] = [];
  private readonly executions = new Map<string, ExecutionEntry>();
  private readonly completedExecutions: ExecutionEntry[] = [];

  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private startTime = Date.now();

  // Real-time tracking
  private currentMemoryMb = 0;
  private peakMemoryMb = 0;
  private currentCpuPercent = 0;
  private lastUiRenderMs = 0;
  private warningCount = 0;
  private violationCount = 0;

  // Reliability tracking
  private totalExecutions = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;

  constructor(config: PerformanceMonitorConfig = {}) {
    super();

    this.config = {
      memoryLimitMb: config.memoryLimitMb || MEMORY_LIMIT_MB,
      taskTargetMs: config.taskTargetMs || TASK_COMPLETION_TARGET_MS,
      enabled: config.enabled ?? true,
      sampleIntervalMs: config.sampleIntervalMs || PERFORMANCE_SAMPLE_INTERVAL_MS,
      retentionPeriodMs: config.retentionPeriodMs || 3600000 // 1 hour
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start execution tracking
   */
  startExecution(executionId: string, query: string): void {
    const entry: ExecutionEntry = {
      id: executionId,
      query,
      startTime: performance.now(),
      memoryPeakMb: this.getCurrentMemoryMb(),
      taskCount: 0
    };

    this.executions.set(executionId, entry);
    this.emit('executionStarted', { executionId, query });
  }

  /**
   * Complete execution tracking
   */
  completeExecution(executionId: string, success: boolean, taskCount: number = 0): void {
    const entry = this.executions.get(executionId);
    if (!entry) {
      return;
    }

    const completedEntry: ExecutionEntry = {
      ...entry,
      endTime: performance.now(),
      success,
      taskCount,
      memoryPeakMb: Math.max(entry.memoryPeakMb, this.getCurrentMemoryMb())
    };

    this.executions.delete(executionId);
    this.completedExecutions.push(completedEntry);

    // Update reliability statistics
    this.totalExecutions++;
    if (success) {
      this.successfulExecutions++;
    } else {
      this.failedExecutions++;
    }

    // Check performance targets
    this.checkExecutionPerformance(completedEntry);

    this.emit('executionCompleted', {
      executionId,
      success,
      durationMs: completedEntry.endTime! - completedEntry.startTime,
      memoryPeakMb: completedEntry.memoryPeakMb
    });

    // Cleanup old completed executions
    this.cleanupOldExecutions();
  }

  /**
   * Stop execution tracking
   */
  stopExecution(): void {
    // Complete any remaining executions as failed
    const remainingIds = Array.from(this.executions.keys());
    remainingIds.forEach(id => {
      this.completeExecution(id, false);
    });
  }

  /**
   * Record UI render time
   */
  recordUiRender(renderTimeMs: number): void {
    this.lastUiRenderMs = renderTimeMs;

    if (renderTimeMs > UI_RENDER_TARGET_MS) {
      this.emitWarning({
        type: 'ui_render',
        severity: renderTimeMs > (UI_RENDER_TARGET_MS * 2) ? 'critical' : 'warning',
        value: renderTimeMs,
        threshold: UI_RENDER_TARGET_MS,
        timestamp: new Date(),
        message: `UI render time ${renderTimeMs.toFixed(1)}ms exceeds target of ${UI_RENDER_TARGET_MS}ms`,
        recommendation: 'Consider optimizing component render cycles and reducing DOM updates'
      });
    }
  }

  /**
   * Get current memory usage in MB
   */
  getCurrentMemoryMb(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024);
    }
    return 0;
  }

  /**
   * Get peak memory usage since start
   */
  getPeakMemoryMb(): number {
    return this.peakMemoryMb;
  }

  /**
   * Get average CPU usage
   */
  getAverageCpuPercent(): number {
    if (this.metrics.length === 0) return 0;

    const totalCpu = this.metrics.reduce((sum, metric) => sum + metric.cpuUsagePercent, 0);
    return Math.round((totalCpu / this.metrics.length) * 100) / 100;
  }

  /**
   * Get current reliability score (0-1)
   */
  getReliabilityScore(): number {
    if (this.totalExecutions === 0) return 1.0;

    return this.successfulExecutions / this.totalExecutions;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if performance targets are being met
   */
  isPerformingWell(): boolean {
    const memoryOk = this.currentMemoryMb <= this.config.memoryLimitMb;
    const cpuOk = this.currentCpuPercent <= CPU_WARNING_THRESHOLD_PERCENT;
    const reliabilityOk = this.getReliabilityScore() >= RELIABILITY_TARGET;
    const uiOk = this.lastUiRenderMs <= UI_RENDER_TARGET_MS;

    return memoryOk && cpuOk && reliabilityOk && uiOk;
  }

  /**
   * Get comprehensive performance statistics
   */
  getStatistics(): PerformanceStatistics {
    const memoryValues = this.metrics.map(m => m.memoryUsageMb);
    const cpuValues = this.metrics.map(m => m.cpuUsagePercent);
    const taskTimes = this.completedExecutions
      .filter(e => e.endTime && e.success)
      .map(e => e.endTime! - e.startTime);
    const renderTimes = this.metrics
      .filter(m => m.uiRenderTimeMs !== null)
      .map(m => m.uiRenderTimeMs!);

    return {
      avgMemoryMb: this.average(memoryValues),
      peakMemoryMb: this.peakMemoryMb,
      avgCpuPercent: this.average(cpuValues),
      avgTaskCompletionMs: this.average(taskTimes),
      avgUiRenderMs: this.average(renderTimes),
      reliabilityScore: this.getReliabilityScore(),
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      warningCount: this.warningCount,
      violationCount: this.violationCount
    };
  }

  /**
   * Get recent performance metrics
   */
  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Force performance collection
   */
  collectMetrics(): PerformanceMetrics {
    this.currentMemoryMb = this.getCurrentMemoryMb();
    this.currentCpuPercent = this.getCurrentCpuUsage();

    // Update peak memory
    if (this.currentMemoryMb > this.peakMemoryMb) {
      this.peakMemoryMb = this.currentMemoryMb;
    }

    // Check thresholds
    this.checkPerformanceThresholds();

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      memoryUsageMb: this.currentMemoryMb,
      cpuUsagePercent: this.currentCpuPercent,
      taskCompletionMs: null, // Filled by completed executions
      uiRenderTimeMs: this.lastUiRenderMs || null,
      reliabilityScore: this.getReliabilityScore(),
      activeExecutions: this.executions.size,
      queuedTasks: 0 // This would come from orchestrator
    };

    this.metrics.push(metrics);
    this.cleanupOldMetrics();

    return metrics;
  }

  // Private methods

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.sampleIntervalMs);

    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Get current CPU usage (simplified implementation)
   */
  private getCurrentCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, this would use more sophisticated CPU monitoring
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;

    // Convert microseconds to percentage (very simplified)
    return Math.min((totalUsage / 1000000) * 10, 100);
  }

  /**
   * Check execution performance against targets
   */
  private checkExecutionPerformance(execution: ExecutionEntry): void {
    if (!execution.endTime) return;

    const durationMs = execution.endTime - execution.startTime;

    // Check task completion target
    if (durationMs > this.config.taskTargetMs) {
      this.emitWarning({
        type: 'task_timeout',
        severity: durationMs > (this.config.taskTargetMs * 1.5) ? 'critical' : 'warning',
        value: durationMs,
        threshold: this.config.taskTargetMs,
        timestamp: new Date(),
        message: `Task completion time ${Math.round(durationMs)}ms exceeds target of ${this.config.taskTargetMs}ms`,
        recommendation: 'Consider optimizing task decomposition or agent parallelization'
      });
    }

    // Check memory usage
    if (execution.memoryPeakMb > this.config.memoryLimitMb) {
      this.violationCount++;
      this.emitWarning({
        type: 'memory',
        severity: 'critical',
        value: execution.memoryPeakMb,
        threshold: this.config.memoryLimitMb,
        timestamp: new Date(),
        message: `Memory usage ${execution.memoryPeakMb}MB exceeded limit of ${this.config.memoryLimitMb}MB`,
        recommendation: 'Consider reducing concurrent agent sessions or optimizing memory usage'
      });
    }
  }

  /**
   * Check current performance thresholds
   */
  private checkPerformanceThresholds(): void {
    // Memory warning
    if (this.currentMemoryMb > MEMORY_WARNING_THRESHOLD_MB) {
      this.emitWarning({
        type: 'memory',
        severity: this.currentMemoryMb > this.config.memoryLimitMb ? 'critical' : 'warning',
        value: this.currentMemoryMb,
        threshold: MEMORY_WARNING_THRESHOLD_MB,
        timestamp: new Date(),
        message: `Memory usage ${this.currentMemoryMb}MB approaching limit of ${this.config.memoryLimitMb}MB`,
        recommendation: 'Consider terminating idle agent sessions or reducing concurrency'
      });
    }

    // CPU warning
    if (this.currentCpuPercent > CPU_WARNING_THRESHOLD_PERCENT) {
      this.emitWarning({
        type: 'cpu',
        severity: this.currentCpuPercent > 90 ? 'critical' : 'warning',
        value: this.currentCpuPercent,
        threshold: CPU_WARNING_THRESHOLD_PERCENT,
        timestamp: new Date(),
        message: `CPU usage ${this.currentCpuPercent.toFixed(1)}% is high`,
        recommendation: 'Consider reducing concurrent operations or optimizing computation'
      });
    }

    // Reliability warning
    const reliabilityScore = this.getReliabilityScore();
    if (reliabilityScore < RELIABILITY_TARGET && this.totalExecutions >= 10) {
      this.emitWarning({
        type: 'reliability',
        severity: reliabilityScore < 0.95 ? 'critical' : 'warning',
        value: reliabilityScore,
        threshold: RELIABILITY_TARGET,
        timestamp: new Date(),
        message: `Reliability score ${(reliabilityScore * 100).toFixed(1)}% below target of ${(RELIABILITY_TARGET * 100)}%`,
        recommendation: 'Review failed executions and improve error handling'
      });
    }
  }

  /**
   * Emit performance warning
   */
  private emitWarning(warning: PerformanceWarning): void {
    this.warningCount++;

    if (warning.severity === 'critical') {
      this.violationCount++;
    }

    this.emit('performanceWarning', warning);
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionPeriodMs;

    while (this.metrics.length > 0 && this.metrics[0].timestamp.getTime() < cutoff) {
      this.metrics.shift();
    }
  }

  /**
   * Cleanup old executions to prevent memory leaks
   */
  private cleanupOldExecutions(): void {
    const cutoff = Date.now() - this.config.retentionPeriodMs;

    while (this.completedExecutions.length > 0) {
      const execution = this.completedExecutions[0];
      if ((execution.endTime || execution.startTime) < cutoff) {
        this.completedExecutions.shift();
      } else {
        break;
      }
    }
  }

  /**
   * Calculate average of number array
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.stopMonitoring();
    this.stopExecution();
    this.emit('shutdown');
  }
}