import fs from 'fs';
import matter from 'gray-matter';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

export interface AgentFrontmatter {
  name: string;
  description?: string;
  model?: string;
  color?: string;
  [key: string]: any; // Allow additional fields
}

export interface ParsedAgent {
  frontmatter: AgentFrontmatter;
  content: string;
  fullContent: string;
  filePath: string;
  valid: boolean;
  errors?: string[];
}

export interface GraphynAgent {
  name: string;
  description: string;
  instructions: string;
  model: string;
  metadata?: {
    sourceFile?: string;
    originalColor?: string;
    importedFrom?: string;
    [key: string]: any;
  };
}

export class AgentParser {
  /**
   * Parse a markdown file with YAML frontmatter
   */
  parseAgentFile(filePath: string): ParsedAgent {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          frontmatter: { name: '' },
          content: '',
          fullContent: '',
          filePath,
          valid: false,
          errors: ['File does not exist']
        };
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(fileContent);
      
      // Validate required fields
      const errors: string[] = [];
      const frontmatter = parsed.data as AgentFrontmatter;
      
      if (!frontmatter.name) {
        errors.push('Missing required field: name');
      }
      
      return {
        frontmatter,
        content: parsed.content.trim(),
        fullContent: fileContent,
        filePath,
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        frontmatter: { name: '' },
        content: '',
        fullContent: '',
        filePath,
        valid: false,
        errors: [`Failed to parse file: ${errorMessage}`]
      };
    }
  }
  
  /**
   * Convert parsed agent to Graphyn format
   */
  toGraphynFormat(parsed: ParsedAgent): GraphynAgent | null {
    if (!parsed.valid) {
      console.error(colors.error(`Cannot convert invalid agent: ${parsed.errors?.join(', ')}`));
      return null;
    }
    
    const { frontmatter, content, filePath } = parsed;
    
    // Extract clean description from frontmatter
    let description = frontmatter.description || '';
    
    // If description contains examples, extract just the first part
    if (description.includes('\\n\\nExamples:')) {
      description = description.split('\\n\\nExamples:')[0];
    } else if (description.includes('\n\nExamples:')) {
      description = description.split('\n\nExamples:')[0];
    }
    
    // Clean up escaped newlines
    description = description.replace(/\\n/g, '\n').trim();
    
    // If description is still very long, truncate it
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }
    
    // Map model names
    const modelMap: { [key: string]: string } = {
      'opus': 'claude-3-opus-20240229',
      'sonnet': 'claude-3-5-sonnet-20241022',
      'haiku': 'claude-3-haiku-20240307',
      'gpt-4': 'gpt-4-turbo-preview',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini'
    };
    
    const model = modelMap[frontmatter.model || 'sonnet'] || 'claude-3-5-sonnet-20241022';
    
    return {
      name: frontmatter.name,
      description: description || `Agent: ${frontmatter.name}`,
      instructions: content,
      model,
      metadata: {
        sourceFile: filePath,
        originalColor: frontmatter.color,
        importedFrom: 'claude-agents',
        originalModel: frontmatter.model,
        ...Object.entries(frontmatter).reduce((acc, [key, value]) => {
          if (!['name', 'description', 'model', 'color'].includes(key)) {
            acc[key] = value;
          }
          return acc;
        }, {} as { [key: string]: any })
      }
    };
  }
  
  /**
   * Parse multiple agent files
   */
  parseMultipleAgents(filePaths: string[]): ParsedAgent[] {
    return filePaths.map(filePath => this.parseAgentFile(filePath));
  }
  
  /**
   * Validate an agent object
   */
  validateAgent(agent: ParsedAgent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!agent.frontmatter.name) {
      errors.push('Agent must have a name');
    }
    
    if (!agent.content || agent.content.trim().length === 0) {
      errors.push('Agent must have content (instructions)');
    }
    
    if (agent.frontmatter.model) {
      const validModels = ['opus', 'sonnet', 'haiku', 'gpt-4', 'gpt-4o', 'gpt-4o-mini'];
      if (!validModels.includes(agent.frontmatter.model)) {
        errors.push(`Invalid model: ${agent.frontmatter.model}. Valid models are: ${validModels.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Display parsed agent information
   */
  displayAgent(parsed: ParsedAgent): void {
    const { frontmatter, content, valid, errors } = parsed;
    
    console.log(colors.highlight(`\n📋 Agent: ${frontmatter.name || 'Unknown'}`));
    
    if (!valid) {
      console.log(colors.error('   Status: Invalid'));
      if (errors) {
        errors.forEach(error => {
          console.log(colors.error(`   - ${error}`));
        });
      }
      return;
    }
    
    console.log(colors.success('   Status: Valid'));
    
    if (frontmatter.description) {
      const desc = frontmatter.description.replace(/\\n/g, ' ').substring(0, 100);
      console.log(colors.info(`   Description: ${desc}${frontmatter.description.length > 100 ? '...' : ''}`));
    }
    
    if (frontmatter.model) {
      console.log(colors.info(`   Model: ${frontmatter.model}`));
    }
    
    if (frontmatter.color) {
      console.log(colors.info(`   Color: ${frontmatter.color}`));
    }
    
    const wordCount = content.split(/\s+/).length;
    console.log(colors.info(`   Instructions: ${wordCount} words`));
  }
  
  /**
   * Extract agent name from filename if frontmatter doesn't have it
   */
  extractNameFromFilename(filename: string): string {
    return filename.replace('.md', '').replace(/-/g, ' ').replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Export singleton instance
export const agentParser = new AgentParser();