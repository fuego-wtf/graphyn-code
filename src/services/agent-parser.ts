import fs from 'fs';
import matter from 'gray-matter';
import { DetectedAgent } from './agent-detector.js';

export interface ParsedAgent {
  // From YAML frontmatter
  name: string;
  description: string;
  model?: string;
  color?: string;
  
  // Content
  prompt: string;
  
  // Metadata
  sourcePath: string;
  sourceType: DetectedAgent['source'];
  
  // Graphyn format
  graphynFormat?: {
    name: string;
    description: string;
    instructions: string;
    model: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Service for parsing markdown agent files with YAML frontmatter
 */
export class AgentParserService {
  private readonly defaultModel = 'claude-3-5-sonnet';
  private readonly modelMappings: Record<string, string> = {
    'opus': 'claude-3-opus',
    'sonnet': 'claude-3-5-sonnet',
    'haiku': 'claude-3-haiku',
    'gpt-4': 'gpt-4-turbo',
    'gpt-3.5': 'gpt-3.5-turbo'
  };
  
  /**
   * Parse a single agent file
   */
  async parseAgentFile(filePath: string, source: DetectedAgent['source'] = 'project'): Promise<ParsedAgent> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    
    // Extract frontmatter data
    const data = parsed.data as any;
    
    if (!data.name) {
      throw new Error(`Agent file ${filePath} is missing required 'name' field in frontmatter`);
    }
    
    if (!data.description) {
      throw new Error(`Agent file ${filePath} is missing required 'description' field in frontmatter`);
    }
    
    // Parse and normalize the agent
    const agent: ParsedAgent = {
      name: data.name,
      description: this.cleanDescription(data.description),
      model: this.normalizeModel(data.model),
      color: data.color,
      prompt: parsed.content.trim(),
      sourcePath: filePath,
      sourceType: source
    };
    
    // Generate Graphyn format
    agent.graphynFormat = this.toGraphynFormat(agent);
    
    return agent;
  }
  
  /**
   * Parse multiple agent files
   */
  async parseAgents(agents: DetectedAgent[]): Promise<ParsedAgent[]> {
    const parsed: ParsedAgent[] = [];
    const errors: Array<{ path: string; error: string }> = [];
    
    for (const agent of agents) {
      try {
        const parsedAgent = await this.parseAgentFile(agent.path, agent.source);
        parsed.push(parsedAgent);
      } catch (error) {
        errors.push({
          path: agent.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    if (errors.length > 0) {
      console.warn('Failed to parse some agent files:', errors);
    }
    
    return parsed;
  }
  
  /**
   * Clean and format description (remove example blocks if present)
   */
  private cleanDescription(description: string): string {
    // Remove \n literal characters and replace with actual newlines
    let cleaned = description.replace(/\\n/g, '\n');
    
    // If description contains examples, extract just the main description
    const exampleIndex = cleaned.indexOf('Examples:');
    if (exampleIndex > 0) {
      cleaned = cleaned.substring(0, exampleIndex).trim();
    }
    
    // Remove <example> blocks
    cleaned = cleaned.replace(/<example>[\s\S]*?<\/example>/g, '').trim();
    
    // Limit to reasonable length for API
    if (cleaned.length > 500) {
      // Find a good break point
      const cutoff = cleaned.lastIndexOf('.', 500);
      if (cutoff > 300) {
        cleaned = cleaned.substring(0, cutoff + 1);
      } else {
        cleaned = cleaned.substring(0, 497) + '...';
      }
    }
    
    return cleaned;
  }
  
  /**
   * Normalize model names to Graphyn-compatible format
   */
  private normalizeModel(model?: string): string {
    if (!model) {
      return this.defaultModel;
    }
    
    // Check if it's a shorthand that needs mapping
    const mapped = this.modelMappings[model.toLowerCase()];
    if (mapped) {
      return mapped;
    }
    
    // Already in correct format or custom model
    return model;
  }
  
  /**
   * Convert parsed agent to Graphyn API format
   */
  private toGraphynFormat(agent: ParsedAgent): ParsedAgent['graphynFormat'] {
    return {
      name: agent.name,
      description: agent.description,
      instructions: agent.prompt,
      model: agent.model || this.defaultModel,
      metadata: {
        importedFrom: agent.sourcePath,
        importedAt: new Date().toISOString(),
        sourceType: agent.sourceType,
        originalColor: agent.color
      }
    };
  }
  
  /**
   * Validate agent data before sending to API
   */
  validateAgent(agent: ParsedAgent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!agent.name || agent.name.length < 1) {
      errors.push('Agent name is required');
    }
    
    if (!agent.description || agent.description.length < 10) {
      errors.push('Agent description must be at least 10 characters');
    }
    
    if (!agent.prompt || agent.prompt.length < 20) {
      errors.push('Agent prompt must be at least 20 characters');
    }
    
    if (agent.name.length > 100) {
      errors.push('Agent name must be less than 100 characters');
    }
    
    if (agent.description.length > 500) {
      errors.push('Agent description must be less than 500 characters');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generate a summary of parsed agents for display
   */
  generateSummary(agents: ParsedAgent[]): string[] {
    return agents.map(agent => {
      const source = agent.sourceType === 'project' ? '📁' : 
                    agent.sourceType === 'parent' ? '📂' : '🏠';
      const model = agent.model === 'claude-3-opus' ? '🎭' :
                   agent.model === 'claude-3-5-sonnet' ? '🎵' :
                   agent.model === 'claude-3-haiku' ? '🍃' :
                   agent.model?.includes('gpt') ? '🤖' : '🧠';
      
      return `${source} ${model} ${agent.name} - ${this.truncateDescription(agent.description, 50)}`;
    });
  }
  
  /**
   * Truncate description for display
   */
  private truncateDescription(desc: string, maxLen: number): string {
    if (desc.length <= maxLen) return desc;
    return desc.substring(0, maxLen - 3) + '...';
  }
}