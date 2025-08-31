/**
 * Graph-Neural AI Coordination System
 * Main orchestration interface that integrates all components
 */

import { EventEmitter } from 'events';
import { GraphFlowEngine, ExecutionGraph, GraphNode, GraphExecutionProgress, NeuralCoordinationResult } from './graph-flow-engine.js';
import { GraphBuilder, GraphBuilderRequest, GraphBuildResult } from './graph-builder.js';
import { InputEnricher, EnrichmentContext, EnrichedPrompt } from './input-enricher.js';
import { OutputPropagator, ParsedOutput, PropagationResult } from './output-propagator.js';

export interface GraphNeuralRequest {
  query: string;
  context?: {
    repository?: string;
    framework?: string;
    language?: string;
    existingFiles?: string[];
  };
  options?: {
    mode?: 'sequential' | 'parallel' | 'neural';
    maxNodes?: number;
    timeout?: number;
    parallelismLevel?: 'low' | 'medium' | 'high';
    enableVisualization?: boolean;
  };
}

export interface GraphNeuralResult {
  success: boolean;
  sessionId: string;
  graph?: ExecutionGraph;
  results?: Map<string, any>;
  metrics?: {
    totalExecutionTime: number;
    neuralEnrichmentOverhead: number;
    networkEffects: number;
    parallelismUtilization: number;
  };
  error?: string;
}

export interface GraphNeuralProgress {
  sessionId: string;
  phase: 'building' | 'executing' | 'completed' | 'failed';
  currentNode?: string;
  completedNodes: number;
  totalNodes: number;
  progress: number;
  networkMetrics?: {
    enrichmentQuality: number;
    dependencyResolutionTime: number;
    parallelUtilization: number;
  };
}

export class GraphNeuralSystem extends EventEmitter {
  private graphEngine: GraphFlowEngine;
  private graphBuilder: GraphBuilder;
  private inputEnricher: InputEnricher;
  private outputPropagator: OutputPropagator;
  private activeSessions = new Map<string, ExecutionGraph>();

  constructor(basePath?: string) {
    super();
    
    this.graphEngine = new GraphFlowEngine(basePath);
    this.graphBuilder = new GraphBuilder();
    this.inputEnricher = new InputEnricher(basePath);
    this.outputPropagator = new OutputPropagator(basePath);

    this.setupEventListeners();
  }

