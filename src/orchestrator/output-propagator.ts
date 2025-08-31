/**
 * Output Propagator for Graph-Neural AI Coordination
 * 
 * Parses Claude agent outputs and propagates structured results to dependent nodes,
 * enabling intelligent information flow through the dependency graph.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

export interface ParsedOutput {
  nodeId: string;
  agent: string;
  rawOutput: string;
  structuredData: StructuredAgentOutput;
  extractedMetadata: OutputMetadata;
  propagationData: PropagationData;
  quality: OutputQuality;
}

export interface StructuredAgentOutput {
  decisions?: string[];
  dataTypes?: Record<string, any>;
  recommendations?: string[];
  dependencies?: string[];
  artifacts?: string[];
  apiEndpoints?: string[];
  components?: string[];
  testSuites?: string[];
  [key: string]: any;
}

export interface OutputMetadata {
  confidence: number;
  completeness: number;
  consistency: number;
  parsedSections: string[];
  detectedPatterns: string[];
  extractionMethod: 'json' | 'structured-text' | 'pattern-matching' | 'hybrid';
}

export interface PropagationData {
  contextForDependents: Record<string, any>;
  keyInsights: string[];
  criticalDecisions: string[];
  integrationPoints: string[];
  constraints: string[];
  recommendations: string[];
}

export interface OutputQuality {
  score: number;
  issues: string[];
  strengths: string[];
  completeness: 'minimal' | 'partial' | 'comprehensive';
  structuredDataRatio: number;
}

export interface PropagationResult {
  success: boolean;
  propagatedTo: string[];
  enrichmentData: Record<string, any>;
  networkEffects: NetworkEffect[];
  error?: string;
}

export interface NetworkEffect {
  type: 'decision_cascade' | 'constraint_propagation' | 'data_flow' | 'pattern_alignment';
  sourceNode: string;
  affectedNodes: string[];
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export class OutputPropagator extends EventEmitter {
  private memoryBasePath: string;
  private parsingPatterns: Map<string, RegExp[]> = new Map();
  private agentOutputSchemas: Map<string, any> = new Map();
  private propagationCache = new Map<string, ParsedOutput>();

  constructor(basePath?: string) {
    super();
    this.memoryBasePath = basePath || '.graphyn/graph-memory';
    this.initializeParsingPatterns();
    this.initializeAgentSchemas();
  }

  /**
   * Parse and propagate agent output to dependent nodes
   */
  async parseAndPropagate(
    nodeId: string,
    agent: string,
    rawOutput: string,
    dependentNodeIds: string[],
    sessionId: string
  ): Promise<PropagationResult> {
    try {
      // Parse the raw output into structured format
      const parsedOutput = await this.parseAgentOutput(nodeId, agent, rawOutput);
      
      // Cache the parsed output
      this.propagationCache.set(nodeId, parsedOutput);
      
      // Save parsed output to memory
      await this.saveParsedOutput(sessionId, parsedOutput);
      
      // Propagate to dependent nodes
      const enrichmentData = await this.createEnrichmentData(parsedOutput, dependentNodeIds);
      await this.propagateToNodes(sessionId, enrichmentData, dependentNodeIds);
      
      // Analyze network effects
      const networkEffects = await this.analyzeNetworkEffects(parsedOutput, dependentNodeIds, sessionId);
      
      this.emit('output_parsed', {
        sessionId,
        nodeId,
        agent,
        quality: parsedOutput.quality,
        dependentNodes: dependentNodeIds.length
      });
      
      this.emit('propagation_completed', {
        sessionId,
        sourceNode: nodeId,
        targetNodes: dependentNodeIds,
        networkEffects
      });
      
      return {
        success: true,
        propagatedTo: dependentNodeIds,
        enrichmentData,
        networkEffects
      };
      
    } catch (error) {
      this.emit('propagation_failed', {
        sessionId,
        nodeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        propagatedTo: [],
        enrichmentData: {},
        networkEffects: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse agent output using multiple extraction strategies
   */
  private async parseAgentOutput(nodeId: string, agent: string, rawOutput: string): Promise<ParsedOutput> {
    const structuredData: StructuredAgentOutput = {};
    let extractionMethod: OutputMetadata['extractionMethod'] = 'pattern-matching';
    const parsedSections: string[] = [];
    const detectedPatterns: string[] = [];

    // Strategy 1: Try JSON extraction first
    const jsonResult = this.extractJSON(rawOutput);
    if (jsonResult.success) {
      Object.assign(structuredData, jsonResult.data);
      extractionMethod = 'json';
      parsedSections.push('json-block');
    }

    // Strategy 2: Structured text extraction
    const structuredResult = this.extractStructuredText(rawOutput, agent);
    Object.assign(structuredData, structuredResult.data);
    parsedSections.push(...structuredResult.sections);
    detectedPatterns.push(...structuredResult.patterns);

    // Strategy 3: Pattern matching for specific agent types
    const patternResult = this.extractByPatterns(rawOutput, agent);
    Object.assign(structuredData, patternResult.data);
    detectedPatterns.push(...patternResult.patterns);

    // Strategy 4: Hybrid approach - combine all methods
    if (Object.keys(structuredData).length > 2) {
      extractionMethod = 'hybrid';
    } else if (parsedSections.includes('structured-sections')) {
      extractionMethod = 'structured-text';
    }

    // Calculate quality metrics
    const quality = this.assessOutputQuality(rawOutput, structuredData, agent);
    
    // Create metadata
    const extractedMetadata: OutputMetadata = {
      confidence: quality.score / 100,
      completeness: this.calculateCompleteness(structuredData, agent),
      consistency: this.calculateConsistency(structuredData),
      parsedSections,
      detectedPatterns,
      extractionMethod
    };

    // Create propagation data
    const propagationData = this.createPropagationData(structuredData, rawOutput);

    return {
      nodeId,
      agent,
      rawOutput,
      structuredData,
      extractedMetadata,
      propagationData,
      quality
    };
  }

  /**
   * Extract JSON from Claude output
   */
  private extractJSON(output: string): { success: boolean; data: any } {
    // Look for JSON code blocks
    const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
    let match;
    
    while ((match = jsonBlockRegex.exec(output)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        return { success: true, data: parsed };
      } catch {
        continue;
      }
    }
    
    // Look for inline JSON objects
    const jsonInlineRegex = /\{[^{}]*"[^"]*"[^{}]*:[^{}]*\}/g;
    const inlineMatches = output.match(jsonInlineRegex);
    
    if (inlineMatches) {
      for (const jsonStr of inlineMatches) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (Object.keys(parsed).length > 1) {
            return { success: true, data: parsed };
          }
        } catch {
          continue;
        }
      }
    }
    
    return { success: false, data: {} };
  }

  /**
   * Extract structured text sections
   */
  private extractStructuredText(output: string, agent: string): {
    data: StructuredAgentOutput;
    sections: string[];
    patterns: string[];
  } {
    const data: StructuredAgentOutput = {};
    const sections: string[] = [];
    const patterns: string[] = [];

    // Common section patterns
    const sectionPatterns = [
      { name: 'decisions', pattern: /(?:##?\s*(?:decisions|choices|architecture)[\s\S]*?)(?=\n##|$)/gi },
      { name: 'dataTypes', pattern: /(?:##?\s*(?:data types?|models?|interfaces?)[\s\S]*?)(?=\n##|$)/gi },
      { name: 'recommendations', pattern: /(?:##?\s*(?:recommendations?|suggestions?|best practices?)[\s\S]*?)(?=\n##|$)/gi },
      { name: 'dependencies', pattern: /(?:##?\s*(?:dependencies|packages?|requirements?)[\s\S]*?)(?=\n##|$)/gi },
      { name: 'artifacts', pattern: /(?:##?\s*(?:files?|artifacts?|outputs?)[\s\S]*?)(?=\n##|$)/gi },
    ];

    for (const { name, pattern } of sectionPatterns) {
      const matches = output.match(pattern);
      if (matches && matches.length > 0) {
        const content = matches[0];
        data[name] = this.extractListItems(content);
        sections.push(`structured-${name}`);
        patterns.push(`section-${name}`);
      }
    }

    // Agent-specific extractions
    if (agent === 'backend') {
      const apiPattern = /(?:api|endpoint|route)s?:\s*([^\n]+)/gi;
      const apiMatches = this.extractMatches(output, apiPattern);
      if (apiMatches.length > 0) {
        data.apiEndpoints = apiMatches;
        patterns.push('api-endpoints');
      }
    } else if (agent === 'frontend') {
      const componentPattern = /(?:component|widget)s?:\s*([^\n]+)/gi;
      const componentMatches = this.extractMatches(output, componentPattern);
      if (componentMatches.length > 0) {
        data.components = componentMatches;
        patterns.push('components');
      }
    } else if (agent === 'test-writer') {
      const testPattern = /(?:test|spec)s?:\s*([^\n]+)/gi;
      const testMatches = this.extractMatches(output, testPattern);
      if (testMatches.length > 0) {
        data.testSuites = testMatches;
        patterns.push('test-suites');
      }
    }

    return { data, sections, patterns };
  }

  /**
   * Extract using agent-specific patterns
   */
  private extractByPatterns(output: string, agent: string): {
    data: StructuredAgentOutput;
    patterns: string[];
  } {
    const data: StructuredAgentOutput = {};
    const patterns: string[] = [];
    
    const agentPatterns = this.parsingPatterns.get(agent) || [];
    
    for (const pattern of agentPatterns) {
      const matches = output.match(pattern);
      if (matches) {
        patterns.push(`pattern-${pattern.source.substring(0, 20)}`);
        // Process matches based on pattern type
        this.processPatternMatches(matches, data, pattern);
      }
    }
    
    return { data, patterns };
  }

  /**
   * Extract list items from text content
   */
  private extractListItems(content: string): string[] {
    const items: string[] = [];
    
    // Bullet point lists
    const bulletRegex = /(?:^|\n)\s*[-*•]\s*(.+)/g;
    let match;
    while ((match = bulletRegex.exec(content)) !== null) {
      items.push(match[1].trim());
    }
    
    // Numbered lists
    const numberedRegex = /(?:^|\n)\s*\d+\.\s*(.+)/g;
    while ((match = numberedRegex.exec(content)) !== null) {
      items.push(match[1].trim());
    }
    
    // Line-based items (if no lists found)
    if (items.length === 0) {
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .slice(0, 10); // Limit to avoid noise
      items.push(...lines);
    }
    
    return items;
  }

  /**
   * Extract regex matches
   */
  private extractMatches(text: string, regex: RegExp): string[] {
    const matches: string[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    
    return matches;
  }

  /**
   * Process pattern matches into structured data
   */
  private processPatternMatches(matches: RegExpMatchArray, data: StructuredAgentOutput, pattern: RegExp): void {
    // This would be implemented based on specific pattern types
    // For now, just add raw matches
    const key = 'patternMatches';
    if (!data[key]) data[key] = [];
    (data[key] as string[]).push(...matches);
  }

  /**
   * Assess output quality
   */
  private assessOutputQuality(rawOutput: string, structuredData: StructuredAgentOutput, agent: string): OutputQuality {
    const issues: string[] = [];
    const strengths: string[] = [];
    let score = 100;

    // Check for minimum expected fields
    const expectedFields = this.getExpectedFieldsForAgent(agent);
    const presentFields = Object.keys(structuredData);
    const missingFields = expectedFields.filter(field => !presentFields.includes(field));
    
    if (missingFields.length > 0) {
      issues.push(`Missing expected fields: ${missingFields.join(', ')}`);
      score -= missingFields.length * 15;
    } else {
      strengths.push('All expected fields present');
    }

    // Check structured data ratio
    const totalDataPoints = Object.values(structuredData).flat().length;
    const structuredDataRatio = Math.min(1, totalDataPoints / 10);
    
    if (structuredDataRatio < 0.3) {
      issues.push('Low structured data extraction ratio');
      score -= 20;
    } else if (structuredDataRatio > 0.7) {
      strengths.push('High structured data extraction');
    }

    // Check output length vs content ratio
    const contentRatio = totalDataPoints / rawOutput.length * 1000;
    if (contentRatio < 0.1) {
      issues.push('Low content extraction efficiency');
      score -= 10;
    }

    // Determine completeness
    let completeness: OutputQuality['completeness'] = 'minimal';
    if (presentFields.length >= expectedFields.length * 0.7) {
      completeness = presentFields.length === expectedFields.length ? 'comprehensive' : 'partial';
    }

    return {
      score: Math.max(0, score),
      issues,
      strengths,
      completeness,
      structuredDataRatio
    };
  }

  /**
   * Get expected fields for agent type
   */
  private getExpectedFieldsForAgent(agent: string): string[] {
    const fieldMap: Record<string, string[]> = {
      architect: ['decisions', 'dataTypes', 'recommendations', 'dependencies'],
      backend: ['apiEndpoints', 'dataTypes', 'recommendations', 'dependencies', 'artifacts'],
      frontend: ['components', 'dataTypes', 'recommendations', 'dependencies', 'artifacts'],
      'test-writer': ['testSuites', 'recommendations', 'dependencies', 'artifacts']
    };
    
    return fieldMap[agent] || ['recommendations', 'dependencies'];
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(structuredData: StructuredAgentOutput, agent: string): number {
    const expectedFields = this.getExpectedFieldsForAgent(agent);
    const presentFields = Object.keys(structuredData);
    return presentFields.length / expectedFields.length;
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistency(structuredData: StructuredAgentOutput): number {
    // Check for consistency between different fields
    let consistencyScore = 1.0;
    
    // Example: If dataTypes mentions User but apiEndpoints doesn't include /users
    if (structuredData.dataTypes && structuredData.apiEndpoints) {
      const entities = Object.keys(structuredData.dataTypes);
      const endpoints = structuredData.apiEndpoints;
      
      for (const entity of entities) {
        const expectedEndpoint = entity.toLowerCase();
        const hasMatchingEndpoint = endpoints.some(ep => 
          ep.toLowerCase().includes(expectedEndpoint)
        );
        
        if (!hasMatchingEndpoint) {
          consistencyScore -= 0.1;
        }
      }
    }
    
    return Math.max(0, consistencyScore);
  }

  /**
   * Create propagation data for dependent nodes
   */
  private createPropagationData(structuredData: StructuredAgentOutput, rawOutput: string): PropagationData {
    const keyInsights = this.extractKeyInsights(rawOutput);
    const criticalDecisions = structuredData.decisions || [];
    const integrationPoints = this.extractIntegrationPoints(structuredData);
    const constraints = this.extractConstraints(structuredData, rawOutput);
    const recommendations = structuredData.recommendations || [];

    return {
      contextForDependents: structuredData,
      keyInsights,
      criticalDecisions,
      integrationPoints,
      constraints,
      recommendations
    };
  }

  /**
   * Extract key insights from raw output
   */
  private extractKeyInsights(rawOutput: string): string[] {
    const insights: string[] = [];
    
    // Look for insight indicators
    const insightPatterns = [
      /(?:insight|important|key point|note):\s*([^\n]+)/gi,
      /(?:therefore|thus|consequently),?\s*([^\n]+)/gi,
      /(?:should|must|need to)\s*([^\n]+)/gi
    ];
    
    for (const pattern of insightPatterns) {
      const matches = this.extractMatches(rawOutput, pattern);
      insights.push(...matches);
    }
    
    return insights.slice(0, 5); // Top 5 insights
  }

  /**
   * Extract integration points
   */
  private extractIntegrationPoints(structuredData: StructuredAgentOutput): string[] {
    const points: string[] = [];
    
    if (structuredData.apiEndpoints) {
      points.push(...structuredData.apiEndpoints.map(ep => `API: ${ep}`));
    }
    
    if (structuredData.dataTypes) {
      points.push(...Object.keys(structuredData.dataTypes).map(dt => `DataType: ${dt}`));
    }
    
    if (structuredData.components) {
      points.push(...structuredData.components.map(c => `Component: ${c}`));
    }
    
    return points;
  }

  /**
   * Extract constraints
   */
  private extractConstraints(structuredData: StructuredAgentOutput, rawOutput: string): string[] {
    const constraints: string[] = [];
    
    // Add dependencies as constraints
    if (structuredData.dependencies) {
      constraints.push(...structuredData.dependencies.map(dep => `Dependency: ${dep}`));
    }
    
    // Extract explicit constraints from text
    const constraintPatterns = [
      /(?:constraint|limitation|requirement):\s*([^\n]+)/gi,
      /(?:cannot|must not|should not)\s*([^\n]+)/gi
    ];
    
    for (const pattern of constraintPatterns) {
      const matches = this.extractMatches(rawOutput, pattern);
      constraints.push(...matches);
    }
    
    return constraints;
  }

  /**
   * Create enrichment data for specific nodes
   */
  private async createEnrichmentData(
    parsedOutput: ParsedOutput,
    dependentNodeIds: string[]
  ): Promise<Record<string, any>> {
    const enrichmentData: Record<string, any> = {};
    
    for (const nodeId of dependentNodeIds) {
      enrichmentData[nodeId] = {
        sourceNode: parsedOutput.nodeId,
        sourceAgent: parsedOutput.agent,
        structuredData: parsedOutput.structuredData,
        propagationData: parsedOutput.propagationData,
        quality: parsedOutput.quality,
        timestamp: new Date().toISOString()
      };
    }
    
    return enrichmentData;
  }

  /**
   * Propagate enrichment data to dependent nodes
   */
  private async propagateToNodes(
    sessionId: string,
    enrichmentData: Record<string, any>,
    dependentNodeIds: string[]
  ): Promise<void> {
    for (const nodeId of dependentNodeIds) {
      const nodePath = path.join(this.memoryBasePath, sessionId, nodeId);
      await fs.mkdir(nodePath, { recursive: true });
      
      const enrichmentPath = path.join(nodePath, 'enrichment.json');
      
      // Load existing enrichment data if it exists
      let existingData = {};
      try {
        const existing = await fs.readFile(enrichmentPath, 'utf-8');
        existingData = JSON.parse(existing);
      } catch {
        // File doesn't exist, which is fine
      }
      
      // Merge new enrichment data
      const mergedData = {
        ...existingData,
        ...enrichmentData[nodeId]
      };
      
      await fs.writeFile(enrichmentPath, JSON.stringify(mergedData, null, 2));
    }
  }

  /**
   * Analyze network effects of propagation
   */
  private async analyzeNetworkEffects(
    parsedOutput: ParsedOutput,
    dependentNodeIds: string[],
    sessionId: string
  ): Promise<NetworkEffect[]> {
    const effects: NetworkEffect[] = [];
    
    // Decision cascade effects
    if (parsedOutput.structuredData.decisions && parsedOutput.structuredData.decisions.length > 0) {
      effects.push({
        type: 'decision_cascade',
        sourceNode: parsedOutput.nodeId,
        affectedNodes: dependentNodeIds,
        impact: 'high',
        description: `${parsedOutput.structuredData.decisions.length} architectural decisions will cascade to ${dependentNodeIds.length} dependent nodes`
      });
    }
    
    // Constraint propagation effects
    if (parsedOutput.propagationData.constraints.length > 0) {
      effects.push({
        type: 'constraint_propagation',
        sourceNode: parsedOutput.nodeId,
        affectedNodes: dependentNodeIds,
        impact: 'medium',
        description: `${parsedOutput.propagationData.constraints.length} constraints will constrain ${dependentNodeIds.length} dependent implementations`
      });
    }
    
    // Data flow effects
    if (parsedOutput.structuredData.dataTypes && Object.keys(parsedOutput.structuredData.dataTypes).length > 0) {
      effects.push({
        type: 'data_flow',
        sourceNode: parsedOutput.nodeId,
        affectedNodes: dependentNodeIds,
        impact: 'high',
        description: `${Object.keys(parsedOutput.structuredData.dataTypes).length} data types will flow to dependent nodes`
      });
    }
    
    return effects;
  }

  /**
   * Save parsed output to memory
   */
  private async saveParsedOutput(sessionId: string, parsedOutput: ParsedOutput): Promise<void> {
    const outputPath = path.join(this.memoryBasePath, sessionId, parsedOutput.nodeId, 'parsed-output.json');
    
    const serializable = {
      ...parsedOutput,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(outputPath, JSON.stringify(serializable, null, 2));
  }

  /**
   * Initialize parsing patterns for different agent types
   */
  private initializeParsingPatterns(): void {
    this.parsingPatterns.set('architect', [
      /architectural decision:\s*([^\n]+)/gi,
      /design pattern:\s*([^\n]+)/gi,
      /technology choice:\s*([^\n]+)/gi
    ]);
    
    this.parsingPatterns.set('backend', [
      /(?:api|endpoint):\s*([^\n]+)/gi,
      /(?:model|entity):\s*([^\n]+)/gi,
      /(?:service|controller):\s*([^\n]+)/gi
    ]);
    
    this.parsingPatterns.set('frontend', [
      /(?:component|page):\s*([^\n]+)/gi,
      /(?:hook|utility):\s*([^\n]+)/gi,
      /(?:style|theme):\s*([^\n]+)/gi
    ]);
  }

  /**
   * Initialize agent output schemas
   */
  private initializeAgentSchemas(): void {
    this.agentOutputSchemas.set('architect', {
      decisions: 'array',
      dataTypes: 'object',
      recommendations: 'array',
      dependencies: 'array'
    });
    
    this.agentOutputSchemas.set('backend', {
      apiEndpoints: 'array',
      dataTypes: 'object',
      recommendations: 'array',
      dependencies: 'array',
      artifacts: 'array'
    });
  }

  /**
   * Get cached parsed output
   */
  getCachedOutput(nodeId: string): ParsedOutput | null {
    return this.propagationCache.get(nodeId) || null;
  }

  /**
   * Clear propagation cache
   */
  clearCache(): void {
    this.propagationCache.clear();
  }
}