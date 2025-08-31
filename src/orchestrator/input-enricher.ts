/**
 * Input Enricher for Graph-Neural AI Coordination
 * 
 * Enriches Claude prompts with structured outputs from predecessor agents,
 * creating intelligent context propagation through the dependency graph.
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface EnrichmentContext {
  nodeId: string;
  agent: string;
  baseTask: string;
  predecessorOutputs: Map<string, PredecessorOutput>;
  projectContext: ProjectContext;
  chainContext: ChainContext;
}

export interface PredecessorOutput {
  nodeId: string;
  agent: string;
  structuredData: any;
  keyDecisions: string[];
  artifacts: string[];
  recommendations: string[];
  dataTypes: Record<string, any>;
  apiEndpoints?: string[];
  dependencies?: string[];
}

export interface ProjectContext {
  repository: string;
  framework?: string;
  language?: string;
  existingFiles: string[];
  packageDependencies: string[];
}

export interface ChainContext {
  executionPath: string[];
  totalNodes: number;
  currentPosition: number;
  branchingFactor: number;
}

export interface EnrichedPrompt {
  originalTask: string;
  enrichedPrompt: string;
  contextSections: {
    architecturalDecisions: string;
    dataStructures: string;
    implementationGuidelines: string;
    integrationRequirements: string;
    qualityConstraints: string;
  };
  metadata: {
    enrichmentLevel: 'minimal' | 'moderate' | 'comprehensive';
    precedingAgents: string[];
    keyContextItems: string[];
  };
}

export class InputEnricher {
  private memoryBasePath: string;
  private templateCache = new Map<string, string>();

  constructor(basePath?: string) {
    this.memoryBasePath = basePath || '.graphyn/graph-memory';
  }

  /**
   * Enrich a Claude prompt with context from predecessor agents
   */
  async enrichPrompt(context: EnrichmentContext): Promise<EnrichedPrompt> {
    const contextSections = await this.buildContextSections(context);
    const enrichedPrompt = await this.assembleEnrichedPrompt(context, contextSections);
    const enrichmentLevel = this.determineEnrichmentLevel(context);

    return {
      originalTask: context.baseTask,
      enrichedPrompt,
      contextSections,
      metadata: {
        enrichmentLevel,
        precedingAgents: Array.from(context.predecessorOutputs.keys()),
        keyContextItems: this.extractKeyContextItems(context)
      }
    };
  }

  /**
   * Build structured context sections from predecessor outputs
   */
  private async buildContextSections(context: EnrichmentContext): Promise<EnrichedPrompt['contextSections']> {
    const decisions: string[] = [];
    const dataStructures: string[] = [];
    const guidelines: string[] = [];
    const integrations: string[] = [];
    const constraints: string[] = [];

    for (const [nodeId, output] of context.predecessorOutputs) {
      // Extract architectural decisions
      if (output.keyDecisions.length > 0) {
        decisions.push(`**From ${output.agent} (${nodeId}):**`);
        decisions.push(...output.keyDecisions.map(d => `- ${d}`));
      }

      // Extract data structures and types
      if (output.dataTypes && Object.keys(output.dataTypes).length > 0) {
        dataStructures.push(`**From ${output.agent}:**`);
        dataStructures.push(this.formatDataTypes(output.dataTypes));
      }

      // Extract implementation guidelines
      if (output.recommendations.length > 0) {
        guidelines.push(`**${output.agent} Recommendations:**`);
        guidelines.push(...output.recommendations.map(r => `- ${r}`));
      }

      // Extract integration requirements
      if (output.apiEndpoints && output.apiEndpoints.length > 0) {
        integrations.push(`**${output.agent} API Endpoints:**`);
        integrations.push(...output.apiEndpoints.map(e => `- ${e}`));
      }

      // Extract dependencies as constraints
      if (output.dependencies && output.dependencies.length > 0) {
        constraints.push(`**Required Dependencies from ${output.agent}:**`);
        constraints.push(...output.dependencies.map(d => `- ${d}`));
      }
    }

    return {
      architecturalDecisions: decisions.join('\n'),
      dataStructures: dataStructures.join('\n'),
      implementationGuidelines: guidelines.join('\n'),
      integrationRequirements: integrations.join('\n'),
      qualityConstraints: constraints.join('\n')
    };
  }

  /**
   * Assemble the final enriched prompt
   */
  private async assembleEnrichedPrompt(
    context: EnrichmentContext,
    contextSections: EnrichedPrompt['contextSections']
  ): Promise<string> {
    const template = await this.getPromptTemplate(context.agent);
    
    let enrichedPrompt = this.injectBaseTask(template, context.baseTask);
    enrichedPrompt = this.injectProjectContext(enrichedPrompt, context.projectContext);
    enrichedPrompt = this.injectChainContext(enrichedPrompt, context.chainContext);
    enrichedPrompt = this.injectPredecessorContext(enrichedPrompt, contextSections);
    enrichedPrompt = this.injectNeuralInstructions(enrichedPrompt, context);

    return enrichedPrompt;
  }

  /**
   * Get agent-specific prompt template
   */
  private async getPromptTemplate(agentType: string): Promise<string> {
    if (this.templateCache.has(agentType)) {
      return this.templateCache.get(agentType)!;
    }

    const templates: Record<string, string> = {
      architect: `# System Architecture Task

## Primary Objective
{BASE_TASK}

{CHAIN_CONTEXT}

{PROJECT_CONTEXT}

{PREDECESSOR_CONTEXT}

## Architecture Guidelines
- Design for maintainability and scalability
- Consider security implications
- Plan for testing and deployment
- Document key architectural decisions

{NEURAL_INSTRUCTIONS}

## Expected Output
Provide your response in the following structure:
\`\`\`json
{
  "decisions": ["key architectural decision 1", "key architectural decision 2"],
  "dataTypes": {"EntityName": "description"},
  "recommendations": ["recommendation 1", "recommendation 2"],
  "dependencies": ["dependency 1", "dependency 2"],
  "artifacts": ["file1.ts", "file2.ts"]
}
\`\`\``,

      backend: `# Backend Development Task

## Implementation Objective
{BASE_TASK}

{CHAIN_CONTEXT}

{PROJECT_CONTEXT}

{PREDECESSOR_CONTEXT}

## Implementation Guidelines
- Follow existing code patterns and conventions
- Implement proper error handling
- Add comprehensive logging
- Consider performance implications

{NEURAL_INSTRUCTIONS}

## Expected Output
Provide your response in the following structure:
\`\`\`json
{
  "apiEndpoints": ["/api/endpoint1", "/api/endpoint2"],
  "dataTypes": {"Model": "description"},
  "recommendations": ["best practice 1", "best practice 2"],
  "dependencies": ["package1", "package2"],
  "artifacts": ["controller.ts", "model.ts", "service.ts"]
}
\`\`\``,

      frontend: `# Frontend Development Task

## UI/UX Implementation Objective
{BASE_TASK}

{CHAIN_CONTEXT}

{PROJECT_CONTEXT}

{PREDECESSOR_CONTEXT}

## Frontend Guidelines
- Follow design system patterns
- Ensure accessibility compliance
- Optimize for performance
- Implement responsive design

{NEURAL_INSTRUCTIONS}

## Expected Output
Provide your response in the following structure:
\`\`\`json
{
  "components": ["Component1", "Component2"],
  "dataTypes": {"Props": "interface definition"},
  "recommendations": ["performance tip 1", "accessibility tip 2"],
  "dependencies": ["@types/react", "styled-components"],
  "artifacts": ["Component.tsx", "Component.test.tsx", "styles.ts"]
}
\`\`\``,

      'test-writer': `# Test Implementation Task

## Testing Objective
{BASE_TASK}

{CHAIN_CONTEXT}

{PROJECT_CONTEXT}

{PREDECESSOR_CONTEXT}

## Testing Guidelines
- Achieve comprehensive test coverage
- Test both happy path and edge cases
- Include integration tests where appropriate
- Follow testing best practices

{NEURAL_INSTRUCTIONS}

## Expected Output
Provide your response in the following structure:
\`\`\`json
{
  "testSuites": ["unit tests", "integration tests"],
  "dataTypes": {"TestCase": "description"},
  "recommendations": ["testing strategy 1", "coverage improvement 2"],
  "dependencies": ["jest", "@testing-library/react"],
  "artifacts": ["component.test.ts", "integration.test.ts"]
}
\`\`\``
    };

    const template = templates[agentType] || templates.backend;
    this.templateCache.set(agentType, template);
    return template;
  }

  /**
   * Inject base task into template
   */
  private injectBaseTask(template: string, baseTask: string): string {
    return template.replace('{BASE_TASK}', baseTask);
  }

  /**
   * Inject project context information
   */
  private injectProjectContext(template: string, context: ProjectContext): string {
    const contextText = `## Project Context
- **Repository:** ${context.repository}
- **Framework:** ${context.framework || 'Not specified'}
- **Language:** ${context.language || 'Not specified'}
- **Existing Files:** ${context.existingFiles.length} files detected
- **Dependencies:** ${context.packageDependencies.join(', ')}`;

    return template.replace('{PROJECT_CONTEXT}', contextText);
  }

  /**
   * Inject chain execution context
   */
  private injectChainContext(template: string, context: ChainContext): string {
    const contextText = `## Execution Chain Context
- **Position:** ${context.currentPosition} of ${context.totalNodes} nodes
- **Execution Path:** ${context.executionPath.join(' → ')}
- **Branching Factor:** ${context.branchingFactor} parallel paths`;

    return template.replace('{CHAIN_CONTEXT}', contextText);
  }

  /**
   * Inject predecessor context sections
   */
  private injectPredecessorContext(template: string, sections: EnrichedPrompt['contextSections']): string {
    const hasContext = Object.values(sections).some(section => section.trim().length > 0);
    
    if (!hasContext) {
      return template.replace('{PREDECESSOR_CONTEXT}', '## Predecessor Context\nNo previous agent context available.');
    }

    const contextText = `## Predecessor Context

### Architectural Decisions
${sections.architecturalDecisions || 'No architectural decisions from predecessors.'}

### Data Structures
${sections.dataStructures || 'No data structures defined by predecessors.'}

### Implementation Guidelines  
${sections.implementationGuidelines || 'No specific implementation guidelines.'}

### Integration Requirements
${sections.integrationRequirements || 'No integration requirements specified.'}

### Quality Constraints
${sections.qualityConstraints || 'No quality constraints specified.'}`;

    return template.replace('{PREDECESSOR_CONTEXT}', contextText);
  }

  /**
   * Inject neural coordination instructions
   */
  private injectNeuralInstructions(template: string, context: EnrichmentContext): string {
    const predecessorCount = context.predecessorOutputs.size;
    
    let instructions = '## Neural Coordination Instructions\n';
    
    if (predecessorCount === 0) {
      instructions += '- You are the first agent in this execution graph\n';
      instructions += '- Establish foundational decisions that subsequent agents will build upon\n';
      instructions += '- Be explicit about your architectural choices and data structures\n';
    } else {
      instructions += `- You are building upon work from ${predecessorCount} previous agent(s)\n`;
      instructions += '- **CRITICAL:** Use the provided context to ensure consistency with previous decisions\n';
      instructions += '- Do not override or contradict architectural choices made by predecessors\n';
      instructions += '- Build incrementally upon the established foundation\n';
      instructions += '- Reference specific predecessor outputs when making implementation decisions\n';
    }

    instructions += '- Provide structured output that subsequent agents can easily consume\n';
    instructions += '- Focus on the specific expertise of your agent role\n';
    instructions += '- Consider the downstream impact of your decisions on dependent agents\n';

    return template.replace('{NEURAL_INSTRUCTIONS}', instructions);
  }

  /**
   * Format data types for context display
   */
  private formatDataTypes(dataTypes: Record<string, any>): string {
    const formatted: string[] = [];
    
    for (const [name, definition] of Object.entries(dataTypes)) {
      if (typeof definition === 'string') {
        formatted.push(`- **${name}:** ${definition}`);
      } else if (typeof definition === 'object') {
        formatted.push(`- **${name}:** ${JSON.stringify(definition, null, 2)}`);
      }
    }
    
    return formatted.join('\n');
  }

  /**
   * Determine enrichment level based on context complexity
   */
  private determineEnrichmentLevel(context: EnrichmentContext): 'minimal' | 'moderate' | 'comprehensive' {
    const predecessorCount = context.predecessorOutputs.size;
    const totalContextItems = Array.from(context.predecessorOutputs.values())
      .reduce((sum, output) => sum + output.keyDecisions.length + output.recommendations.length, 0);

    if (predecessorCount === 0) return 'minimal';
    if (predecessorCount <= 2 && totalContextItems <= 10) return 'moderate';
    return 'comprehensive';
  }

  /**
   * Extract key context items for metadata
   */
  private extractKeyContextItems(context: EnrichmentContext): string[] {
    const items: string[] = [];
    
    for (const output of context.predecessorOutputs.values()) {
      items.push(...output.keyDecisions);
      if (output.apiEndpoints) items.push(...output.apiEndpoints);
      if (output.dependencies) items.push(...output.dependencies);
    }
    
    return items.slice(0, 10); // Top 10 most important items
  }

  /**
   * Load predecessor outputs from memory
   */
  async loadPredecessorOutputs(sessionId: string, predecessorNodeIds: string[]): Promise<Map<string, PredecessorOutput>> {
    const outputs = new Map<string, PredecessorOutput>();
    
    for (const nodeId of predecessorNodeIds) {
      try {
        const outputPath = path.join(this.memoryBasePath, sessionId, nodeId, 'output.json');
        const outputData = await fs.readFile(outputPath, 'utf-8');
        const parsedOutput = JSON.parse(outputData);
        
        const predecessorOutput: PredecessorOutput = {
          nodeId,
          agent: parsedOutput.agent,
          structuredData: parsedOutput.output,
          keyDecisions: parsedOutput.output.decisions || [],
          artifacts: parsedOutput.output.artifacts || [],
          recommendations: parsedOutput.output.recommendations || [],
          dataTypes: parsedOutput.output.dataTypes || {},
          apiEndpoints: parsedOutput.output.apiEndpoints,
          dependencies: parsedOutput.output.dependencies
        };
        
        outputs.set(nodeId, predecessorOutput);
      } catch (error) {
        console.warn(`Failed to load predecessor output for node ${nodeId}:`, error);
      }
    }
    
    return outputs;
  }

  /**
   * Build enrichment context from graph state
   */
  async buildEnrichmentContext(
    nodeId: string,
    agent: string,
    baseTask: string,
    predecessorNodeIds: string[],
    sessionId: string,
    projectContext: ProjectContext,
    executionPath: string[],
    totalNodes: number
  ): Promise<EnrichmentContext> {
    const predecessorOutputs = await this.loadPredecessorOutputs(sessionId, predecessorNodeIds);
    
    return {
      nodeId,
      agent,
      baseTask,
      predecessorOutputs,
      projectContext,
      chainContext: {
        executionPath,
        totalNodes,
        currentPosition: executionPath.length + 1,
        branchingFactor: this.calculateBranchingFactor(executionPath, totalNodes)
      }
    };
  }

  /**
   * Calculate branching factor for chain context
   */
  private calculateBranchingFactor(executionPath: string[], totalNodes: number): number {
    // Simplified calculation - in practice would analyze the graph structure
    const remaining = totalNodes - executionPath.length;
    return Math.max(1, Math.ceil(remaining / 3));
  }

  /**
   * Validate enriched prompt quality
   */
  validateEnrichedPrompt(enrichedPrompt: EnrichedPrompt): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check for essential elements
    if (!enrichedPrompt.enrichedPrompt.includes('## Expected Output')) {
      issues.push('Missing expected output format section');
      score -= 20;
    }

    if (enrichedPrompt.metadata.precedingAgents.length > 0) {
      if (!enrichedPrompt.enrichedPrompt.includes('Predecessor Context')) {
        issues.push('Missing predecessor context despite having preceding agents');
        score -= 30;
      }
    }

    // Check enrichment level consistency
    const promptLength = enrichedPrompt.enrichedPrompt.length;
    if (enrichedPrompt.metadata.enrichmentLevel === 'comprehensive' && promptLength < 2000) {
      issues.push('Enrichment level marked as comprehensive but prompt is too short');
      score -= 15;
    }

    // Check for neural instructions
    if (!enrichedPrompt.enrichedPrompt.includes('Neural Coordination')) {
      issues.push('Missing neural coordination instructions');
      score -= 25;
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score)
    };
  }
}