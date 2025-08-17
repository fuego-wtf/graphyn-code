import fs from 'fs';
import path from 'path';
import glob from 'glob';
import chalk from 'chalk';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

export interface DetectedAgent {
  path: string;
  filename: string;
  directory: string;
  projectPath: string;
}

export class AgentDetector {
  /**
   * Scan for .claude/agents directories in the current project and parent directories
   */
  async detectAgents(startPath: string = process.cwd()): Promise<DetectedAgent[]> {
    const agents: DetectedAgent[] = [];
    
    // Start from current directory and go up to find .claude/agents
    let currentPath = startPath;
    const searchPaths: string[] = [];
    
    // Search current and parent directories (up to 5 levels)
    for (let i = 0; i < 5; i++) {
      searchPaths.push(currentPath);
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) break; // Reached root
      currentPath = parentPath;
    }
    
    // Search for .claude/agents in each path
    for (const searchPath of searchPaths) {
      const claudeAgentsPath = path.join(searchPath, '.claude', 'agents');
      
      if (fs.existsSync(claudeAgentsPath)) {
        try {
          const files = fs.readdirSync(claudeAgentsPath);
          const mdFiles = files.filter(file => file.endsWith('.md'));
          
          for (const file of mdFiles) {
            agents.push({
              path: path.join(claudeAgentsPath, file),
              filename: file,
              directory: claudeAgentsPath,
              projectPath: searchPath
            });
          }
        } catch (error) {
          console.debug(`Error reading ${claudeAgentsPath}:`, error);
        }
      }
    }
    
    return agents;
  }
  
  /**
   * Search for .claude/agents directories recursively in a given path
   */
  async searchAgentsRecursive(searchPath: string = process.cwd()): Promise<DetectedAgent[]> {
    return new Promise((resolve, reject) => {
      const pattern = path.join(searchPath, '**', '.claude', 'agents', '*.md');
      
      glob(pattern, { 
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        dot: true 
      }, (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        
        const agents = files.map(filePath => ({
          path: filePath,
          filename: path.basename(filePath),
          directory: path.dirname(filePath),
          projectPath: filePath.split('.claude')[0].replace(/\/$/, '')
        }));
        
        resolve(agents);
      });
    });
  }
  
  /**
   * Display detected agents in a formatted way
   */
  displayAgents(agents: DetectedAgent[]): void {
    if (agents.length === 0) {
      console.log(colors.info('No .claude/agents found in the current project or parent directories.'));
      return;
    }
    
    console.log(colors.highlight(`\n🎯 Found ${agents.length} static agent${agents.length > 1 ? 's' : ''}!\n`));
    
    // Group by project
    const byProject = new Map<string, DetectedAgent[]>();
    for (const agent of agents) {
      const existing = byProject.get(agent.projectPath) || [];
      existing.push(agent);
      byProject.set(agent.projectPath, existing);
    }
    
    // Display grouped agents
    for (const [projectPath, projectAgents] of byProject) {
      const relativePath = path.relative(process.cwd(), projectPath) || '.';
      console.log(colors.info(`📁 ${relativePath}/`));
      
      for (const agent of projectAgents) {
        const agentName = path.basename(agent.filename, '.md');
        console.log(`   ${colors.success('→')} ${agentName}`);
      }
      console.log();
    }
  }
  
  /**
   * Check if a specific agent file exists
   */
  agentExists(agentPath: string): boolean {
    return fs.existsSync(agentPath) && agentPath.endsWith('.md');
  }
  
  /**
   * Get all agent files from a specific .claude/agents directory
   */
  getAgentsFromDirectory(claudeAgentsPath: string): DetectedAgent[] {
    if (!fs.existsSync(claudeAgentsPath)) {
      return [];
    }
    
    try {
      const files = fs.readdirSync(claudeAgentsPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      return mdFiles.map(file => ({
        path: path.join(claudeAgentsPath, file),
        filename: file,
        directory: claudeAgentsPath,
        projectPath: claudeAgentsPath.split('.claude')[0].replace(/\/$/, '')
      }));
    } catch (error) {
      console.error(colors.error(`Error reading ${claudeAgentsPath}:`), error);
      return [];
    }
  }
}

// Export singleton instance
export const agentDetector = new AgentDetector();