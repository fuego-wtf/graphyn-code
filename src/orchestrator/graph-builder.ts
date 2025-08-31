/**
 * Graph Builder for Graph-Neural AI Coordination
 * 
 * Constructs dependency graphs from natural language queries by analyzing
 * requirements and creating optimal agent coordination workflows.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionGraph, GraphNode } from './graph-flow-engine.js';

export interface GraphBuilderRequest {
  query: string;
  context?: {
    repository?: string;
    framework?: string;
    language?: string;
    existingFiles?: string[];
    preferences?: UserPreferences;
  };
  constraints?: {
    maxNodes?: number;
    timeLimit?: number;
    agentRestrictions?: string[];
    parallelismLevel?: 'low' | 'medium' | 'high';
  };
  mode?: 'automatic' | 'guided' | 'template';
}

export interface UserPreferences {
  preferredAgents: string[];
  avoidAgents: string[];
  executionStyle: 'sequential' | 'parallel' | 'mixed';
  qualityLevel: 'fast' | 'balanced' | 'thorough';
  testingRequired: boolean;
  documentationRequired: boolean;
}

export interface GraphAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedNodes: number;
  criticalPath: string[];
  parallelizationOpportunities: number;
  riskFactors: string[];
  confidence: number;
}

export interface AgentCapability {
  agent: string;
  capabilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  estimatedDuration: number;
  confidence: number;
}

export interface GraphTemplate {
  name: string;
  description: string;
  pattern: string;
  nodes: Partial<GraphNode>[];
  applicabilityScore: number;
}

export interface GraphBuildResult {
  success: boolean;
  graph?: ExecutionGraph;
  analysis: GraphAnalysis;
  alternatives?: ExecutionGraph[];
  warnings: string[];
  recommendations: string[];
  error?: string;
}

export class GraphBuilder extends EventEmitter {
  private agentCapabilities: Map<string, AgentCapability> = new Map();
  private graphTemplates: GraphTemplate[] = [];
  private queryPatterns: Map<string, RegExp> = new Map();
  private dependencyRules: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.initializeAgentCapabilities();
    this.initializeGraphTemplates();
    this.initializeQueryPatterns();
    this.initializeDependencyRules();
  }

  /**
   * Build execution graph from natural language query
   */
  async buildGraph(request: GraphBuilderRequest): Promise<GraphBuildResult> {
    try {
      this.emit('graph_analysis_started', { query: request.query });

      // Step 1: Analyze the query
      const analysis = await this.analyzeQuery(request.query, request.context);
      
      // Step 2: Select appropriate agents
      const selectedAgents = await this.selectAgents(request, analysis);
      
      // Step 3: Build dependency graph
      const graph = await this.constructGraph(request, selectedAgents, analysis);
      
      // Step 4: Optimize the graph
      const optimizedGraph = await this.optimizeGraph(graph, request.constraints);
      
      // Step 5: Generate alternatives
      const alternatives = await this.generateAlternatives(optimizedGraph, request);
      
      // Step 6: Validate and provide recommendations
      const validation = this.validateGraph(optimizedGraph);
      
      this.emit('graph_build_completed', {
        query: request.query,
        nodeCount: optimizedGraph.nodes.size,
        analysis
      });

      return {
        success: true,
        graph: optimizedGraph,
        analysis,
        alternatives,
        warnings: validation.warnings,
        recommendations: validation.recommendations
      };

    } catch (error) {
      this.emit('graph_build_failed', {
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        analysis: {
          complexity: 'simple',
          estimatedNodes: 0,
          criticalPath: [],
          parallelizationOpportunities: 0,
          riskFactors: ['Build failed'],
          confidence: 0
        },
        warnings: [],
        recommendations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze query complexity and requirements
   */
  private async analyzeQuery(query: string, context?: GraphBuilderRequest['context']): Promise<GraphAnalysis> {
    const words = query.toLowerCase().split(/\s+/);
    const complexity = this.determineComplexity(query, words);
    const estimatedNodes = this.estimateNodeCount(query, complexity);
    const criticalPath = this.identifyCriticalPath(query, words);
    const parallelizationOpportunities = this.countParallelizationOpportunities(query);
    const riskFactors = this.identifyRiskFactors(query, context);
    const confidence = this.calculateAnalysisConfidence(query, context);

    return {
      complexity,
      estimatedNodes,
      criticalPath,
      parallelizationOpportunities,
      riskFactors,
      confidence
    };
  }

  /**
   * Determine query complexity
   */
  private determineComplexity(query: string, words: string[]): GraphAnalysis['complexity'] {
    let complexityScore = 0;

    // Keyword-based complexity indicators
    const complexityKeywords = {
      simple: ['create', 'add', 'fix', 'update', 'single'],
      moderate: ['implement', 'build', 'integrate', 'multiple', 'system'],
      complex: ['architecture', 'microservices', 'full-stack', 'scalable', 'enterprise'],
      enterprise: ['distributed', 'multi-tenant', 'high-availability', 'production-ready']
    };

    for (const [level, keywords] of Object.entries(complexityKeywords)) {
      const matches = keywords.filter(keyword => words.includes(keyword)).length;
      switch (level) {
        case 'simple': complexityScore += matches * 1; break;
        case 'moderate': complexityScore += matches * 2; break;
        case 'complex': complexityScore += matches * 3; break;
        case 'enterprise': complexityScore += matches * 4; break;
      }
    }

    // Length-based complexity
    if (query.length > 200) complexityScore += 2;
    if (query.length > 500) complexityScore += 3;

    // Multi-component detection
    if (words.some(w => ['and', 'also', 'including', 'with'].includes(w))) {
      complexityScore += 2;
    }

    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 8) return 'moderate';
    if (complexityScore <= 15) return 'complex';
    return 'enterprise';
  }

  /**
   * Estimate node count based on query and complexity
   */
  private estimateNodeCount(query: string, complexity: GraphAnalysis['complexity']): number {
    const baseEstimates = {
      simple: 2,
      moderate: 4,
      complex: 7,
      enterprise: 12
    };

    let estimate = baseEstimates[complexity];

    // Adjust based on explicit mentions
    const componentKeywords = ['frontend', 'backend', 'database', 'api', 'ui', 'test', 'deploy'];
    const mentionedComponents = componentKeywords.filter(keyword => 
      query.toLowerCase().includes(keyword)
    ).length;

    estimate += mentionedComponents;

    // Limit reasonable bounds
    return Math.min(Math.max(estimate, 1), 20);
  }

  /**
   * Identify critical path agents
   */
  private identifyCriticalPath(query: string, words: string[]): string[] {
    const path: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Common patterns for critical path identification
    if (lowerQuery.includes('architect') || lowerQuery.includes('design')) {
      path.push('architect');
    }

    if (lowerQuery.includes('api') || lowerQuery.includes('backend') || lowerQuery.includes('server')) {
      if (!path.includes('architect')) path.push('architect');
      path.push('backend');
    }

    if (lowerQuery.includes('ui') || lowerQuery.includes('frontend') || lowerQuery.includes('component')) {
      if (!path.includes('backend')) path.push('backend');
      path.push('frontend');
    }

    if (lowerQuery.includes('test') || lowerQuery.includes('quality')) {
      if (path.length === 0) path.push('architect');
      path.push('test-writer');
    }

    // Default minimal path
    if (path.length === 0) {
      return this.getDefaultPath(lowerQuery);
    }

    return path;
  }

  /**
   * Get default critical path based on query type
   */
  private getDefaultPath(lowerQuery: string): string[] {
    if (lowerQuery.includes('fix') || lowerQuery.includes('bug')) {
      return ['task-dispatcher', 'backend', 'test-writer'];
    }
    
    if (lowerQuery.includes('feature') || lowerQuery.includes('implement')) {
      return ['architect', 'backend', 'frontend'];
    }
    
    return ['architect', 'backend'];
  }

  /**
   * Count parallelization opportunities
   */
  private countParallelizationOpportunities(query: string): number {
    let opportunities = 0;
    const lowerQuery = query.toLowerCase();

    // Multiple components mentioned
    const components = ['frontend', 'backend', 'database', 'api', 'ui', 'tests'];
    const mentionedComponents = components.filter(c => lowerQuery.includes(c)).length;
    if (mentionedComponents > 1) opportunities += mentionedComponents - 1;

    // Multiple features mentioned
    if (lowerQuery.includes(' and ')) opportunities++;
    if (lowerQuery.includes('multiple')) opportunities++;
    if (lowerQuery.includes('several')) opportunities++;

    return opportunities;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(query: string, context?: GraphBuilderRequest['context']): string[] {
    const risks: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Complexity risks
    if (lowerQuery.includes('microservices') || lowerQuery.includes('distributed')) {
      risks.push('High architectural complexity');
    }

    if (lowerQuery.includes('migration') || lowerQuery.includes('refactor')) {
      risks.push('Legacy system integration challenges');
    }

    if (lowerQuery.includes('performance') || lowerQuery.includes('scalable')) {
      risks.push('Performance optimization requirements');
    }

    // Context-based risks
    if (!context?.repository) {
      risks.push('No repository context provided');
    }

    if (!context?.framework && (lowerQuery.includes('build') || lowerQuery.includes('create'))) {
      risks.push('Framework not specified');
    }

    // Timeline risks
    if (lowerQuery.includes('urgent') || lowerQuery.includes('quickly') || lowerQuery.includes('asap')) {
      risks.push('Tight timeline constraints');
    }

    return risks;
  }

  /**
   * Calculate analysis confidence
   */
  private calculateAnalysisConfidence(query: string, context?: GraphBuilderRequest['context']): number {
    let confidence = 0.5; // Base confidence

    // Query clarity
    if (query.length > 50) confidence += 0.1;
    if (query.length > 100) confidence += 0.1;

    // Context richness
    if (context?.repository) confidence += 0.1;
    if (context?.framework) confidence += 0.1;
    if (context?.language) confidence += 0.1;
    if (context?.existingFiles && context.existingFiles.length > 0) confidence += 0.1;

    // Specific requirements
    const specificWords = ['implement', 'create', 'build', 'add', 'integrate'];
    if (specificWords.some(word => query.toLowerCase().includes(word))) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Select appropriate agents for the task
   */
  private async selectAgents(request: GraphBuilderRequest, analysis: GraphAnalysis): Promise<string[]> {
    const agents = new Set<string>();
    const lowerQuery = request.query.toLowerCase();

    // Add critical path agents
    analysis.criticalPath.forEach(agent => agents.add(agent));

    // Add agents based on keywords
    const keywordAgentMap = {
      'architect': ['architecture', 'design', 'planning', 'structure'],
      'backend': ['api', 'server', 'database', 'backend', 'service'],
      'frontend': ['ui', 'frontend', 'component', 'interface', 'page'],
      'test-writer': ['test', 'testing', 'quality', 'coverage', 'spec'],
      'design': ['design', 'mockup', 'prototype', 'figma', 'sketch'],
      'cli': ['cli', 'command', 'terminal', 'script', 'tool'],
      'production-architect': ['deploy', 'production', 'ops', 'infrastructure', 'scaling']
    };

    for (const [agent, keywords] of Object.entries(keywordAgentMap)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        agents.add(agent);
      }
    }

    // Apply user preferences
    if (request.context?.preferences?.preferredAgents) {
      request.context.preferences.preferredAgents.forEach(agent => agents.add(agent));
    }

    if (request.context?.preferences?.avoidAgents) {
      request.context.preferences.avoidAgents.forEach(agent => agents.delete(agent));
    }

    // Apply constraints
    if (request.constraints?.agentRestrictions) {
      request.constraints.agentRestrictions.forEach(agent => agents.delete(agent));
    }

    // Ensure minimum viable set
    if (agents.size === 0) {
      agents.add('architect');
      agents.add('backend');
    }

    return Array.from(agents);
  }

  /**
   * Construct the execution graph
   */
  private async constructGraph(
    request: GraphBuilderRequest,
    selectedAgents: string[],
    analysis: GraphAnalysis
  ): Promise<ExecutionGraph> {
    const sessionId = `graph_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, string[]>();

    // Create nodes for each agent
    const agentTasks = await this.generateAgentTasks(request.query, selectedAgents);
    
    for (const [agent, task] of Object.entries(agentTasks)) {
      const nodeId = `${agent}_${uuidv4().substring(0, 8)}`;
      const dependencies = this.calculateNodeDependencies(agent, selectedAgents, nodes);
      
      const node: GraphNode = {
        id: nodeId,
        agent,
        task,
        dependencies,
        inputs: {},
        status: 'pending'
      };

      nodes.set(nodeId, node);
      
      // Update edges
      for (const depId of dependencies) {
        if (!edges.has(depId)) edges.set(depId, []);
        edges.get(depId)!.push(nodeId);
      }
    }

    return {
      id: uuidv4(),
      sessionId,
      nodes,
      edges,
      metadata: {
        query: request.query,
        totalNodes: nodes.size,
        completedNodes: 0,
        startTime: Date.now(),
        mode: 'neural'
      }
    };
  }

  /**
   * Generate specific tasks for each agent
   */
  private async generateAgentTasks(query: string, agents: string[]): Promise<Record<string, string>> {
    const tasks: Record<string, string> = {};
    
    const taskTemplates: Record<string, string> = {
      architect: `Design the architecture for: ${query}. Focus on system design, technology choices, and data flow.`,
      backend: `Implement the backend logic for: ${query}. Create APIs, business logic, and data management.`,
      frontend: `Build the user interface for: ${query}. Create components, pages, and user interactions.`,
      'test-writer': `Create comprehensive tests for: ${query}. Include unit tests, integration tests, and end-to-end tests.`,
      design: `Create UI/UX designs for: ${query}. Focus on user experience and visual design.`,
      cli: `Build command-line tools for: ${query}. Create developer-friendly CLI interfaces.`,
      'production-architect': `Plan production deployment for: ${query}. Focus on scalability, monitoring, and operations.`
    };

    for (const agent of agents) {
      const template = taskTemplates[agent];
      if (template) {
        tasks[agent] = template;
      } else {
        tasks[agent] = `Contribute your expertise to: ${query}`;
      }
    }

    return tasks;
  }

  /**
   * Calculate dependencies for a node
   */
  private calculateNodeDependencies(
    agent: string,
    allAgents: string[],
    existingNodes: Map<string, GraphNode>
  ): string[] {
    const dependencies: string[] = [];
    const dependencyRules = this.dependencyRules.get(agent) || [];
    
    for (const rule of dependencyRules) {
      if (allAgents.includes(rule)) {
        // Find the node ID for this agent
        for (const [nodeId, node] of existingNodes) {
          if (node.agent === rule) {
            dependencies.push(nodeId);
            break;
          }
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Optimize the graph for better execution
   */
  private async optimizeGraph(graph: ExecutionGraph, constraints?: GraphBuilderRequest['constraints']): Promise<ExecutionGraph> {
    // Clone the graph
    const optimized = JSON.parse(JSON.stringify({
      ...graph,
      nodes: Array.from(graph.nodes.entries()),
      edges: Array.from(graph.edges.entries())
    }));
    
    optimized.nodes = new Map(optimized.nodes);
    optimized.edges = new Map(optimized.edges);

    // Apply parallelization optimizations
    if (constraints?.parallelismLevel === 'high') {
      this.maximizeParallelism(optimized);
    }

    // Apply time constraints
    if (constraints?.maxNodes && optimized.nodes.size > constraints.maxNodes) {
      this.reduceNodeCount(optimized, constraints.maxNodes);
    }

    return optimized;
  }

  /**
   * Maximize parallelism in graph
   */
  private maximizeParallelism(graph: ExecutionGraph): void {
    // Find nodes that can be parallelized
    const independentNodes: string[] = [];
    
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.length === 0) {
        independentNodes.push(nodeId);
      }
    }

    // Reduce dependencies where safe
    for (const [nodeId, node] of graph.nodes) {
      if (node.agent === 'frontend' && node.dependencies.some(dep => {
        const depNode = Array.from(graph.nodes.values()).find(n => n.id === dep);
        return depNode?.agent === 'backend';
      })) {
        // Frontend can start with partial backend info
        node.dependencies = node.dependencies.filter(dep => {
          const depNode = Array.from(graph.nodes.values()).find(n => n.id === dep);
          return depNode?.agent !== 'backend';
        });
      }
    }
  }

  /**
   * Reduce node count to meet constraints
   */
  private reduceNodeCount(graph: ExecutionGraph, maxNodes: number): void {
    const currentCount = graph.nodes.size;
    const toRemove = currentCount - maxNodes;

    if (toRemove <= 0) return;

    // Prioritize removal of optional nodes
    const removalPriority = ['design', 'cli', 'production-architect', 'test-writer'];
    let removed = 0;

    for (const agentType of removalPriority) {
      if (removed >= toRemove) break;

      for (const [nodeId, node] of graph.nodes) {
        if (node.agent === agentType && removed < toRemove) {
          graph.nodes.delete(nodeId);
          graph.edges.delete(nodeId);
          
          // Remove from other nodes' dependencies
          for (const [, otherNode] of graph.nodes) {
            otherNode.dependencies = otherNode.dependencies.filter(dep => dep !== nodeId);
          }
          
          removed++;
        }
      }
    }
  }

  /**
   * Generate alternative graph configurations
   */
  private async generateAlternatives(graph: ExecutionGraph, request: GraphBuilderRequest): Promise<ExecutionGraph[]> {
    const alternatives: ExecutionGraph[] = [];

    // Sequential alternative
    if (graph.metadata.mode !== 'sequential') {
      const sequential = await this.createSequentialAlternative(graph);
      alternatives.push(sequential);
    }

    // Parallel alternative
    if (graph.metadata.mode !== 'parallel') {
      const parallel = await this.createParallelAlternative(graph);
      alternatives.push(parallel);
    }

    // Minimal alternative
    const minimal = await this.createMinimalAlternative(graph, request);
    alternatives.push(minimal);

    return alternatives;
  }

  /**
   * Create sequential execution alternative
   */
  private async createSequentialAlternative(originalGraph: ExecutionGraph): Promise<ExecutionGraph> {
    const sequential = { ...originalGraph };
    sequential.id = uuidv4();
    sequential.metadata = { ...originalGraph.metadata, mode: 'sequential' as const };
    
    // Convert to strict sequential dependencies
    const nodeIds = Array.from(originalGraph.nodes.keys());
    const agents = nodeIds.map(id => originalGraph.nodes.get(id)!.agent);
    
    // Create new dependency chain
    const newNodes = new Map<string, GraphNode>();
    const newEdges = new Map<string, string[]>();
    
    for (let i = 0; i < nodeIds.length; i++) {
      const originalNode = originalGraph.nodes.get(nodeIds[i])!;
      const newNode = { ...originalNode };
      
      if (i > 0) {
        newNode.dependencies = [nodeIds[i - 1]];
      } else {
        newNode.dependencies = [];
      }
      
      newNodes.set(nodeIds[i], newNode);
      
      if (i < nodeIds.length - 1) {
        newEdges.set(nodeIds[i], [nodeIds[i + 1]]);
      }
    }
    
    sequential.nodes = newNodes;
    sequential.edges = newEdges;
    
    return sequential;
  }

  /**
   * Create parallel execution alternative
   */
  private async createParallelAlternative(originalGraph: ExecutionGraph): Promise<ExecutionGraph> {
    const parallel = { ...originalGraph };
    parallel.id = uuidv4();
    parallel.metadata = { ...originalGraph.metadata, mode: 'parallel' as const };
    
    // Minimize dependencies for maximum parallelism
    const newNodes = new Map<string, GraphNode>();
    
    for (const [nodeId, node] of originalGraph.nodes) {
      const newNode = { ...node };
      
      // Only keep critical dependencies (architect for all others)
      if (node.agent !== 'architect') {
        const architectNode = Array.from(originalGraph.nodes.values())
          .find(n => n.agent === 'architect');
        
        if (architectNode) {
          newNode.dependencies = [architectNode.id];
        } else {
          newNode.dependencies = [];
        }
      } else {
        newNode.dependencies = [];
      }
      
      newNodes.set(nodeId, newNode);
    }
    
    parallel.nodes = newNodes;
    
    return parallel;
  }

  /**
   * Create minimal execution alternative
   */
  private async createMinimalAlternative(originalGraph: ExecutionGraph, request: GraphBuilderRequest): Promise<ExecutionGraph> {
    const minimal = { ...originalGraph };
    minimal.id = uuidv4();
    minimal.metadata = { ...originalGraph.metadata };
    
    // Keep only essential agents
    const essentialAgents = ['architect', 'backend'];
    const newNodes = new Map<string, GraphNode>();
    const newEdges = new Map<string, string[]>();
    
    for (const [nodeId, node] of originalGraph.nodes) {
      if (essentialAgents.includes(node.agent)) {
        const newNode = { ...node };
        // Update dependencies to only reference remaining nodes
        newNode.dependencies = node.dependencies.filter(depId => 
          Array.from(originalGraph.nodes.values())
            .find(n => n.id === depId && essentialAgents.includes(n.agent))
        );
        
        newNodes.set(nodeId, newNode);
      }
    }
    
    minimal.nodes = newNodes;
    minimal.edges = newEdges;
    minimal.metadata.totalNodes = newNodes.size;
    
    return minimal;
  }

  /**
   * Validate graph structure and provide recommendations
   */
  private validateGraph(graph: ExecutionGraph): { warnings: string[]; recommendations: string[] } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for circular dependencies
    if (this.hasCircularDependencies(graph)) {
      warnings.push('Circular dependencies detected in graph');
    }

    // Check for disconnected nodes
    const disconnected = this.findDisconnectedNodes(graph);
    if (disconnected.length > 0) {
      warnings.push(`${disconnected.length} disconnected nodes found`);
    }

    // Check complexity
    if (graph.nodes.size > 10) {
      recommendations.push('Consider breaking down into smaller sub-graphs');
    }

    // Check parallelization
    const parallelizableNodes = this.countParallelizableNodes(graph);
    if (parallelizableNodes > 2) {
      recommendations.push(`${parallelizableNodes} nodes can run in parallel for faster execution`);
    }

    return { warnings, recommendations };
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(graph: ExecutionGraph): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.nodes.keys()) {
      if (dfs(nodeId)) return true;
    }

    return false;
  }

  /**
   * Find disconnected nodes
   */
  private findDisconnectedNodes(graph: ExecutionGraph): string[] {
    const connected = new Set<string>();
    const queue: string[] = [];

    // Find root nodes (no dependencies)
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.length === 0) {
        queue.push(nodeId);
        connected.add(nodeId);
      }
    }

    // BFS to find all connected nodes
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const dependents = graph.edges.get(nodeId) || [];
      
      for (const dependentId of dependents) {
        if (!connected.has(dependentId)) {
          connected.add(dependentId);
          queue.push(dependentId);
        }
      }
    }

    // Return disconnected nodes
    const allNodes = Array.from(graph.nodes.keys());
    return allNodes.filter(nodeId => !connected.has(nodeId));
  }

  /**
   * Count nodes that can run in parallel
   */
  private countParallelizableNodes(graph: ExecutionGraph): number {
    const levels = new Map<string, number>();
    
    // Calculate execution levels
    const calculateLevel = (nodeId: string): number => {
      if (levels.has(nodeId)) return levels.get(nodeId)!;
      
      const node = graph.nodes.get(nodeId)!;
      if (node.dependencies.length === 0) {
        levels.set(nodeId, 0);
        return 0;
      }
      
      const maxDepLevel = Math.max(...node.dependencies.map(calculateLevel));
      const level = maxDepLevel + 1;
      levels.set(nodeId, level);
      return level;
    };
    
    // Calculate levels for all nodes
    for (const nodeId of graph.nodes.keys()) {
      calculateLevel(nodeId);
    }
    
    // Count nodes that can run in parallel (same level)
    const levelCounts = new Map<number, number>();
    for (const level of levels.values()) {
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }
    
    return Math.max(...Array.from(levelCounts.values()));
  }

  /**
   * Initialize agent capabilities
   */
  private initializeAgentCapabilities(): void {
    const capabilities: Record<string, Omit<AgentCapability, 'agent'>> = {
      architect: {
        capabilities: ['system-design', 'technology-selection', 'architecture-planning'],
        inputs: ['requirements', 'constraints', 'context'],
        outputs: ['architecture-decisions', 'data-models', 'tech-stack'],
        dependencies: [],
        estimatedDuration: 300000, // 5 minutes
        confidence: 0.9
      },
      backend: {
        capabilities: ['api-development', 'business-logic', 'data-management'],
        inputs: ['architecture-decisions', 'data-models', 'requirements'],
        outputs: ['api-endpoints', 'services', 'data-layer'],
        dependencies: ['architect'],
        estimatedDuration: 600000, // 10 minutes
        confidence: 0.85
      },
      frontend: {
        capabilities: ['ui-development', 'user-experience', 'client-side-logic'],
        inputs: ['api-endpoints', 'design-requirements', 'user-flows'],
        outputs: ['components', 'pages', 'user-interfaces'],
        dependencies: ['backend'],
        estimatedDuration: 480000, // 8 minutes
        confidence: 0.8
      },
      'test-writer': {
        capabilities: ['test-automation', 'quality-assurance', 'coverage-analysis'],
        inputs: ['implementation', 'requirements', 'test-scenarios'],
        outputs: ['test-suites', 'test-reports', 'coverage-metrics'],
        dependencies: ['backend', 'frontend'],
        estimatedDuration: 420000, // 7 minutes
        confidence: 0.85
      }
    };

    for (const [agent, capability] of Object.entries(capabilities)) {
      this.agentCapabilities.set(agent, { agent, ...capability });
    }
  }

  /**
   * Initialize graph templates
   */
  private initializeGraphTemplates(): void {
    this.graphTemplates = [
      {
        name: 'Full-Stack Feature',
        description: 'Complete feature with backend API and frontend UI',
        pattern: 'architect -> backend -> frontend -> test-writer',
        nodes: [
          { agent: 'architect', task: 'Design feature architecture' },
          { agent: 'backend', task: 'Implement API endpoints' },
          { agent: 'frontend', task: 'Build user interface' },
          { agent: 'test-writer', task: 'Create test suite' }
        ],
        applicabilityScore: 0
      },
      {
        name: 'Backend Service',
        description: 'Pure backend service implementation',
        pattern: 'architect -> backend -> test-writer',
        nodes: [
          { agent: 'architect', task: 'Design service architecture' },
          { agent: 'backend', task: 'Implement service logic' },
          { agent: 'test-writer', task: 'Create service tests' }
        ],
        applicabilityScore: 0
      },
      {
        name: 'Frontend Component',
        description: 'UI component development',
        pattern: 'frontend -> test-writer',
        nodes: [
          { agent: 'frontend', task: 'Build component' },
          { agent: 'test-writer', task: 'Create component tests' }
        ],
        applicabilityScore: 0
      }
    ];
  }

  /**
   * Initialize query patterns
   */
  private initializeQueryPatterns(): void {
    this.queryPatterns.set('full-stack', /build|create|implement.*(?:app|application|system|platform)/i);
    this.queryPatterns.set('backend', /(?:api|service|backend|server)(?!.*frontend)/i);
    this.queryPatterns.set('frontend', /(?:ui|frontend|interface|component)(?!.*backend)/i);
    this.queryPatterns.set('fix', /fix|bug|issue|error|problem/i);
    this.queryPatterns.set('test', /test|testing|quality|coverage/i);
  }

  /**
   * Initialize dependency rules
   */
  private initializeDependencyRules(): void {
    this.dependencyRules.set('architect', []);
    this.dependencyRules.set('backend', ['architect']);
    this.dependencyRules.set('frontend', ['architect', 'backend']);
    this.dependencyRules.set('test-writer', ['backend', 'frontend']);
    this.dependencyRules.set('design', []);
    this.dependencyRules.set('cli', ['backend']);
    this.dependencyRules.set('production-architect', ['backend', 'frontend', 'test-writer']);
  }
}