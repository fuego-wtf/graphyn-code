import type { Task } from './claude-task-generator.js';
import type { AgentConfig } from '../types/agent.js';
import chalk from 'chalk';

export class ClaudeOutputParser {
  parseTasks(claudeOutput: string, agents: AgentConfig[]): Task[] {
    try {
      // First check if this is Claude's JSON output format
      try {
        const parsedOutput = JSON.parse(claudeOutput);
        
        // Handle Claude's --output-format json wrapper
        if (parsedOutput.result) {
          claudeOutput = parsedOutput.result;
        }
      } catch {
        // Not a JSON wrapper, continue with raw output
      }
      
      // First try to extract JSON from code blocks
      const jsonMatch = claudeOutput.match(/```json\n([\s\S]*?)\n```/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1];
        return this.parseAndValidateTasks(jsonString, agents);
      }
      
      // Try to find JSON array in the output (improved regex for multi-line)
      const arrayMatch = claudeOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
      
      if (arrayMatch) {
        return this.parseAndValidateTasks(arrayMatch[0], agents);
      }
      
      // Last resort: try to parse the entire output as JSON
      return this.parseAndValidateTasks(claudeOutput.trim(), agents);
      
    } catch (error) {
      console.error(chalk.red('Failed to parse Claude output:'), error);
      console.error(chalk.gray('Raw output:'), claudeOutput.substring(0, 500) + '...');
      
      // Throw error instead of using fallback
      throw new Error(`Failed to parse task output from Claude: ${error.message}`);
    }
  }

  private parseAndValidateTasks(jsonString: string, agents: AgentConfig[]): Task[] {
    let rawTasks: any[];
    
    try {
      rawTasks = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    
    if (!Array.isArray(rawTasks)) {
      throw new Error('Output is not an array of tasks');
    }
    
    return rawTasks.map((task, index) => this.validateAndNormalizeTask(task, index, agents));
  }

  private validateAndNormalizeTask(rawTask: any, index: number, agents: AgentConfig[]): Task {
    // Ensure required fields
    const task: Task = {
      id: rawTask.id || `task_${index + 1}`,
      title: this.truncateString(rawTask.title || `Task ${index + 1}`, 60),
      description: rawTask.description || 'No description provided',
      assigned_agent: this.normalizeAgentAssignment(rawTask.assigned_agent, agents),
      dependencies: this.normalizeDependencies(rawTask.dependencies),
      estimated_complexity: this.normalizeComplexity(rawTask.estimated_complexity),
      acceptance_criteria: this.normalizeAcceptanceCriteria(rawTask.acceptance_criteria),
      status: 'pending'
    };
    
    // Find agent ID if possible
    const assignedAgent = agents.find(
      a => a?.name?.toLowerCase() === task.assigned_agent.toLowerCase()
    );
    
    if (assignedAgent) {
      task.assigned_agent_id = assignedAgent.id;
    }
    
    return task;
  }

  private normalizeAgentAssignment(agentName: any, agents: AgentConfig[]): string {
    // Check for invalid values including the string "undefined"
    if (!agentName || typeof agentName !== 'string' || agentName === 'undefined' || agentName === 'null') {
      // Default to first agent
      return agents[0]?.name || 'backend';
    }
    
    // Try to match agent name (case-insensitive)
    const normalizedName = agentName.toLowerCase().trim();
    const matchedAgent = agents.find(
      a => a?.name?.toLowerCase() === normalizedName ||
           a?.role?.toLowerCase().includes(normalizedName)
    );
    
    return matchedAgent ? matchedAgent.name : agents[0]?.name || agentName;
  }

  private normalizeDependencies(deps: any): string[] {
    if (!deps) return [];
    if (Array.isArray(deps)) {
      return deps.filter(d => typeof d === 'string');
    }
    if (typeof deps === 'string') {
      return [deps];
    }
    return [];
  }

  private normalizeComplexity(complexity: any): 'low' | 'medium' | 'high' {
    if (typeof complexity !== 'string') return 'medium';
    
    const normalized = complexity.toLowerCase().trim();
    if (['low', 'medium', 'high'].includes(normalized)) {
      return normalized as 'low' | 'medium' | 'high';
    }
    
    // Map common variations
    if (['easy', 'simple', 'trivial'].includes(normalized)) return 'low';
    if (['hard', 'difficult', 'complex'].includes(normalized)) return 'high';
    
    return 'medium';
  }

  private normalizeAcceptanceCriteria(criteria: any): string[] {
    if (!criteria) return ['Task completed successfully'];
    
    if (Array.isArray(criteria)) {
      return criteria
        .filter(c => typeof c === 'string' && c.trim().length > 0)
        .map(c => c.trim());
    }
    
    if (typeof criteria === 'string') {
      return [criteria.trim()];
    }
    
    return ['Task completed successfully'];
  }

  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }


  parseStreamingOutput(chunks: string[]): Task[] | null {
    // Accumulate chunks
    const fullOutput = chunks.join('');
    
    // Check if we have a complete JSON array
    if (fullOutput.includes('[') && fullOutput.includes(']')) {
      try {
        return this.parseTasks(fullOutput, []);
      } catch {
        // Not complete yet
        return null;
      }
    }
    
    return null;
  }
}