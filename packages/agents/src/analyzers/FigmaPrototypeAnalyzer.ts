/**
 * Figma Prototype Analyzer - Extract design information from Figma prototypes
 * 
 * Uses MCP client to connect to Figma API and extract comprehensive
 * design information for implementation using the provided prototype link
 */

import { MCPClient, type MCPToolResult } from '../clients/MCPClient.js';

export interface FigmaAnalysisConfig {
  prototypeUrl: string;
  nodeId?: string;
  clientFrameworks?: string;
  clientLanguages?: string;
  outputDir?: string;
  extractComponents?: boolean;
  extractVariables?: boolean;
  extractScreenshots?: boolean;
  generateCode?: boolean;
}

export interface FigmaDesignToken {
  name: string;
  value: string | number;
  type: 'color' | 'spacing' | 'typography' | 'border' | 'shadow';
  category: string;
}

export interface FigmaComponent {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  code?: string;
  screenshot?: string;
}

export interface FigmaAnalysisResult {
  success: boolean;
  prototypeUrl: string;
  nodeId: string | null;
  designTokens: FigmaDesignToken[];
  components: FigmaComponent[];
  metadata: Record<string, any>;
  screenshots: Record<string, string>;
  generatedCode: Record<string, string>;
  error?: string;
}

/**
 * Figma Prototype Analyzer
 */
export class FigmaPrototypeAnalyzer {
  private mcpClient: MCPClient;
  private config: FigmaAnalysisConfig;

  constructor(config: FigmaAnalysisConfig) {
    this.config = {
      clientFrameworks: 'react',
      clientLanguages: 'typescript',
      extractComponents: true,
      extractVariables: true,
      extractScreenshots: true,
      generateCode: true,
      ...config
    };

    // Initialize MCP client for Figma tools
    this.mcpClient = new MCPClient({
      serverCommand: process.env.FIGMA_MCP_SERVER_COMMAND,
      serverArgs: process.env.FIGMA_MCP_SERVER_ARGS?.split(' ') || []
    });
  }

