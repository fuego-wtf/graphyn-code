/**
 * Standardized Task Planning Format (STPF) v1.0 - Implementation Algorithms
 * Integrates INVEST, IEEE 830, RFC 2119, CPM, PERT, BDD/TDD standards
 */

import { TaskDefinition, ValidationResult, ProjectMetrics, ParallelBatch, CriticalPathResult } from './task-planning-types';

// ========================================
// 1. DEPENDENCY RESOLUTION (Topological Sorting)
// ========================================

export class DependencyResolver {
  static topologicalSort(tasks: TaskDefinition[]): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    const dfsVisit = (taskId: string): void => {
      if (stack.has(taskId)) {
        throw new Error(`Circular dependency detected in path containing: ${taskId}`);
      }
      if (visited.has(taskId)) return;
      
      stack.add(taskId);
      const task = taskMap.get(taskId);
      
      if (task?.dependencies?.blockedBy) {
        for (const depId of task.dependencies.blockedBy) {
          if (!taskMap.has(depId)) {
            throw new Error(`Dependency not found: ${depId} required by ${taskId}`);
          }
          dfsVisit(depId);
        }
      }
      
      stack.delete(taskId);
      visited.add(taskId);
      result.unshift(taskId);
    };
    
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        dfsVisit(task.id);
      }
    }
    
    return result;
  }

  static validateDependencies(tasks: TaskDefinition[]): ValidationResult {
    const issues: string[] = [];
    const taskIds = new Set(tasks.map(t => t.id));
    
    for (const task of tasks) {
      // Check if all dependencies exist
      if (task.dependencies?.blockedBy) {
        for (const depId of task.dependencies.blockedBy) {
          if (!taskIds.has(depId)) {
            issues.push(`Task ${task.id}: Dependency ${depId} not found in task set`);
          }
        }
      }
      
      // Check dependency depth (max 3 levels for maintainability)
      const depthCount = task.dependencies?.blockedBy?.length || 0;
      if (depthCount > 3) {
        issues.push(`Task ${task.id}: Too many direct dependencies (${depthCount}), max 3 recommended`);
      }
    }
    
    try {
      this.topologicalSort(tasks);
    } catch (error) {
      issues.push(`Dependency validation failed: ${error.message}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      score: Math.max(0, 100 - (issues.length * 20))
    };
  }
}

// ========================================
// 2. CRITICAL PATH METHOD (CPM) IMPLEMENTATION
// ========================================

export class CriticalPathCalculator {
  static calculate(tasks: TaskDefinition[]): CriticalPathResult {
    const sortedIds = DependencyResolver.topologicalSort(tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const taskDetails = new Map<string, any>();
    
    // Initialize all tasks
    for (const taskId of sortedIds) {
      taskDetails.set(taskId, {
        earliestStart: 0,
        latestStart: 0,
        earliestFinish: 0,
        latestFinish: 0,
        slack: 0,
        isCritical: false,
        duration: taskMap.get(taskId)?.estimation.storyPoints || 0
      });
    }
    
    // Forward pass - Calculate earliest times
    for (const taskId of sortedIds) {
      const task = taskMap.get(taskId)!;
      const details = taskDetails.get(taskId)!;
      
      if (task.dependencies?.blockedBy?.length) {
        const maxPredecessorFinish = Math.max(
          ...task.dependencies.blockedBy.map(depId => 
            taskDetails.get(depId)!.earliestFinish
          )
        );
        details.earliestStart = maxPredecessorFinish;
      }
      
      details.earliestFinish = details.earliestStart + details.duration;
    }
    
    // Find project duration (max earliest finish)
    const projectDuration = Math.max(...Array.from(taskDetails.values()).map(d => d.earliestFinish));
    
    // Backward pass - Calculate latest times
    const reverseSortedIds = [...sortedIds].reverse();
    
    for (const taskId of reverseSortedIds) {
      const details = taskDetails.get(taskId)!;
      const task = taskMap.get(taskId)!;
      
      // Find successors
      const successors = tasks.filter(t => 
        t.dependencies?.blockedBy?.includes(taskId)
      );
      
      if (successors.length === 0) {
        // End task
        details.latestFinish = projectDuration;
      } else {
        // Min of successor latest starts
        details.latestFinish = Math.min(
          ...successors.map(s => taskDetails.get(s.id)!.latestStart)
        );
      }
      
      details.latestStart = details.latestFinish - details.duration;
      details.slack = details.latestStart - details.earliestStart;
      details.isCritical = details.slack === 0;
    }
    
    // Identify critical path
    const criticalTasks = Array.from(taskDetails.entries())
      .filter(([_, details]) => details.isCritical)
      .map(([taskId, _]) => taskId);
    
    return {
      criticalPath: criticalTasks,
      totalDuration: projectDuration,
      taskDetails
    };
  }

  static identifyBottlenecks(result: CriticalPathResult): string[] {
    return Array.from(result.taskDetails.entries())
      .filter(([_, details]) => details.slack <= 1)
      .map(([taskId, _]) => taskId);
  }
}

// ========================================
// 3. PARALLEL EXECUTION SCHEDULER
// ========================================

export class ParallelExecutionScheduler {
  static identifyParallelBatches(
    tasks: TaskDefinition[], 
    resourceConstraints: Map<string, number> = new Map()
  ): ParallelBatch[] {
    const sortedIds = DependencyResolver.topologicalSort(tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const scheduled = new Set<string>();
    const batches: ParallelBatch[] = [];
    let batchId = 0;
    
    while (scheduled.size < tasks.length) {
      // Find tasks ready for execution
      const readyTasks = tasks.filter(task => {
        if (scheduled.has(task.id)) return false;
        
        // Check if all dependencies are satisfied
        const dependenciesSatisfied = !task.dependencies?.blockedBy || 
          task.dependencies.blockedBy.every(depId => scheduled.has(depId));
        
        return dependenciesSatisfied;
      });
      
      if (readyTasks.length === 0) {
        throw new Error("No tasks ready for execution - possible circular dependency");
      }
      
      // Apply resource constraints
      const feasibleTasks = this.applyResourceConstraints(readyTasks, resourceConstraints);
      
      const batch: ParallelBatch = {
        batchId: batchId++,
        tasks: feasibleTasks.map(t => t.id),
        estimatedDuration: Math.max(...feasibleTasks.map(t => t.estimation.storyPoints)),
        requiredResources: this.extractRequiredResources(feasibleTasks),
        startTime: batchId === 1 ? 0 : batches[batchId - 2]?.startTime + batches[batchId - 2]?.estimatedDuration,
        endTime: 0 // Will be calculated
      };
      
      batch.endTime = batch.startTime + batch.estimatedDuration;
      batches.push(batch);
      
      feasibleTasks.forEach(task => scheduled.add(task.id));
    }
    
    return batches;
  }
  
  private static applyResourceConstraints(
    tasks: TaskDefinition[],
    constraints: Map<string, number>
  ): TaskDefinition[] {
    if (constraints.size === 0) return tasks;
    
    // Simple greedy approach - prioritize by business value
    return tasks
      .sort((a, b) => b.priority.businessValue - a.priority.businessValue)
      .filter(task => {
        const requiredResources = this.extractRequiredResources([task]);
        return requiredResources.every(resource => 
          (constraints.get(resource) || 0) > 0
        );
      });
  }
  
  private static extractRequiredResources(tasks: TaskDefinition[]): string[] {
    const resources = new Set<string>();
    
    for (const task of tasks) {
      // Add team/skill requirements
      if (task.complexity.factors) {
        task.complexity.factors.forEach(factor => resources.add(factor));
      }
      
      // Add domain-specific resources
      const domain = task.id.split('-')[0];
      resources.add(domain);
    }
    
    return Array.from(resources);
  }
}

// ========================================
// 4. INVEST CRITERIA VALIDATOR
// ========================================

export class INVESTValidator {
  static validate(task: TaskDefinition): ValidationResult {
    const issues: string[] = [];
    let score = 100;
    
    // Independent (16.67 points)
    if (task.dependencies?.blockedBy && task.dependencies.blockedBy.length > 3) {
      issues.push(`Task ${task.id}: Too many dependencies (${task.dependencies.blockedBy.length}), violates Independence`);
      score -= 16.67;
    }
    
    // Negotiable (16.67 points)
    if (!task.description || task.description.length < 100) {
      issues.push(`Task ${task.id}: Description too brief (${task.description?.length || 0} chars), violates Negotiable criteria`);
      score -= 16.67;
    }
    
    // Valuable (16.67 points)
    if (task.priority.businessValue < 30) {
      issues.push(`Task ${task.id}: Low business value (${task.priority.businessValue}), violates Valuable criteria`);
      score -= 16.67;
    }
    
    // Estimable (16.67 points)
    if (task.estimation.confidence === "LOW") {
      issues.push(`Task ${task.id}: Low estimation confidence, violates Estimable criteria`);
      score -= 16.67;
    }
    
    if (![1, 2, 3, 5, 8, 13, 21, 34, 55, 89].includes(task.estimation.storyPoints)) {
      issues.push(`Task ${task.id}: Invalid Fibonacci story points (${task.estimation.storyPoints})`);
      score -= 8;
    }
    
    // Small (16.67 points)
    if (task.estimation.storyPoints > 13) {
      issues.push(`Task ${task.id}: Story points too large (${task.estimation.storyPoints}), violates Small criteria`);
      score -= 16.67;
    }
    
    // Testable (16.67 points)
    if (task.acceptanceCriteria.length === 0) {
      issues.push(`Task ${task.id}: No acceptance criteria, violates Testable criteria`);
      score -= 16.67;
    }
    
    // Additional BDD format validation
    for (const criterion of task.acceptanceCriteria) {
      if (!criterion.given || !criterion.when || !criterion.then) {
        issues.push(`Task ${task.id}: Acceptance criteria missing Given-When-Then format`);
        score -= 5;
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      score: Math.max(0, Math.round(score))
    };
  }
  
  static validateBatch(tasks: TaskDefinition[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    
    for (const task of tasks) {
      results.set(task.id, this.validate(task));
    }
    
    return results;
  }
}

// ========================================
// 5. PRIORITY CALCULATION ENGINE
// ========================================

export class PriorityCalculator {
  static calculateTaskPriority(task: TaskDefinition): number {
    const moscowWeights = { MUST: 40, SHOULD: 30, COULD: 20, WONT: 10 };
    const complexityPenalties = { SIMPLE: 0, COMPLEX: 10, EPIC: 20 };
    const riskPenalties = { LOW: 0, MEDIUM: 5, HIGH: 15 };
    const rfcWeights = { MUST: 20, SHOULD: 15, MAY: 10, MUST_NOT: -50, SHOULD_NOT: -25 };
    
    const moscowScore = moscowWeights[task.priority.moscow];
    const businessValueScore = task.priority.businessValue * 0.4;
    const complexityPenalty = complexityPenalties[task.complexity.level];
    const riskPenalty = riskPenalties[task.priority.technicalRisk];
    const rfcBonus = rfcWeights[task.requirementLevel];
    
    // Dependency penalty (more dependencies = lower priority for scheduling)
    const dependencyPenalty = (task.dependencies?.blockedBy?.length || 0) * 2;
    
    const finalScore = moscowScore + businessValueScore + rfcBonus - complexityPenalty - riskPenalty - dependencyPenalty;
    
    return Math.max(0, Math.round(finalScore));
  }
  
  static sortByPriority(tasks: TaskDefinition[]): TaskDefinition[] {
    return tasks.sort((a, b) => {
      const priorityA = this.calculateTaskPriority(a);
      const priorityB = this.calculateTaskPriority(b);
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }
      
      // Tie-breaker: lower story points first (deliver value faster)
      return a.estimation.storyPoints - b.estimation.storyPoints;
    });
  }
}

// ========================================
// 6. DEFINITION OF READY/DONE VALIDATORS
// ========================================

export class ReadinessValidator {
  static validateDefinitionOfReady(task: TaskDefinition): ValidationResult {
    const issues: string[] = [];
    const criteria = task.definitionOfReady?.criteria || [];
    
    const requiredChecks = [
      { check: task.acceptanceCriteria.length > 0, message: "No acceptance criteria defined" },
      { check: task.estimation.storyPoints > 0, message: "No story point estimation" },
      { check: task.dependencies !== undefined, message: "Dependencies not analyzed" },
      { check: task.apiContract?.endpoints?.length > 0, message: "API contract not defined" },
      { check: task.testing.testingApproach !== undefined, message: "Testing approach not specified" },
      { check: criteria.length >= 3, message: "Insufficient DoR criteria (minimum 3)" },
      { check: task.complexity.level !== undefined, message: "Complexity not assessed" },
      { check: task.priority.businessValue > 0, message: "Business value not quantified" }
    ];
    
    const failedChecks = requiredChecks.filter(check => !check.check);
    issues.push(...failedChecks.map(check => check.message));
    
    const score = ((requiredChecks.length - failedChecks.length) / requiredChecks.length) * 100;
    
    return {
      valid: issues.length === 0,
      issues,
      score: Math.round(score)
    };
  }
  
  static validateDefinitionOfDone(task: TaskDefinition): ValidationResult {
    const issues: string[] = [];
    const criteria = task.definitionOfDone?.criteria || [];
    
    const requiredChecks = [
      { check: task.testing.unitTests?.required === true, message: "Unit tests not required" },
      { check: task.performance?.responseTime?.target !== undefined, message: "Performance targets not set" },
      { check: task.definitionOfDone?.checkedBy !== undefined, message: "No reviewer assigned" },
      { check: criteria.length >= 5, message: "Insufficient DoD criteria (minimum 5)" },
      { check: task.testing.integrationTests?.required === true, message: "Integration tests not specified" },
      { check: task.apiContract !== undefined, message: "API contract validation missing" }
    ];
    
    const failedChecks = requiredChecks.filter(check => !check.check);
    issues.push(...failedChecks.map(check => check.message));
    
    const score = ((requiredChecks.length - failedChecks.length) / requiredChecks.length) * 100;
    
    return {
      valid: issues.length === 0,
      issues,
      score: Math.round(score)
    };
  }
}

// ========================================
// 7. PROJECT METRICS CALCULATOR
// ========================================

export class MetricsCalculator {
  static calculateProjectMetrics(
    tasks: TaskDefinition[], 
    completedTasks: string[] = [],
    actualDurations: Map<string, number> = new Map()
  ): ProjectMetrics {
    
    const totalPlannedPoints = tasks.reduce((sum, task) => sum + task.estimation.storyPoints, 0);
    const completedPoints = tasks
      .filter(task => completedTasks.includes(task.id))
      .reduce((sum, task) => sum + task.estimation.storyPoints, 0);
    
    const criticalPath = CriticalPathCalculator.calculate(tasks);
    const parallelBatches = ParallelExecutionScheduler.identifyParallelBatches(tasks);
    
    // Estimation accuracy
    let estimationAccuracy = 100;
    if (actualDurations.size > 0) {
      const accuracySum = Array.from(actualDurations.entries()).reduce((sum, [taskId, actual]) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return sum;
        
        const estimated = task.estimation.storyPoints;
        const accuracy = 100 - Math.abs((actual - estimated) / estimated) * 100;
        return sum + Math.max(0, accuracy);
      }, 0);
      
      estimationAccuracy = accuracySum / actualDurations.size;
    }
    
    return {
      velocity: {
        plannedStoryPoints: totalPlannedPoints,
        completedStoryPoints: completedPoints,
        burndownRate: completedPoints / totalPlannedPoints,
        completionPercentage: (completedPoints / totalPlannedPoints) * 100
      },
      quality: {
        investCompliance: this.calculateINVESTCompliance(tasks),
        testCoverage: this.calculateTestCoverage(tasks),
        performanceCompliance: this.calculatePerformanceCompliance(tasks),
        defectPotential: this.calculateDefectPotential(tasks)
      },
      efficiency: {
        criticalPathLength: criticalPath.totalDuration,
        parallelizationRatio: tasks.length / parallelBatches.length,
        resourceUtilization: this.calculateResourceUtilization(parallelBatches),
        throughput: completedPoints / Math.max(1, parallelBatches.length)
      },
      predictability: {
        estimationAccuracy: Math.round(estimationAccuracy),
        scheduleVariance: 0, // Would require actual vs planned dates
        riskScore: this.calculateRiskScore(tasks)
      }
    };
  }
  
  private static calculateINVESTCompliance(tasks: TaskDefinition[]): number {
    const validationResults = tasks.map(task => INVESTValidator.validate(task));
    const totalScore = validationResults.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / tasks.length);
  }
  
  private static calculateTestCoverage(tasks: TaskDefinition[]): number {
    const tasksWithTests = tasks.filter(task => 
      task.testing.unitTests?.required || task.testing.integrationTests?.required
    ).length;
    return Math.round((tasksWithTests / tasks.length) * 100);
  }
  
  private static calculatePerformanceCompliance(tasks: TaskDefinition[]): number {
    const tasksWithTargets = tasks.filter(task => task.performance?.responseTime?.target).length;
    return Math.round((tasksWithTargets / tasks.length) * 100);
  }
  
  private static calculateDefectPotential(tasks: TaskDefinition[]): number {
    const highComplexityTasks = tasks.filter(task => task.complexity.level === "EPIC").length;
    const highRiskTasks = tasks.filter(task => task.priority.technicalRisk === "HIGH").length;
    return Math.round(((highComplexityTasks + highRiskTasks) / (tasks.length * 2)) * 100);
  }
  
  private static calculateResourceUtilization(batches: ParallelBatch[]): number {
    if (batches.length === 0) return 0;
    
    const totalTasks = batches.reduce((sum, batch) => sum + batch.tasks.length, 0);
    const maxBatchSize = Math.max(...batches.map(batch => batch.tasks.length));
    
    return Math.round((totalTasks / (batches.length * maxBatchSize)) * 100);
  }
  
  private static calculateRiskScore(tasks: TaskDefinition[]): number {
    const riskWeights = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    const totalRisk = tasks.reduce((sum, task) => sum + riskWeights[task.priority.technicalRisk], 0);
    const maxRisk = tasks.length * 3;
    return Math.round((totalRisk / maxRisk) * 100);
  }
}

// ========================================
// 8. COMPREHENSIVE PROJECT SCHEDULER
// ========================================

export class ProjectScheduler {
  static createOptimalSchedule(tasks: TaskDefinition[]): {
    schedule: ParallelBatch[];
    metrics: ProjectMetrics;
    criticalPath: CriticalPathResult;
    validationReport: Map<string, ValidationResult>;
  } {
    // Validate dependencies first
    const dependencyValidation = DependencyResolver.validateDependencies(tasks);
    if (!dependencyValidation.valid) {
      throw new Error(`Dependency validation failed: ${dependencyValidation.issues.join(', ')}`);
    }
    
    // Calculate critical path
    const criticalPath = CriticalPathCalculator.calculate(tasks);
    
    // Create parallel execution schedule
    const schedule = ParallelExecutionScheduler.identifyParallelBatches(tasks);
    
    // Calculate project metrics
    const metrics = MetricsCalculator.calculateProjectMetrics(tasks);
    
    // Validate all tasks against INVEST criteria
    const validationReport = INVESTValidator.validateBatch(tasks);
    
    return {
      schedule,
      metrics,
      criticalPath,
      validationReport
    };
  }
  
  static generateScheduleReport(
    tasks: TaskDefinition[],
    options: {
      includeValidation?: boolean;
      includeMetrics?: boolean;
      includeCriticalPath?: boolean;
    } = {}
  ): string {
    const { schedule, metrics, criticalPath, validationReport } = this.createOptimalSchedule(tasks);
    
    let report = "# PROJECT SCHEDULE ANALYSIS REPORT\n\n";
    
    // Executive Summary
    report += "## Executive Summary\n";
    report += `- Total Tasks: ${tasks.length}\n`;
    report += `- Total Story Points: ${metrics.velocity.plannedStoryPoints}\n`;
    report += `- Execution Batches: ${schedule.length}\n`;
    report += `- Critical Path Length: ${criticalPath.totalDuration} story points\n`;
    report += `- Estimated Completion: ${schedule.length} iterations\n\n`;
    
    // Schedule Overview
    report += "## Execution Schedule\n\n";
    for (const batch of schedule) {
      report += `### Batch ${batch.batchId + 1}\n`;
      report += `- Duration: ${batch.estimatedDuration} story points\n`;
      report += `- Tasks: ${batch.tasks.join(', ')}\n`;
      report += `- Resources: ${batch.requiredResources.join(', ')}\n\n`;
    }
    
    if (options.includeCriticalPath !== false) {
      report += "## Critical Path Analysis\n\n";
      report += `Critical tasks (zero slack): ${criticalPath.criticalPath.join(', ')}\n\n`;
      
      const bottlenecks = CriticalPathCalculator.identifyBottlenecks(criticalPath);
      if (bottlenecks.length > 0) {
        report += `⚠️ Potential bottlenecks (≤1 slack): ${bottlenecks.join(', ')}\n\n`;
      }
    }
    
    if (options.includeValidation !== false) {
      report += "## INVEST Validation Results\n\n";
      const failedTasks = Array.from(validationReport.entries())
        .filter(([_, result]) => !result.valid);
      
      if (failedTasks.length > 0) {
        report += "### Tasks Requiring Attention:\n";
        for (const [taskId, result] of failedTasks) {
          report += `- **${taskId}** (Score: ${result.score}%)\n`;
          for (const issue of result.issues) {
            report += `  - ${issue}\n`;
          }
        }
      } else {
        report += "✅ All tasks pass INVEST validation criteria\n";
      }
      report += "\n";
    }
    
    if (options.includeMetrics !== false) {
      report += "## Project Metrics\n\n";
      report += `- INVEST Compliance: ${metrics.quality.investCompliance}%\n`;
      report += `- Test Coverage: ${metrics.quality.testCoverage}%\n`;
      report += `- Performance Compliance: ${metrics.quality.performanceCompliance}%\n`;
      report += `- Parallelization Ratio: ${metrics.efficiency.parallelizationRatio.toFixed(2)}\n`;
      report += `- Risk Score: ${metrics.predictability.riskScore}%\n\n`;
    }
    
    report += "---\n";
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `STPF Version: 1.0\n`;
    
    return report;
  }
}