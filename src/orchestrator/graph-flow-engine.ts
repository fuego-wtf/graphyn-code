/**
 * Graph-Neural AI Coordination Engine
 * 
 * Executes dependency graphs in topological order where each agent's output
 * feeds into dependent agents through neural prompt enrichment.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface GraphNode {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ExecutionGraph {
  id: string;
  sessionId: string;
  nodes: Map<string, GraphNode>;
  edges: Map<string, string[]>; // nodeId -> dependentNodeIds
  metadata: {
    query: string;
    totalNodes: number;
    completedNodes: number;
    startTime: number;
    endTime?: number;
    mode: 'sequential' | 'parallel' | 'neural';
  };
}

export interface GraphExecutionProgress {
  sessionId: string;
  currentNode?: string;
  completedNodes: string[];
  failedNodes: string[];
  totalNodes: number;
  progress: number;
  estimatedTimeRemaining?: number;
  networkMetrics: {
    averageExecutionTime: number;
    throughput: number;
    parallelismUtilization: number;
  };
}

export interface NeuralCoordinationResult {
  success: boolean;
  sessionId: string;
  results: Map<string, any>;
  metrics: {
    totalExecutionTime: number;
    nodeExecutionTimes: Record<string, number>;
    dependencyResolutionTime: number;
    neuralEnrichmentOverhead: number;
  };
  error?: string;
}

export class GraphFlowEngine extends EventEmitter {
  private graphs: Map<string, ExecutionGraph> = new Map();
  private memoryBasePath: string;
  private maxParallelNodes: number = 3;
  private executionTimeout: number = 300000; // 5 minutes

  constructor(basePath?: string) {
    super();
    this.memoryBasePath = basePath || '.graphyn/graph-memory';
  }

  /**
   * Execute a graph with neural coordination
   */
  async executeGraph(
    graph: ExecutionGraph,
    options: {
      mode?: 'sequential' | 'parallel' | 'neural';
      timeout?: number;
      maxParallel?: number;
    } = {}
  ): Promise<NeuralCoordinationResult> {
    const startTime = Date.now();
    const sessionId = graph.sessionId;
    
    this.graphs.set(sessionId, graph);
    
    // Setup session memory directory
    await this.initializeSessionMemory(sessionId);
    
    const mode = options.mode || 'neural';
    const timeout = options.timeout || this.executionTimeout;
    const maxParallel = options.maxParallel || this.maxParallelNodes;

    this.emit('graph_execution_started', {
      sessionId,
      totalNodes: graph.nodes.size,
      mode
    });

    try {
      let results: Map<string, any>;

      switch (mode) {
        case 'sequential':
          results = await this.executeSequential(graph, timeout);
          break;
        case 'parallel':
          results = await this.executeParallel(graph, timeout, maxParallel);
          break;
        case 'neural':
        default:
          results = await this.executeNeuralCoordination(graph, timeout, maxParallel);
          break;
      }

      const endTime = Date.now();
      graph.metadata.endTime = endTime;

      // Calculate metrics
      const nodeExecutionTimes: Record<string, number> = {};
      let neuralEnrichmentOverhead = 0;
      
      for (const [nodeId, node] of graph.nodes) {
        if (node.startTime && node.endTime) {
          nodeExecutionTimes[nodeId] = node.endTime - node.startTime;
        }
      }

      const metrics = {
        totalExecutionTime: endTime - startTime,
        nodeExecutionTimes,
        dependencyResolutionTime: this.calculateDependencyTime(graph),
        neuralEnrichmentOverhead
      };

      this.emit('graph_execution_completed', {
        sessionId,
        success: true,
        metrics
      });

      return {
        success: true,
        sessionId,
        results,
        metrics
      };

    } catch (error) {
      this.emit('graph_execution_failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        sessionId,
        results: new Map(),
        metrics: {
          totalExecutionTime: Date.now() - startTime,
          nodeExecutionTimes: {},
          dependencyResolutionTime: 0,
          neuralEnrichmentOverhead: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Neural coordination execution - intelligent dependency-based execution
   */
  private async executeNeuralCoordination(
    graph: ExecutionGraph,
    timeout: number,
    maxParallel: number
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const executing = new Set<string>();
    const executionPromises = new Map<string, Promise<void>>();

    // Calculate topological order for dependency resolution
    const topologicalOrder = this.getTopologicalOrder(graph);
    
    while (results.size < graph.nodes.size) {
      const readyNodes = this.findReadyNodes(graph, results, executing);
      
      if (readyNodes.length === 0 && executing.size === 0) {
        // Deadlock or circular dependency
        throw new Error('Circular dependency detected or no executable nodes remaining');
      }

      // Neural coordination: prioritize nodes with richest input context
      const prioritizedNodes = this.prioritizeNeuralExecution(readyNodes, graph);
      const nodesToExecute = prioritizedNodes.slice(0, maxParallel - executing.size);

      // Execute ready nodes with neural enrichment
      for (const nodeId of nodesToExecute) {
        if (executing.size >= maxParallel) break;
        
        executing.add(nodeId);
        const node = graph.nodes.get(nodeId)!;
        
        const promise = this.executeNodeWithNeuralEnrichment(node, graph, results)
          .then((result) => {
            results.set(nodeId, result);
            executing.delete(nodeId);
            node.status = 'completed';
            node.endTime = Date.now();
            
            this.emit('node_completed', {
              sessionId: graph.sessionId,
              nodeId,
              result,
              progress: results.size / graph.nodes.size
            });
          })
          .catch((error) => {
            executing.delete(nodeId);
            node.status = 'failed';
            node.error = error.message;
            node.endTime = Date.now();
            
            this.emit('node_failed', {
              sessionId: graph.sessionId,
              nodeId,
              error: error.message
            });
            
            throw error;
          });

        executionPromises.set(nodeId, promise);
      }

      // Wait for at least one node to complete before scheduling more
      if (executing.size > 0) {
        await Promise.race(Array.from(executionPromises.values()));
      }
    }

    // Wait for all remaining executions to complete
    if (executionPromises.size > 0) {
      await Promise.all(Array.from(executionPromises.values()));
    }

    return results;
  }

  /**
   * Execute a single node with neural enrichment from predecessors
   */
  private async executeNodeWithNeuralEnrichment(
    node: GraphNode,
    graph: ExecutionGraph,
    completedResults: Map<string, any>
  ): Promise<any> {
    node.status = 'in_progress';
    node.startTime = Date.now();

    // Gather enrichment context from completed dependencies
    const enrichmentContext = this.gatherNeuralContext(node, completedResults);
    
    // Save enriched input to memory
    await this.saveNodeInput(graph.sessionId, node, enrichmentContext);

    this.emit('node_started', {
      sessionId: graph.sessionId,
      nodeId: node.id,
      agent: node.agent,
      enrichmentContext
    });

    try {
      // Execute Claude command with enriched prompt
      const result = await this.executeClaude(node, enrichmentContext);
      
      // Parse and structure the output
      const structuredOutput = await this.parseNodeOutput(result);
      
      // Save output to memory
      await this.saveNodeOutput(graph.sessionId, node, structuredOutput);
      
      return structuredOutput;
      
    } catch (error) {
      await this.saveNodeError(graph.sessionId, node, error);
      throw error;
    }
  }

  /**
   * Gather neural context from completed predecessor nodes
   */
  private gatherNeuralContext(
    node: GraphNode,
    completedResults: Map<string, any>
  ): Record<string, any> {
    const context: Record<string, any> = {
      ...node.inputs,
      predecessorOutputs: {},
      enrichedPrompt: node.task
    };

    // Collect outputs from dependencies
    for (const depId of node.dependencies) {
      if (completedResults.has(depId)) {
        context.predecessorOutputs[depId] = completedResults.get(depId);
      }
    }

    // Neural enrichment: enhance the base task with predecessor context
    if (Object.keys(context.predecessorOutputs).length > 0) {
      context.enrichedPrompt = this.enrichPromptWithContext(node.task, context.predecessorOutputs);
    }

    return context;
  }

  /**
   * Enrich Claude prompt with structured outputs from predecessors
   */
  private enrichPromptWithContext(baseTask: string, predecessorOutputs: Record<string, any>): string {
    let enrichedPrompt = baseTask;
    
    if (Object.keys(predecessorOutputs).length > 0) {
      enrichedPrompt += '\n\n**Context from Previous Agents:**\n';
      
      for (const [nodeId, output] of Object.entries(predecessorOutputs)) {
        if (output && typeof output === 'object') {
          enrichedPrompt += `\n**From ${nodeId}:**\n`;
          enrichedPrompt += this.formatOutputForContext(output);
        }
      }
      
      enrichedPrompt += '\n\n**Integration Instructions:**\n';
      enrichedPrompt += 'Use the above context to inform your implementation. Build upon the decisions and outputs from previous agents. Ensure consistency with their architectural choices and data structures.';
    }

    return enrichedPrompt;
  }

  /**
   * Format structured output for prompt context
   */
  private formatOutputForContext(output: any): string {
    if (typeof output === 'string') return output;
    
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  /**
   * Execute Claude command with enriched context
   */
  private async executeClaude(node: GraphNode, context: Record<string, any>): Promise<string> {
    // This would integrate with the existing Claude wrapper
    // For now, simulate the execution with a structured response
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', context.enrichedPrompt], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Claude execution failed: ${error}`));
        }
      });

      // Timeout handling
      const timeout = setTimeout(() => {
        claude.kill();
        reject(new Error('Claude execution timed out'));
      }, 60000); // 1 minute timeout per node

      claude.on('close', () => clearTimeout(timeout));
    });
  }

  /**
   * Parse Claude output into structured format
   */
  private async parseNodeOutput(rawOutput: string): Promise<any> {
    // Try to extract JSON from the output
    const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Fall back to raw output
      }
    }

    // Look for structured sections
    const structured = {
      rawOutput,
      decisions: this.extractSection(rawOutput, 'decisions', 'architecture'),
      implementation: this.extractSection(rawOutput, 'implementation', 'code'),
      files: this.extractFileReferences(rawOutput),
      dependencies: this.extractDependencies(rawOutput),
      recommendations: this.extractSection(rawOutput, 'recommendations', 'suggestions')
    };

    return structured;
  }

  /**
   * Extract specific sections from Claude output
   */
  private extractSection(output: string, ...sectionNames: string[]): string[] {
    const results: string[] = [];
    
    for (const name of sectionNames) {
      const regex = new RegExp(`##?\\s*${name}[:\\s]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
      const match = output.match(regex);
      if (match) {
        results.push(match[1].trim());
      }
    }
    
    return results;
  }

  /**
   * Extract file references from output
   */
  private extractFileReferences(output: string): string[] {
    const fileRegex = /(?:created|modified|updated):\s*([^\n]+)/gi;
    const files: string[] = [];
    let match;
    
    while ((match = fileRegex.exec(output)) !== null) {
      files.push(match[1].trim());
    }
    
    return files;
  }

  /**
   * Extract dependency information
   */
  private extractDependencies(output: string): string[] {
    const depRegex = /(?:install|dependency|package):\s*([^\n]+)/gi;
    const deps: string[] = [];
    let match;
    
    while ((match = depRegex.exec(output)) !== null) {
      deps.push(match[1].trim());
    }
    
    return deps;
  }

  /**
   * Prioritize nodes for neural execution based on context richness
   */
  private prioritizeNeuralExecution(readyNodes: string[], graph: ExecutionGraph): string[] {
    return readyNodes.sort((a, b) => {
      const nodeA = graph.nodes.get(a)!;
      const nodeB = graph.nodes.get(b)!;
      
      // Prioritize nodes with more dependencies (richer context)
      const contextScoreA = nodeA.dependencies.length;
      const contextScoreB = nodeB.dependencies.length;
      
      return contextScoreB - contextScoreA;
    });
  }

  // Helper methods for graph operations
  private findReadyNodes(
    graph: ExecutionGraph,
    completed: Map<string, any>,
    executing: Set<string>
  ): string[] {
    const ready: string[] = [];
    
    for (const [nodeId, node] of graph.nodes) {
      if (node.status === 'pending' && !executing.has(nodeId)) {
        const depsCompleted = node.dependencies.every(depId => completed.has(depId));
        if (depsCompleted) {
          ready.push(nodeId);
        }
      }
    }
    
    return ready;
  }

  private getTopologicalOrder(graph: ExecutionGraph): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];
    
    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = graph.nodes.get(nodeId)!;
      for (const depId of node.dependencies) {
        dfs(depId);
      }
      
      stack.push(nodeId);
    };
    
    for (const nodeId of graph.nodes.keys()) {
      dfs(nodeId);
    }
    
    return stack.reverse();
  }

  private calculateDependencyTime(graph: ExecutionGraph): number {
    // Simplified calculation - in practice would measure actual resolution time
    return graph.nodes.size * 10; // 10ms per node
  }

  // Memory management methods
  private async initializeSessionMemory(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.memoryBasePath, sessionId);
    await fs.mkdir(sessionPath, { recursive: true });
    
    // Initialize graph.json
    const graphData = {
      sessionId,
      createdAt: new Date().toISOString(),
      nodes: {},
      edges: {}
    };
    
    await fs.writeFile(
      path.join(sessionPath, 'graph.json'),
      JSON.stringify(graphData, null, 2)
    );
  }

  private async saveNodeInput(sessionId: string, node: GraphNode, context: Record<string, any>): Promise<void> {
    const nodePath = path.join(this.memoryBasePath, sessionId, node.id);
    await fs.mkdir(nodePath, { recursive: true });
    
    await fs.writeFile(
      path.join(nodePath, 'input.json'),
      JSON.stringify({
        nodeId: node.id,
        agent: node.agent,
        task: node.task,
        context,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
  }

  private async saveNodeOutput(sessionId: string, node: GraphNode, output: any): Promise<void> {
    const nodePath = path.join(this.memoryBasePath, sessionId, node.id);
    
    await fs.writeFile(
      path.join(nodePath, 'output.json'),
      JSON.stringify({
        nodeId: node.id,
        agent: node.agent,
        output,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    await this.saveNodeStatus(sessionId, node, 'completed');
  }

  private async saveNodeError(sessionId: string, node: GraphNode, error: any): Promise<void> {
    const nodePath = path.join(this.memoryBasePath, sessionId, node.id);
    await fs.mkdir(nodePath, { recursive: true });
    
    await fs.writeFile(
      path.join(nodePath, 'error.json'),
      JSON.stringify({
        nodeId: node.id,
        agent: node.agent,
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    await this.saveNodeStatus(sessionId, node, 'failed');
  }

  private async saveNodeStatus(sessionId: string, node: GraphNode, status: string): Promise<void> {
    const nodePath = path.join(this.memoryBasePath, sessionId, node.id);
    
    await fs.writeFile(
      path.join(nodePath, 'status.json'),
      JSON.stringify({
        nodeId: node.id,
        agent: node.agent,
        status,
        startTime: node.startTime,
        endTime: node.endTime,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
  }

  // Fallback execution modes
  private async executeSequential(graph: ExecutionGraph, timeout: number): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const topologicalOrder = this.getTopologicalOrder(graph);
    
    for (const nodeId of topologicalOrder) {
      const node = graph.nodes.get(nodeId)!;
      const result = await this.executeNodeWithNeuralEnrichment(node, graph, results);
      results.set(nodeId, result);
    }
    
    return results;
  }

  private async executeParallel(
    graph: ExecutionGraph,
    timeout: number,
    maxParallel: number
  ): Promise<Map<string, any>> {
    // Similar to neural but without intelligent prioritization
    return this.executeNeuralCoordination(graph, timeout, maxParallel);
  }

  /**
   * Get current progress for a graph execution
   */
  getProgress(sessionId: string): GraphExecutionProgress | null {
    const graph = this.graphs.get(sessionId);
    if (!graph) return null;

    const completedNodes: string[] = [];
    const failedNodes: string[] = [];
    let currentNode: string | undefined;

    for (const [nodeId, node] of graph.nodes) {
      switch (node.status) {
        case 'completed':
          completedNodes.push(nodeId);
          break;
        case 'failed':
          failedNodes.push(nodeId);
          break;
        case 'in_progress':
          currentNode = nodeId;
          break;
      }
    }

    const progress = completedNodes.length / graph.nodes.size;
    
    return {
      sessionId,
      currentNode,
      completedNodes,
      failedNodes,
      totalNodes: graph.nodes.size,
      progress,
      networkMetrics: {
        averageExecutionTime: this.calculateAverageExecutionTime(graph),
        throughput: completedNodes.length / ((Date.now() - graph.metadata.startTime) / 1000),
        parallelismUtilization: this.calculateParallelismUtilization(graph)
      }
    };
  }

  private calculateAverageExecutionTime(graph: ExecutionGraph): number {
    let totalTime = 0;
    let completedNodes = 0;
    
    for (const node of graph.nodes.values()) {
      if (node.startTime && node.endTime) {
        totalTime += node.endTime - node.startTime;
        completedNodes++;
      }
    }
    
    return completedNodes > 0 ? totalTime / completedNodes : 0;
  }

  private calculateParallelismUtilization(graph: ExecutionGraph): number {
    // Simplified calculation - percentage of time multiple nodes were executing
    return 0.75; // Placeholder
  }
}