  /**
   * Analyze the Figma prototype and extract all design information
   */
  async analyze(): Promise<FigmaAnalysisResult> {
    this.log('info', `Starting Figma prototype analysis: ${this.config.prototypeUrl}`);

    const result: FigmaAnalysisResult = {
      success: false,
      prototypeUrl: this.config.prototypeUrl,
      nodeId: this.config.nodeId || null,
      designTokens: [],
      components: [],
      metadata: {},
      screenshots: {},
      generatedCode: {}
    };

    try {
      // Connect to Figma MCP server
      await this.mcpClient.connect();
      
      if (!this.mcpClient.connected) {
        throw new Error('Failed to connect to Figma MCP server');
      }

      // Step 1: Add Figma file to context
      this.log('info', 'Adding Figma file to MCP context...');
      const addFileResult = await this.mcpClient.addFigmaFile(this.config.prototypeUrl);
      if (!addFileResult.success) {
        throw new Error(`Failed to add Figma file: ${addFileResult.error}`);
      }

      // Step 2: Extract node ID from URL if not provided
      const nodeId = this.config.nodeId || this.extractNodeIdFromUrl(this.config.prototypeUrl);
      result.nodeId = nodeId;

      this.log('info', `Analyzing node: ${nodeId || 'default'}`);

      // Step 3: Get metadata
      if (this.config.extractComponents) {
        this.log('info', 'Extracting component metadata...');
        const metadataResult = await this.mcpClient.getFigmaMetadata(nodeId || undefined, {
          clientFrameworks: this.config.clientFrameworks,
          clientLanguages: this.config.clientLanguages
        });

        if (metadataResult.success) {
          result.metadata = this.parseMetadata(metadataResult.content);
          result.components = this.extractComponentsFromMetadata(result.metadata);
        }
      }

      // Step 4: Extract design tokens/variables
      if (this.config.extractVariables) {
        this.log('info', 'Extracting design variables...');
        const variablesResult = await this.mcpClient.getFigmaVariables(nodeId || undefined, {
          clientFrameworks: this.config.clientFrameworks,
          clientLanguages: this.config.clientLanguages
        });

        if (variablesResult.success) {
          result.designTokens = this.parseDesignTokens(variablesResult.content);
        }
      }

      // Step 5: Generate screenshots
      if (this.config.extractScreenshots) {
        this.log('info', 'Generating component screenshots...');
        const screenshotResult = await this.mcpClient.getFigmaScreenshot(nodeId || undefined, {
          clientFrameworks: this.config.clientFrameworks,
          clientLanguages: this.config.clientLanguages
        });

        if (screenshotResult.success) {
          result.screenshots[nodeId || 'default'] = screenshotResult.content;
        }
      }

      // Step 6: Generate code
      if (this.config.generateCode) {
        this.log('info', 'Generating component code...');
        const codeResult = await this.mcpClient.getFigmaCode(nodeId || undefined, {
          clientFrameworks: this.config.clientFrameworks,
          clientLanguages: this.config.clientLanguages,
          forceCode: true
        });

        if (codeResult.success) {
          result.generatedCode[nodeId || 'default'] = this.extractCodeFromContent(codeResult.content);
        }

        // Also get Code Connect mapping
        const codeConnectResult = await this.mcpClient.getCodeConnect(nodeId || undefined, {
          clientFrameworks: this.config.clientFrameworks,
          clientLanguages: this.config.clientLanguages
        });

        if (codeConnectResult.success) {
          this.log('info', 'Code Connect mapping retrieved');
          result.metadata.codeConnect = codeConnectResult.content;
        }
      }

      // Step 7: Create design system rules
      this.log('info', 'Creating design system rules...');
      const designSystemResult = await this.mcpClient.createDesignSystemRules({
        clientFrameworks: this.config.clientFrameworks,
        clientLanguages: this.config.clientLanguages
      });

      if (designSystemResult.success) {
        result.metadata.designSystemRules = designSystemResult.content;
      }

      result.success = true;
      this.log('info', `Figma prototype analysis completed successfully`);
      this.log('info', `Extracted: ${result.designTokens.length} tokens, ${result.components.length} components`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.error = errorMessage;
      this.log('error', `Figma analysis failed: ${errorMessage}`);
    } finally {
      // Clean up connection
      if (this.mcpClient.connected) {
        await this.mcpClient.disconnect();
      }
    }

    return result;
  }

  /**
   * Extract node ID from Figma prototype URL
   */
  private extractNodeIdFromUrl(url: string): string | null {
    try {
      const match = url.match(/node-id=([^&]+)/);
      if (match) {
        // Convert URL-encoded node ID format to proper format
        return match[1].replace(/-/g, ':');
      }
      return null;
    } catch (error) {
      this.log('warn', `Failed to extract node ID from URL: ${error}`);
      return null;
    }
  }

  /**
   * Parse metadata from MCP response
   */
  private parseMetadata(content: any): Record<string, any> {
    try {
      if (typeof content === 'string') {
        return { rawMetadata: content };
      }
      return content || {};
    } catch (error) {
      this.log('warn', `Failed to parse metadata: ${error}`);
      return {};
    }
  }

  /**
   * Extract components from metadata
   */
  private extractComponentsFromMetadata(metadata: Record<string, any>): FigmaComponent[] {
    const components: FigmaComponent[] = [];
    
    try {
      // Parse the metadata structure and extract component information
      // This will depend on the actual structure returned by the Figma MCP tools
      
      if (metadata.rawMetadata && typeof metadata.rawMetadata === 'string') {
        // Parse XML-like metadata structure
        const componentMatches = metadata.rawMetadata.match(/<(\w+)[^>]*>/g) || [];
        
        componentMatches.forEach((match, index) => {
          const nameMatch = match.match(/name="([^"]+)"/);
          const typeMatch = match.match(/<(\w+)/);
          
          if (nameMatch && typeMatch) {
            components.push({
              id: `component-${index}`,
              name: nameMatch[1],
              type: typeMatch[1],
              properties: {}
            });
          }
        });
      }
      
      return components;
    } catch (error) {
      this.log('warn', `Failed to extract components: ${error}`);
      return [];
    }
  }

  /**
   * Parse design tokens from variables
   */
  private parseDesignTokens(content: any): FigmaDesignToken[] {
    const tokens: FigmaDesignToken[] = [];
    
    try {
      if (typeof content === 'object' && content !== null) {
        // Parse variable definitions object
        for (const [name, value] of Object.entries(content)) {
          tokens.push({
            name,
            value: String(value),
            type: this.inferTokenType(name, String(value)),
            category: this.inferTokenCategory(name)
          });
        }
      }
      
      return tokens;
    } catch (error) {
      this.log('warn', `Failed to parse design tokens: ${error}`);
      return [];
    }
  }