  /**
   * Execute a natural language query using graph-neural coordination
   */
  async execute(request: GraphNeuralRequest): Promise<GraphNeuralResult> {
    const startTime = Date.now();
    let sessionId: string | undefined;

    try {
      this.emit('execution_started', { query: request.query });

      // Phase 1: Build execution graph
      this.emit('phase_started', { phase: 'building', query: request.query });
      
      const graphRequest: GraphBuilderRequest = {
        query: request.query,
        context: request.context,
        constraints: {
          maxNodes: request.options?.maxNodes || 8,
          parallelismLevel: request.options?.parallelismLevel || 'high'
        },
        mode: 'automatic'
      };

      const graphResult = await this.graphBuilder.buildGraph(graphRequest);
      
      if (!graphResult.success || !graphResult.graph) {
        throw new Error(graphResult.error || 'Failed to build execution graph');
      }

      sessionId = graphResult.graph.sessionId;
      this.activeSessions.set(sessionId, graphResult.graph);

      this.emit('graph_built', {
        sessionId,
        nodeCount: graphResult.graph.nodes.size,
        analysis: graphResult.analysis
      });

      // Phase 2: Execute with neural coordination
      this.emit('phase_started', { phase: 'executing', sessionId });

      const executionResult = await this.graphEngine.executeGraph(graphResult.graph, {
        mode: request.options?.mode || 'neural',
        timeout: request.options?.timeout || 900000,
        maxParallel: this.getMaxParallel(request.options?.parallelismLevel)
      });

      if (!executionResult.success) {
        throw new Error(executionResult.error || 'Graph execution failed');
      }

      this.emit('phase_started', { phase: 'completed', sessionId });

      const endTime = Date.now();
      const result: GraphNeuralResult = {
        success: true,
        sessionId,
        graph: graphResult.graph,
        results: executionResult.results,
        metrics: {
          totalExecutionTime: endTime - startTime,
          neuralEnrichmentOverhead: executionResult.metrics.neuralEnrichmentOverhead,
          networkEffects: this.calculateNetworkEffects(graphResult.graph),
          parallelismUtilization: this.calculateParallelismUtilization(graphResult.graph)
        }
      };

      this.emit('execution_completed', result);
      return result;

    } catch (error) {
      this.emit('phase_started', { phase: 'failed', sessionId, error });
      
      const result: GraphNeuralResult = {
        success: false,
        sessionId: sessionId || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('execution_failed', result);
      return result;
    } finally {
      if (sessionId) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get progress for active session
   */
  getProgress(sessionId: string): GraphNeuralProgress | null {
    const graph = this.activeSessions.get(sessionId);
    if (!graph) return null;

    const graphProgress = this.graphEngine.getProgress(sessionId);
    if (!graphProgress) return null;

    return {
      sessionId,
      phase: 'executing',
      currentNode: graphProgress.currentNode,
      completedNodes: graphProgress.completedNodes.length,
      totalNodes: graphProgress.totalNodes,
      progress: graphProgress.progress,
      networkMetrics: {
        enrichmentQuality: this.calculateEnrichmentQuality(graph),
        dependencyResolutionTime: graphProgress.networkMetrics.averageExecutionTime,
        parallelUtilization: graphProgress.networkMetrics.parallelismUtilization
      }
    };
  }

  /**
   * Stream progress updates for a session
   */
  async* streamProgress(sessionId: string): AsyncGenerator<GraphNeuralProgress> {
    while (this.activeSessions.has(sessionId)) {
      const progress = this.getProgress(sessionId);
      if (progress) {
        yield progress;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Cancel an active session
   */
  async cancel(sessionId: string): Promise<boolean> {
    const graph = this.activeSessions.get(sessionId);
    if (!graph) return false;

    // Cancel execution (this would need to be implemented in GraphFlowEngine)
    this.activeSessions.delete(sessionId);
    
    this.emit('session_cancelled', { sessionId });
    return true;
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    activeSessions: number;
    totalExecuted: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    return {
      activeSessions: this.activeSessions.size,
      totalExecuted: 0, // Would be tracked in a real implementation
      averageExecutionTime: 0, // Would be calculated from history
      successRate: 0.95 // Would be calculated from history
    };
  }

  /**
   * Setup event listeners for all components
   */
  private setupEventListeners(): void {
    // Graph engine events
    this.graphEngine.on('graph_execution_started', (data) => {
      this.emit('graph_execution_started', data);
    });

    this.graphEngine.on('node_started', (data) => {
      this.emit('node_started', data);
    });

    this.graphEngine.on('node_completed', (data) => {
      this.emit('node_completed', data);
    });

    this.graphEngine.on('node_failed', (data) => {
      this.emit('node_failed', data);
    });

    this.graphEngine.on('graph_execution_completed', (data) => {
      this.emit('graph_execution_completed', data);
    });

    this.graphEngine.on('graph_execution_failed', (data) => {
      this.emit('graph_execution_failed', data);
    });

    // Graph builder events
    this.graphBuilder.on('graph_analysis_started', (data) => {
      this.emit('graph_analysis_started', data);
    });

    this.graphBuilder.on('graph_build_completed', (data) => {
      this.emit('graph_build_completed', data);
    });

    // Output propagator events
    this.outputPropagator.on('output_parsed', (data) => {
      this.emit('output_parsed', data);
    });

    this.outputPropagator.on('propagation_completed', (data) => {
      this.emit('propagation_completed', data);
    });
  }

  /**
   * Calculate max parallel based on level
   */
  private getMaxParallel(level?: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 4;
      default: return 3;
    }
  }

  /**
   * Calculate network effects score
   */
  private calculateNetworkEffects(graph: ExecutionGraph): number {
    let effectsScore = 0;
    
    for (const [nodeId, node] of graph.nodes) {
      effectsScore += node.dependencies.length * 10; // Each dependency adds network effect
    }
    
    return effectsScore;
  }

  /**
   * Calculate parallelism utilization
   */
  private calculateParallelismUtilization(graph: ExecutionGraph): number {
    // Calculate how well the graph utilizes parallel execution
    const totalNodes = graph.nodes.size;
    const levels = this.calculateExecutionLevels(graph);
    const maxParallel = Math.max(...Array.from(levels.values()).map(nodeIds => nodeIds.length));
    
    return maxParallel / totalNodes;
  }

  /**
   * Calculate enrichment quality
   */
  private calculateEnrichmentQuality(graph: ExecutionGraph): number {
    let totalEnrichment = 0;
    let nodeCount = 0;
    
    for (const [nodeId, node] of graph.nodes) {
      totalEnrichment += node.dependencies.length * 0.2; // More dependencies = richer context
      nodeCount++;
    }
    
    return nodeCount > 0 ? Math.min(totalEnrichment / nodeCount, 1.0) : 0;
  }

  /**
   * Calculate execution levels for parallelism analysis
   */
  private calculateExecutionLevels(graph: ExecutionGraph): Map<number, string[]> {
    const levels = new Map<number, string[]>();
    const nodeMap = new Map<string, number>();
    
    const calculateLevel = (nodeId: string): number => {
      if (nodeMap.has(nodeId)) return nodeMap.get(nodeId)!;
      
      const node = graph.nodes.get(nodeId)!;
      if (node.dependencies.length === 0) {
        nodeMap.set(nodeId, 0);
        return 0;
      }
      
      const maxDepLevel = Math.max(...node.dependencies.map(calculateLevel));
      const level = maxDepLevel + 1;
      nodeMap.set(nodeId, level);
      return level;
    };
    
    // Calculate levels for all nodes
    for (const nodeId of graph.nodes.keys()) {
      const level = calculateLevel(nodeId);
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level)!.push(nodeId);
    }
    
    return levels;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.graphEngine.removeAllListeners();
    this.graphBuilder.removeAllListeners();
    this.outputPropagator.removeAllListeners();
    this.outputPropagator.clearCache();
    this.activeSessions.clear();
  }
}

// Export everything needed for the system
export {
  GraphFlowEngine,
  GraphBuilder,
  InputEnricher,
  OutputPropagator,
  ExecutionGraph,
  GraphNode,
  GraphBuilderRequest,
  EnrichmentContext,
  EnrichedPrompt,
  ParsedOutput,
  PropagationResult
};

// Example usage and testing utilities
export const createGraphNeuralExample = () => {
  const system = new GraphNeuralSystem();
  
  return {
    system,
    async runExample(query: string) {
      console.log(`🧠 Starting Graph-Neural coordination for: "${query}"`);
      
      const result = await system.execute({
        query,
        context: {
          repository: process.cwd(),
          framework: 'Next.js',
          language: 'TypeScript'
        },
        options: {
          mode: 'neural',
          maxNodes: 6,
          parallelismLevel: 'high',
          enableVisualization: true
        }
      });
      
      if (result.success) {
        console.log(`✅ Completed in ${result.metrics?.totalExecutionTime}ms`);
        console.log(`🔗 Network effects: ${result.metrics?.networkEffects}`);
        console.log(`⚡ Parallelism: ${Math.round((result.metrics?.parallelismUtilization || 0) * 100)}%`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
      
      return result;
    }
  };
};