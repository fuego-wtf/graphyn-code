/**
 * Agent Registry - Loads and manages agent profiles from .claude/agents/
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { AgentProfile } from './types.js';
import chalk from 'chalk';

export class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();
  private agentDirectory: string;

  constructor(projectRoot: string = process.cwd()) {
    // Look for .claude/agents in current project or parent workspace
    this.agentDirectory = this.findAgentDirectory(projectRoot);
  }

  /**
   * Find the .claude/agents directory
   */
  private findAgentDirectory(startPath: string): string {
    const paths = [
      join(startPath, '.claude', 'agents'),
      join(startPath, '..', '.claude', 'agents'),
      join(startPath, '..', '..', '.claude', 'agents'),
      // Also check the workspace root
      '/Users/resatugurulu/Developer/graphyn-workspace/.claude/agents'
    ];

    for (const path of paths) {
      try {
        const files = readdirSync(path).filter(file => file.endsWith('.md'));
        if (files.length > 0) {
          return path;
        }
        // Continue to next path if directory is empty or has no .md files
      } catch {
        // Continue to next path
      }
    }

    throw new Error('Could not find .claude/agents directory');
  }

  /**
   * Load all agent profiles from the directory
   */
  async loadAgents(): Promise<void> {
    try {
      const files = readdirSync(this.agentDirectory)
        .filter(file => file.endsWith('.md'))
        .filter(file => !file.startsWith('.'));

      console.log(chalk.cyan(`📂 Loading ${files.length} agents from ${this.agentDirectory}`));

      for (const file of files) {
        try {
          const agent = this.parseAgentFile(join(this.agentDirectory, file));
          this.agents.set(agent.name, agent);
          console.log(chalk.gray(`  ✓ Loaded ${agent.name} (${agent.specializations.length} specializations)`));
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to load ${file}:`), error);
        }
      }

      console.log(chalk.green(`🤖 Successfully loaded ${this.agents.size} agents`));
    } catch (error) {
      console.error(chalk.red('Failed to load agents:'), error);
      throw error;
    }
  }

  /**
   * Parse an individual agent markdown file
   */
  private parseAgentFile(filePath: string): AgentProfile {
    const content = readFileSync(filePath, 'utf-8');
    
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('No frontmatter found in agent file');
    }

    const frontmatter = this.parseYamlFrontmatter(frontmatterMatch[1]);
    const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Extract capabilities and specializations from content
    const capabilities = this.extractCapabilities(bodyContent);
    const specializations = this.extractSpecializations(bodyContent);

    return {
      name: frontmatter.name,
      description: frontmatter.description || '',
      model: frontmatter.model || 'opus',
      color: frontmatter.color || 'white',
      capabilities,
      specializations,
      workloadScore: 0 // Will be updated based on current assignments
    };
  }

  /**
   * Simple YAML frontmatter parser
   */
  private parseYamlFrontmatter(yaml: string): any {
    const result: any = {};
    const lines = yaml.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        result[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }

    return result;
  }

  /**
   * Extract capabilities from agent content
   */
  private extractCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    
    // Look for bullet points and numbered lists that indicate capabilities
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract from patterns like "- **Capability**: description"
      const capabilityMatch = trimmed.match(/^[-*]\s*\*\*(.+?)\*\*:/);
      if (capabilityMatch) {
        capabilities.push(capabilityMatch[1].toLowerCase().trim());
      }

      // Extract from patterns like "1. **Capability**:"
      const numberedMatch = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*:/);
      if (numberedMatch) {
        capabilities.push(numberedMatch[1].toLowerCase().trim());
      }
    }

    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Extract specializations from agent content
   */
  private extractSpecializations(content: string): string[] {
    const specializations: string[] = [];
    const lowerContent = content.toLowerCase();

    // Technology specializations
    const techKeywords = [
      'typescript', 'javascript', 'node.js', 'react', 'next.js', 'python',
      'encore.dev', 'strands', 'postgresql', 'redis', 'docker', 'api',
      'oauth', 'authentication', 'cli', 'sdk', 'testing', 'deployment',
      'architecture', 'frontend', 'backend', 'fullstack', 'ai', 'agent'
    ];

    for (const keyword of techKeywords) {
      if (lowerContent.includes(keyword)) {
        specializations.push(keyword);
      }
    }

    // Domain specializations
    const domainKeywords = [
      'coordination', 'orchestration', 'task management', 'workflow',
      'code review', 'testing', 'documentation', 'deployment', 'monitoring',
      'performance optimization', 'security', 'database design', 'ui/ux'
    ];

    for (const keyword of domainKeywords) {
      if (lowerContent.includes(keyword)) {
        specializations.push(keyword);
      }
    }

    return [...new Set(specializations)]; // Remove duplicates
  }

  /**
   * Get all loaded agents
   */
  getAgents(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): AgentProfile | undefined {
    return this.agents.get(name);
  }

  /**
   * Update agent workload score
   */
  updateWorkloadScore(agentName: string, score: number): void {
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.workloadScore = Math.max(0, Math.min(100, score));
    }
  }

  /**
   * Get agents sorted by capability match for a given task
   */
  getAgentsByCapability(taskKeywords: string[]): AgentProfile[] {
    const agents = this.getAgents();
    const lowerKeywords = taskKeywords.map(k => k.toLowerCase());

    return agents
      .map(agent => ({
        agent,
        score: this.calculateMatchScore(agent, lowerKeywords)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ agent }) => agent);
  }

  /**
   * Calculate match score between agent and task keywords
   */
  private calculateMatchScore(agent: AgentProfile, keywords: string[]): number {
    let score = 0;
    const allAgentKeywords = [
      ...agent.capabilities,
      ...agent.specializations,
      agent.name.toLowerCase(),
      agent.description.toLowerCase()
    ].join(' ');

    for (const keyword of keywords) {
      if (allAgentKeywords.includes(keyword)) {
        score += 1;
      }
      
      // Partial matches get lower score
      const words = keyword.split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && allAgentKeywords.includes(word)) {
          score += 0.3;
        }
      }
    }

    // Penalize high workload
    const workloadPenalty = agent.workloadScore / 100;
    return Math.max(0, score * (1 - workloadPenalty * 0.5));
  }
}