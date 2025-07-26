import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { AuthManager } from './auth.js';
import { config } from './config.js';
import { 
  colors, 
  createDivider,
  agentThemes
} from './ui.js';
import { findClaude } from './utils/claude-detector.js';
import { AgentPromptService } from './services/agent-prompt-service.js';

export class AgentManager {
  private authManager: AuthManager;
  private promptService: AgentPromptService;

  constructor() {
    this.authManager = new AuthManager();
    this.promptService = new AgentPromptService();
  }

  async startInteractiveSession(type: string): Promise<void> {
    try {
      // Get prompt content (dynamic or local)
      const promptContent = await this.promptService.getAgentPrompt(type);
      
      // Get project context from map.md and focus.md
      let projectContext = '';
      const focusPath = path.join(process.cwd(), '.graphyn', 'focus.md');
      const mapPath = path.join(process.cwd(), '.graphyn', 'map.md');
      
      if (fs.existsSync(focusPath)) {
        try {
          const focusContent = fs.readFileSync(focusPath, 'utf8');
          projectContext = `\n\n# Project Focus (from focus.md)\n${focusContent}`;
        } catch (error) {
          // Ignore read errors
        }
      }
      
      if (fs.existsSync(mapPath)) {
        try {
          const mapContent = fs.readFileSync(mapPath, 'utf8');
          projectContext += `\n\n# Repository Map (from map.md)\n${mapContent}`;
        } catch (error) {
          // Ignore read errors
        }
      }
      
      // Combine agent prompt with project context
      const fullContext = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Agent Context

${promptContent}${projectContext}

# Interactive Session
You are now in an interactive session. The user will provide queries and you should respond in the context of the ${type} agent role.`;
      
      // Use claude detector instead of hardcoded path
      const claudeResult = await findClaude();
      
      if (claudeResult.found) {
        // Save context to file
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `graphyn-${type}-interactive-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, fullContext);
        
        console.log(colors.success('\n✓ Interactive agent context prepared!'));
        console.log(colors.info(`\nContext saved to: ${tmpFile}`));
        
        console.log(colors.accent('\n🚀 To start Claude Code with this agent:'));
        console.log(colors.highlight(`  claude < "${tmpFile}"`));
        console.log(colors.dim('\nOr open Claude Code and use:'));
        console.log(colors.highlight(`  /read ${tmpFile}`))
      } else {
        // Fallback display
        console.log(colors.primary(`\n🚀 ${type.charAt(0).toUpperCase() + type.slice(1)} Agent Interactive Mode`));
        console.log(colors.info('─'.repeat(60)));
        console.log(colors.accent('Agent Context:'));
        console.log(fullContext);
        console.log(colors.info('─'.repeat(60)));
        console.log(colors.success('\n✓ Agent context loaded!'));
        console.log(colors.info('You can now interact with this specialized agent context.'));
        console.log(colors.accent('\n💡 Tip: Copy this context into Claude Code.\n'));
      }
      
    } catch (error) {
      console.error(colors.error(`Failed to get agent prompt: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async queryAgent(type: string, query: string): Promise<string> {
    const apiKey = this.authManager.getApiKey();
    
    if (!apiKey) {
      return await this.getLocalPrompt(type, query);
    }

    try {
      const response = await axios.post(`${config.apiBaseUrl}/agents/${type}`, {
        query: query,
        context: this.getProjectContext()
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent
        },
        timeout: config.timeout
      });

      return this.formatApiResponse(response.data);
    } catch (error) {
      console.log(colors.warning('⚠️  API unavailable, using local prompts'));
      if (axios.isAxiosError(error)) {
        console.log(colors.info(`Error: ${error.response?.status} ${error.response?.statusText}`));
      }
      
      // Use the same approach as interactive mode
      return await this.queryWithClaudeCode(type, query);
    }
  }

  private async queryWithClaudeCode(type: string, query: string): Promise<string> {
    const theme = agentThemes[type as keyof typeof agentThemes];
    console.log();
    console.log(theme ? theme.gradient(`🚀 Launching Claude Code with ${type} agent context...`) : colors.info(`🚀 Launching Claude Code with ${type} agent context...`));
    
    // Find Claude using detector
    const claudeResult = await findClaude();
    
    // Get agent prompt (dynamic or local)
    let promptContent: string;
    try {
      promptContent = await this.promptService.getAgentPrompt(type);
    } catch (error) {
      return this.getFallbackResponse(type, query);
    }
    
    // Check for focus.md in .graphyn folder
    let projectContext = '';
    const focusPath = path.join(process.cwd(), '.graphyn', 'focus.md');
    if (fs.existsSync(focusPath)) {
      try {
        const focusContent = fs.readFileSync(focusPath, 'utf8');
        projectContext = `\n\n# Project Focus (from focus.md)\n${focusContent}`;
      } catch (error) {
        // Ignore read errors
      }
    }
    
    // Also check for map.md
    const mapPath = path.join(process.cwd(), '.graphyn', 'map.md');
    if (fs.existsSync(mapPath)) {
      try {
        const mapContent = fs.readFileSync(mapPath, 'utf8');
        projectContext += `\n\n# Repository Map (from map.md)\n${mapContent}`;
      } catch (error) {
        // Ignore read errors
      }
    }
    
    // Create full context with agent prompt
    const fullContext = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Agent Context

${promptContent}${projectContext}

# User Query
${query}

# Instructions
Please analyze the above query in the context of the ${type} agent role and provide a comprehensive response.`;
    
    // Save to temp file
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `graphyn-${type}-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, fullContext);
    
    // Log the interaction
    const { GraphynLogger } = await import('./logger');
    const logger = new GraphynLogger();
    logger.logInteraction({
      agent: type,
      query: query,
      contextFile: tmpFile,
      mode: 'cli'
    });
    
    if (claudeResult.found && claudeResult.path) {
      console.log(colors.success('\n✓ Agent context prepared and logged!'));
      console.log(colors.info(`Context saved to: ${tmpFile}`));
      
      console.log(colors.accent('\n🚀 Launching Claude Code with ' + type + ' agent context...\n'));
      
      try {
        // Use direct argument passing to avoid shell escaping issues
        const { spawnSync } = require('child_process');
        spawnSync(claudeResult.path, [fullContext], { 
          stdio: 'inherit',
          shell: false 
        });
      } catch (error) {
        // Claude exited - this is normal
      }
      
      // Clean up temp file after a delay
      setTimeout(() => {
        try { fs.unlinkSync(tmpFile); } catch (e) {}
      }, 300000); // 5 minutes
      
      return '';
    } else {
      console.log(colors.warning('\n⚠️  Claude Code not found.'));
      console.log(colors.info('\nTo install Claude Code:'));
      console.log(colors.primary('1. Visit https://claude.ai/code'));
      console.log(colors.primary('2. Download and install for your platform'));
      console.log(colors.primary('3. Run "graphyn doctor" to verify installation\n'));
      console.log(colors.info('Alternative: Copy context from:'));
      console.log(colors.dim(tmpFile));
      return 'context-saved';
    }
  }

  async chainAgents(query: string): Promise<void> {
    console.log();
    console.log(colors.bold('🔗 Starting agent chain...'));
    console.log(createDivider());
    
    const agents = ['backend', 'frontend', 'architect'];
    const responses: string[] = [];
    
    // Show progress steps without cursor manipulation
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const theme = agentThemes[agent as keyof typeof agentThemes];
      
      // Show current agent
      console.log(theme ? theme.gradient(`▸ Running ${agent} agent...`) : colors.info(`▸ Running ${agent} agent...`));
      
      const response = await this.queryAgent(agent, query + (responses.length > 0 ? `\n\nPrevious responses:\n${responses.join('\n')}` : ''));
      responses.push(response);
      
      // Show completion
      console.log(colors.success(`✓ ${agent} agent completed`));
      console.log();
    }
    
    console.log();
    console.log(colors.success.bold('✅ Agent chain completed!'));
  }

  private async getLocalPrompt(type: string, query: string): Promise<string> {
    // Redirect to the new Claude Code approach
    return await this.queryWithClaudeCode(type, query);
  }




  private getProjectContext(): any {
    const context: any = {
      workingDirectory: process.cwd(),
      timestamp: new Date().toISOString()
    };

    // Try to read focus.md and map.md from .graphyn folder
    const focusPath = path.join(process.cwd(), '.graphyn', 'focus.md');
    if (fs.existsSync(focusPath)) {
      try {
        context.focusMd = fs.readFileSync(focusPath, 'utf8');
      } catch (error) {
        // Ignore read errors
      }
    }
    
    const mapPath = path.join(process.cwd(), '.graphyn', 'map.md');
    if (fs.existsSync(mapPath)) {
      try {
        context.mapMd = fs.readFileSync(mapPath, 'utf8');
      } catch (error) {
        // Ignore read errors
      }
    }

    // Try to read package.json if it exists
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        context.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      } catch (error) {
        // Ignore parse errors
      }
    }

    return context;
  }

  private formatApiResponse(data: any): string {
    if (typeof data === 'string') {
      return data;
    }

    if (data.response) {
      return data.response;
    }

    if (data.message) {
      return data.message;
    }

    return JSON.stringify(data, null, 2);
  }

  private getFallbackResponse(type: string, query: string): string {
    const typeDescriptions = {
      backend: 'APIs that scale, databases that perform, systems that endure',
      frontend: 'interfaces that delight, experiences that convert, code that inspires',
      architect: 'decisions that last, patterns that scale, wisdom that compounds'
    };

    const philosophies = {
      backend: 'Great backends are invisible—until they\'re not. Build for the 99.9%.',
      frontend: 'Every pixel tells a story. Make yours worth remembering.',
      architect: 'Architecture is the art of making the right trade-offs at the right time.'
    };

    return `
${colors.info(`🤖 ${type.charAt(0).toUpperCase() + type.slice(1)} Agent`)}
${colors.primary('─'.repeat(50))}

${colors.bold('Your Query:')} ${query}

${colors.accent('My Philosophy:')}
${philosophies[type as keyof typeof philosophies]}

${colors.accent('I specialize in:')}
${typeDescriptions[type as keyof typeof typeDescriptions]}

${colors.accent('Living Documentation:')}
Create a focus.md file in your .graphyn folder to give me context about:
• Your tech stack and conventions
• Your team's coding standards
• Your architectural decisions

${colors.dim('This makes every interaction smarter, every suggestion more relevant.')}

${colors.accent('Ready to evolve?')}
• Get your API key: ${colors.highlight('https://graphyn.xyz/code')}
• Authenticate: ${colors.highlight('graphyn auth gph_your_api_key')}

${colors.primary('─'.repeat(50))}
${colors.dim('Built for developers who believe documentation should evolve with their code.')}
`;
  }
}