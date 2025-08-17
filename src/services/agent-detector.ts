import fs from 'fs';
import path from 'path';
import os from 'os';
import glob from 'fast-glob';

export interface DetectedAgent {
  path: string;
  filename: string;
  directory: string;
  source: 'project' | 'user' | 'parent';
}

/**
 * Service for detecting .claude/agents directories and agent files
 */
export class AgentDetectorService {
  private readonly agentsFolderName = '.claude/agents';
  private readonly agentFilePattern = '*.md';
  
  /**
   * Scan for .claude/agents folders and return discovered agent files
   */
  async detectAgents(): Promise<DetectedAgent[]> {
    const agents: DetectedAgent[] = [];
    
    // 1. Check current project directory
    const projectAgents = await this.scanDirectory(process.cwd(), 'project');
    agents.push(...projectAgents);
    
    // 2. Check parent directories (up to 3 levels)
    const parentAgents = await this.scanParentDirectories();
    agents.push(...parentAgents);
    
    // 3. Check user home directory
    const homeAgents = await this.scanDirectory(os.homedir(), 'user');
    agents.push(...homeAgents);
    
    // Remove duplicates based on path
    const uniqueAgents = this.deduplicateAgents(agents);
    
    return uniqueAgents;
  }
  
  /**
   * Scan a specific directory for agent files
   */
  private async scanDirectory(baseDir: string, source: DetectedAgent['source']): Promise<DetectedAgent[]> {
    const agentsDir = path.join(baseDir, '.claude', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      return [];
    }
    
    try {
      const pattern = path.join(agentsDir, this.agentFilePattern);
      const files = await glob(pattern, {
        absolute: true,
        onlyFiles: true,
        ignore: ['**/node_modules/**', '**/.git/**']
      });
      
      return files.map(filePath => ({
        path: filePath,
        filename: path.basename(filePath),
        directory: agentsDir,
        source
      }));
    } catch (error) {
      console.debug(`Failed to scan directory ${agentsDir}:`, error);
      return [];
    }
  }
  
  /**
   * Scan parent directories for agent files
   */
  private async scanParentDirectories(): Promise<DetectedAgent[]> {
    const agents: DetectedAgent[] = [];
    let currentDir = process.cwd();
    const homeDir = os.homedir();
    let levelsUp = 0;
    const maxLevels = 3;
    
    while (levelsUp < maxLevels) {
      const parentDir = path.dirname(currentDir);
      
      // Stop if we've reached the root or home directory
      if (parentDir === currentDir || parentDir === homeDir) {
        break;
      }
      
      const parentAgents = await this.scanDirectory(parentDir, 'parent');
      agents.push(...parentAgents);
      
      currentDir = parentDir;
      levelsUp++;
    }
    
    return agents;
  }
  
  /**
   * Check if a specific path contains agent files
   */
  async hasAgentsInPath(dirPath: string): Promise<boolean> {
    const agentsDir = path.join(dirPath, '.claude', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      return false;
    }
    
    try {
      const files = fs.readdirSync(agentsDir);
      return files.some(file => file.endsWith('.md'));
    } catch {
      return false;
    }
  }
  
  /**
   * Get a summary of detected agents by location
   */
  async getAgentsSummary(): Promise<{
    total: number;
    bySource: Record<DetectedAgent['source'], number>;
    locations: string[];
  }> {
    const agents = await this.detectAgents();
    
    const bySource = agents.reduce((acc, agent) => {
      acc[agent.source] = (acc[agent.source] || 0) + 1;
      return acc;
    }, {} as Record<DetectedAgent['source'], number>);
    
    const locations = [...new Set(agents.map(a => a.directory))];
    
    return {
      total: agents.length,
      bySource,
      locations
    };
  }
  
  /**
   * Remove duplicate agents based on file path
   */
  private deduplicateAgents(agents: DetectedAgent[]): DetectedAgent[] {
    const seen = new Set<string>();
    return agents.filter(agent => {
      if (seen.has(agent.path)) {
        return false;
      }
      seen.add(agent.path);
      return true;
    });
  }
  
  /**
   * Prioritize agents (prefer project > parent > user)
   */
  prioritizeAgents(agents: DetectedAgent[]): DetectedAgent[] {
    const priority = { project: 0, parent: 1, user: 2 };
    
    return agents.sort((a, b) => {
      const priorityDiff = priority[a.source] - priority[b.source];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Sort alphabetically within same source
      return a.filename.localeCompare(b.filename);
    });
  }
}