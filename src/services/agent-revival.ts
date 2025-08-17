import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { AgentDetectorService } from './agent-detector.js';
import { AgentParserService, ParsedAgent } from './agent-parser.js';
import { apiClient } from '../api/client.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface RevivalOptions {
  interactive?: boolean;
  all?: boolean;
  select?: string[];
  dryRun?: boolean;
}

export interface RevivalResult {
  total: number;
  succeeded: number;
  failed: number;
  agents: Array<{
    name: string;
    id?: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }>;
}

/**
 * Main service for reviving static .claude/agents into living Graphyn agents
 */
export class AgentRevivalService {
  private detector: AgentDetectorService;
  private parser: AgentParserService;
  
  constructor() {
    this.detector = new AgentDetectorService();
    this.parser = new AgentParserService();
  }
  
  /**
   * Check if there are any agents available to revive
   */
  async hasAgentsToRevive(): Promise<boolean> {
    const summary = await this.detector.getAgentsSummary();
    return summary.total > 0;
  }
  
  /**
   * Main revival flow
   */
  async reviveAgents(options: RevivalOptions = {}): Promise<RevivalResult> {
    console.log(colors.highlight('\n🎯 Agent Revival System\n'));
    
    // Step 1: Detect agents
    const spinner = ora('Scanning for static agents...').start();
    const detected = await this.detector.detectAgents();
    
    if (detected.length === 0) {
      spinner.fail('No static agents found');
      console.log(colors.info('\nCreate .claude/agents/*.md files to define agents that can be brought to life!'));
      return { total: 0, succeeded: 0, failed: 0, agents: [] };
    }
    
    // Prioritize agents
    const prioritized = this.detector.prioritizeAgents(detected);
    spinner.succeed(`Found ${detected.length} static agents`);
    
    // Step 2: Parse agents
    const parsed = await this.parser.parseAgents(prioritized);
    
    // Show summary
    console.log(colors.bold('\nDiscovered Agents:'));
    const summaries = this.parser.generateSummary(parsed);
    summaries.forEach(summary => console.log(`  ${summary}`));
    
    // Step 3: Select agents to revive
    let selectedAgents: ParsedAgent[];
    
    if (options.all) {
      selectedAgents = parsed;
    } else if (options.select && options.select.length > 0) {
      selectedAgents = parsed.filter(agent => 
        options.select!.includes(agent.name)
      );
    } else if (options.interactive) {
      selectedAgents = await this.interactiveSelection(parsed);
    } else {
      selectedAgents = parsed;
    }
    
    if (selectedAgents.length === 0) {
      console.log(colors.info('\nNo agents selected for revival.'));
      return { total: 0, succeeded: 0, failed: 0, agents: [] };
    }
    
    // Step 4: Check authentication
    const isAuth = await apiClient.isAuthenticated();
    if (!isAuth && !options.dryRun) {
      console.log(colors.warning('\n⚠️  You need to be authenticated to revive agents on Graphyn.'));
      const { authenticate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'authenticate',
          message: 'Would you like to authenticate now?',
          default: true
        }
      ]);
      