  /**
   * Infer token type from name and value
   */
  private inferTokenType(name: string, value: string): FigmaDesignToken['type'] {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('color') || value.startsWith('#') || value.startsWith('rgb')) {
      return 'color';
    }
    if (lowerName.includes('spacing') || lowerName.includes('margin') || lowerName.includes('padding')) {
      return 'spacing';
    }
    if (lowerName.includes('font') || lowerName.includes('text') || lowerName.includes('size')) {
      return 'typography';
    }
    if (lowerName.includes('border') || lowerName.includes('stroke')) {
      return 'border';
    }
    if (lowerName.includes('shadow') || lowerName.includes('drop')) {
      return 'shadow';
    }
    
    return 'color'; // default
  }

  /**
   * Infer token category from name
   */
  private inferTokenCategory(name: string): string {
    const parts = name.split('/');
    return parts[0] || 'default';
  }

  /**
   * Extract code from MCP content
   */
  private extractCodeFromContent(content: any): string {
    try {
      if (typeof content === 'string') {
        return content;
      }
      
      if (Array.isArray(content)) {
        return content.map(item => 
          typeof item === 'object' && item.text ? item.text : String(item)
        ).join('\n');
      }
      
      if (typeof content === 'object' && content !== null) {
        // Look for code-like properties
        return content.code || content.text || JSON.stringify(content, null, 2);
      }
      
      return String(content);
    } catch (error) {
      this.log('warn', `Failed to extract code: ${error}`);
      return '';
    }
  }

  /**
   * Generate implementation report
   */
  async generateImplementationReport(analysisResult: FigmaAnalysisResult): Promise<string> {
    const report = [];
    
    report.push('# Figma Prototype Implementation Report');
    report.push('');
    report.push(`**Prototype URL:** ${analysisResult.prototypeUrl}`);
    report.push(`**Node ID:** ${analysisResult.nodeId || 'N/A'}`);
    report.push(`**Analysis Status:** ${analysisResult.success ? '✅ Success' : '❌ Failed'}`);
    report.push('');

    if (analysisResult.error) {
      report.push('## ❌ Error');
      report.push(analysisResult.error);
      report.push('');
    }

    if (analysisResult.designTokens.length > 0) {
      report.push('## 🎨 Design Tokens');
      report.push('');
      
      const tokensByCategory = analysisResult.designTokens.reduce((acc, token) => {
        if (!acc[token.category]) acc[token.category] = [];
        acc[token.category].push(token);
        return acc;
      }, {} as Record<string, FigmaDesignToken[]>);

      for (const [category, tokens] of Object.entries(tokensByCategory)) {
        report.push(`### ${category}`);
        report.push('');
        tokens.forEach(token => {
          report.push(`- **${token.name}** (${token.type}): \`${token.value}\``);
        });
        report.push('');
      }
    }

    if (analysisResult.components.length > 0) {
      report.push('## 🧩 Components');
      report.push('');
      analysisResult.components.forEach(component => {
        report.push(`### ${component.name}`);
        report.push(`- **Type:** ${component.type}`);
        report.push(`- **ID:** ${component.id}`);
        if (component.code) {
          report.push('- **Generated Code:** Available');
        }
        if (component.screenshot) {
          report.push('- **Screenshot:** Available');
        }
        report.push('');
      });
    }

    if (Object.keys(analysisResult.generatedCode).length > 0) {
      report.push('## 💻 Generated Code');
      report.push('');
      for (const [nodeId, code] of Object.entries(analysisResult.generatedCode)) {
        report.push(`### Node: ${nodeId}`);
        report.push('```tsx');
        report.push(code);
        report.push('```');
        report.push('');
      }
    }

    return report.join('\n');
  }

  /**
   * Structured logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [FigmaAnalyzer]`;
    
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    
    switch (level) {
      case 'debug':
        if (process.env.DEBUG) console.debug(`${prefix} ${logMessage}`);
        break;
      case 'info':
        console.log(`${prefix} ${logMessage}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${logMessage}`);
        break;
      case 'error':
        console.error(`${prefix} ${logMessage}`);
        break;
    }
  }
}