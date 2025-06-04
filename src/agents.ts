import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import { AuthManager } from './auth';
import { config } from './config';

const colors = {
  primary: chalk.blueBright,
  secondary: chalk.magenta,
  accent: chalk.yellow,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray
};

export class AgentManager {
  private authManager: AuthManager;

  constructor() {
    this.authManager = new AuthManager();
  }

  async startInteractiveSession(type: string): Promise<void> {
    // Get the prompt file path
    const promptsDir = path.join(__dirname, '..', 'prompts');
    const promptFile = path.join(promptsDir, `${type}.md`);
    
    if (!fs.existsSync(promptFile)) {
      console.log(colors.error(`Prompt file not found: ${promptFile}`));
      return;
    }
    
    try {
      // Read the prompt content
      const promptContent = fs.readFileSync(promptFile, 'utf8');
      
      console.log(colors.primary(`\n🚀 ${type.charAt(0).toUpperCase() + type.slice(1)} Agent Interactive Mode`));
      console.log(colors.info('─'.repeat(60)));
      console.log(colors.accent('Agent Context:'));
      console.log(promptContent);
      console.log(colors.info('─'.repeat(60)));
      console.log(colors.success('\n✓ Agent context loaded!'));
      console.log(colors.info('You can now interact with this specialized agent context.'));
      console.log(colors.accent('\n💡 Tip: Ask questions or request implementations based on the context above.\n'));
      
    } catch (error) {
      console.error(colors.error(`Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`));
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
    const { spawn } = require('child_process');
    const os = require('os');
    
    const promptsDir = path.join(__dirname, '..', 'prompts');
    const promptFile = path.join(promptsDir, `${type}.md`);
    
    if (!fs.existsSync(promptFile)) {
      return this.getFallbackResponse(type, query);
    }

    try {
      const promptContent = fs.readFileSync(promptFile, 'utf8');
      
      const fullContent = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Agent Context

${promptContent}

# User Query

${query}

# Instructions

Please analyze the above query in the context of the ${type} agent role and provide a comprehensive response.`;
      
      console.log(colors.info(`\n🚀 Launching Claude Code with ${type} agent context...`));
      
      // Try to launch Claude Code
      const claudePath = '/Users/resatugurulu/.claude/local/claude';
      
      if (fs.existsSync(claudePath)) {
        // Pass the full content directly as the initial prompt
        const claude = spawn(claudePath, [fullContent], {
          stdio: 'inherit',
          env: { ...process.env }
        });
        
        claude.on('error', (error: any) => {
          console.error(colors.error(`Failed to start Claude: ${error.message}`));
          // Save as fallback
          const tmpDir = os.tmpdir();
          const tmpFile = path.join(tmpDir, `graphyn-${type}-${Date.now()}.md`);
          fs.writeFileSync(tmpFile, fullContent);
          console.log(colors.info(`\nContext saved to: ${tmpFile}`));
          console.log(colors.accent('You can copy the content and paste it in Claude Code.'));
        });
        
        return '';
      } else {
        console.log(colors.warning('⚠️  Claude CLI not found at expected location.'));
        // Save content to file as fallback
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `graphyn-${type}-${Date.now()}.md`);
        fs.writeFileSync(tmpFile, fullContent);
        console.log(colors.info(`\nContext saved to: ${tmpFile}`));
        console.log(colors.accent(`You can copy and paste the content from this file into Claude Code.`));
        return '';
      }
      
    } catch (error) {
      console.log(colors.warning('⚠️  Failed to launch Claude Code.'));
      return this.getFallbackResponse(type, query);
    }
  }

  async chainAgents(query: string): Promise<void> {
    console.log(colors.primary('🔗 Starting agent chain...'));
    console.log();

    const agents = ['backend', 'frontend', 'architect'];
    const responses: string[] = [];

    for (const agent of agents) {
      console.log(colors.info(`▸ Running ${agent} agent...`));
      const response = await this.queryAgent(agent, query + (responses.length > 0 ? `\n\nPrevious responses:\n${responses.join('\n')}` : ''));
      responses.push(response);
      console.log(response);
      console.log(colors.primary('─'.repeat(60)));
    }

    console.log();
    console.log(colors.success('✓ Agent chain completed'));
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

    // Try to read GRAPHYN.md if it exists
    const graphynMdPath = path.join(process.cwd(), 'GRAPHYN.md');
    if (fs.existsSync(graphynMdPath)) {
      try {
        context.graphynMd = fs.readFileSync(graphynMdPath, 'utf8');
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
      backend: 'server-side development, APIs, and databases',
      frontend: 'user interfaces, components, and user experience',
      architect: 'system design, architecture decisions, and best practices'
    };

    return `
${colors.info(`🤖 ${type.charAt(0).toUpperCase() + type.slice(1)} Agent`)}
${colors.primary('─'.repeat(40))}

Query: ${query}

${colors.accent('Agent Focus:')}
I specialize in ${typeDescriptions[type as keyof typeof typeDescriptions]}.

${colors.accent('Local Mode:')}
You're currently running in local mode. For full AI capabilities:
• Get your free API key at https://graphyn.xyz/code
• Run "graphyn auth gph_your_api_key"

${colors.accent('Quick Help:')}
For ${type} development, consider:
• Following best practices for your tech stack
• Implementing proper error handling
• Writing tests for your code
• Documenting your work

${colors.primary('─'.repeat(40))}
`;
  }
}