      if (authenticate) {
        await apiClient.authenticate();
      } else {
        console.log(colors.info('Run "graphyn auth" to authenticate when ready.'));
        return { total: selectedAgents.length, succeeded: 0, failed: 0, agents: [] };
      }
    }
    
    // Step 5: Revive agents
    console.log(colors.bold(`\n🔮 Bringing ${selectedAgents.length} agents to life...\n`));
    const result = await this.performRevival(selectedAgents, options);
    
    // Step 6: Save revival record
    await this.saveRevivalRecord(result);
    
    // Show results
    this.showRevivalResults(result);
    
    return result;
  }
  
  /**
   * Interactive agent selection
   */
  private async interactiveSelection(agents: ParsedAgent[]): Promise<ParsedAgent[]> {
    const choices = agents.map(agent => ({
      name: `${agent.name} - ${this.truncate(agent.description, 60)}`,
      value: agent,
      checked: agent.sourceType === 'project' // Pre-select project agents
    }));
    
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select agents to bring to life:',
        choices,
        pageSize: 10,
        validate: (answer) => {
          if (answer.length === 0) {
            return 'You must select at least one agent';
          }
          return true;
        }
      }
    ]);
    
    return selected;
  }
  
  /**
   * Perform the actual revival by creating agents via API
   */
  private async performRevival(agents: ParsedAgent[], options: RevivalOptions): Promise<RevivalResult> {
    const result: RevivalResult = {
      total: agents.length,
      succeeded: 0,
      failed: 0,
      agents: []
    };
    
    for (const agent of agents) {
      const spinner = ora(`Reviving ${agent.name}...`).start();
      
      try {
        // Validate agent
        const validation = this.parser.validateAgent(agent);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        if (options.dryRun) {
          spinner.succeed(`[DRY RUN] Would revive ${agent.name}`);
          result.agents.push({
            name: agent.name,
            status: 'success'
          });
          result.succeeded++;
          continue;
        }
        
        // Create agent via API
        const created = await apiClient.createAgent({
          name: agent.graphynFormat!.name,
          description: agent.graphynFormat!.description,
          instructions: agent.graphynFormat!.instructions,
          model: agent.graphynFormat!.model
        });
        
        spinner.succeed(`Revived ${agent.name} (ID: ${created.id})`);
        result.agents.push({
          name: agent.name,
          id: created.id,
          status: 'success'
        });
        result.succeeded++;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(`Failed to revive ${agent.name}`);
        console.log(colors.error(`  Error: ${errorMsg}`));
        
        result.agents.push({
          name: agent.name,
          status: 'failed',
          error: errorMsg
        });
        result.failed++;
      }
    }
    
    return result;
  }
  
  /**
   * Save a record of revived agents to .graphyn/agents.json
   */
  private async saveRevivalRecord(result: RevivalResult): Promise<void> {
    if (result.succeeded === 0) return;
    
    const graphynDir = path.join(process.cwd(), '.graphyn');
    const recordPath = path.join(graphynDir, 'agents.json');
    
    // Ensure directory exists
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }
    
    // Load existing record
    let record: any = {};
    if (fs.existsSync(recordPath)) {
      try {
        record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      } catch {
        record = {};
      }
    }
    
    // Update record
    if (!record.revivals) {
      record.revivals = [];
    }
    
    record.revivals.push({
      timestamp: new Date().toISOString(),
      succeeded: result.succeeded,
      failed: result.failed,
      agents: result.agents.filter(a => a.status === 'success').map(a => ({
        name: a.name,
        id: a.id
      }))
    });
    
    // Save updated record
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
  }
  
  /**
   * Show revival results to user
   */
  private showRevivalResults(result: RevivalResult): void {
    console.log(colors.bold('\n✨ Revival Complete!\n'));
    
    if (result.succeeded > 0) {
      console.log(colors.success(`✓ Successfully revived ${result.succeeded} agents`));
      console.log(colors.info('\nYour static agents are now alive on Graphyn!'));
      console.log(colors.info('They can now:'));
      console.log(colors.info('  • Learn from conversations'));
      console.log(colors.info('  • Collaborate with other agents'));
      console.log(colors.info('  • Evolve and improve over time'));
      console.log(colors.info('  • Be accessed via API'));
    }
    
    if (result.failed > 0) {
      console.log(colors.warning(`\n⚠️  Failed to revive ${result.failed} agents`));
      console.log(colors.info('Check the errors above and try again.'));
    }
    
    console.log(colors.highlight('\nNext steps:'));
    console.log(colors.info('  • Use "graphyn agents list" to see your living agents'));
    console.log(colors.info('  • Start conversations with "graphyn chat <agent-name>"'));
    console.log(colors.info('  • Create threads with "graphyn thread create"'));
  }
  
  /**
   * List all previously revived agents
   */
  async listRevivedAgents(): Promise<void> {
    const recordPath = path.join(process.cwd(), '.graphyn', 'agents.json');
    
    if (!fs.existsSync(recordPath)) {
      console.log(colors.info('No agents have been revived yet.'));
      console.log(colors.info('Run "graphyn agents revive" to bring your static agents to life!'));
      return;
    }
    
    try {
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      
      if (!record.revivals || record.revivals.length === 0) {
        console.log(colors.info('No agents have been revived yet.'));
        return;
      }
      
      console.log(colors.bold('\n📜 Revival History:\n'));
      
      for (const revival of record.revivals) {
        const date = new Date(revival.timestamp).toLocaleString();
        console.log(colors.highlight(`Revival on ${date}:`));
        console.log(colors.success(`  ✓ ${revival.succeeded} agents revived`));
        
        if (revival.agents && revival.agents.length > 0) {
          console.log(colors.info('  Agents:'));
          for (const agent of revival.agents) {
            console.log(colors.info(`    • ${agent.name} (${agent.id})`));
          }
        }
        console.log();
      }
    } catch (error) {
      console.error(colors.error('Failed to read revival record:'), error);
    }
  }
  
  /**
   * Helper to truncate strings
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }
}