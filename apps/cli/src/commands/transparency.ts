/**
 * Transparency Commands - Live monitoring and export capabilities
 * 
 * Provides transparency tail, export, and tree commands for monitoring
 * agent execution, session logs, and process trees.
 */

import { Command } from 'commander';
import { createDatabase } from '@graphyn/db';
import { UserDataManager } from '@graphyn/core';
import { ProcessTreeVisualizer } from '@graphyn/core';
import path from 'path';

interface TransparencyOptions {
  sessionId?: string;
  level?: string;
  format?: 'text' | 'json';
  follow?: boolean;
  lines?: number;
  output?: string;
}

class TransparencyCommand {
  private readonly userDataManager = UserDataManager.getInstance();
  private dbManager: ReturnType<typeof createDatabase> | null = null;

  async initialize(): Promise<void> {
    await this.userDataManager.initialize();
    const structure = this.userDataManager.getDirectoryStructure();
    const dbPath = path.join(structure.db, 'graphyn-tasks.db');
    
    this.dbManager = createDatabase({ type: 'mock', path: dbPath });
  }

  /**
   * Tail transparency events in real-time
   */
  async tail(options: TransparencyOptions): Promise<void> {
    await this.initialize();
    
    if (!this.dbManager) {
      console.error('❌ Database not available');
      return;
    }

    console.log('📡 Tailing transparency events...');
    if (options.sessionId) {
      console.log(`🔍 Filtered by session: ${options.sessionId}`);
    }
    if (options.level) {
      console.log(`📊 Filtered by level: ${options.level}`);
    }

    // Get initial events
    const events = await this.getTransparencyEvents(options);
    this.displayEvents(events, options);

    if (options.follow) {
      console.log('\n👀 Following new events... (Press Ctrl+C to stop)');
      
      // Poll for new events every 1 second
      let lastTimestamp = new Date();
      const pollInterval = setInterval(async () => {
        try {
          const newEvents = await this.getTransparencyEvents({
            ...options,
            since: lastTimestamp
          });
          
          if (newEvents.length > 0) {
            this.displayEvents(newEvents, options);
            lastTimestamp = new Date(Math.max(...newEvents.map(e => new Date(e.eventTime || 0).getTime())));
          }
        } catch (error) {
          console.error('❌ Error fetching events:', error);
        }
      }, 1000);

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        clearInterval(pollInterval);
        console.log('\n📴 Stopped tailing transparency events');
        process.exit(0);
      });
    }
  }

  /**
   * Export transparency data
   */
  async export(options: TransparencyOptions): Promise<void> {
    await this.initialize();
    
    if (!this.dbManager) {
      console.error('❌ Database not available');
      return;
    }

    console.log('📤 Exporting transparency data...');
    
    const events = await this.getTransparencyEvents(options);
    
    if (options.format === 'json') {
      const exportData = {
        metadata: {
          exportTime: new Date().toISOString(),
          sessionId: options.sessionId,
          level: options.level,
          totalEvents: events.length
        },
        events: events
      };

      const jsonOutput = JSON.stringify(exportData, null, 2);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, jsonOutput);
        console.log(`✅ Exported ${events.length} events to ${options.output}`);
      } else {
        console.log(jsonOutput);
      }
    } else {
      // Text format
      let output = `# Transparency Export\n`;
      output += `# Generated: ${new Date().toISOString()}\n`;
      output += `# Session: ${options.sessionId || 'all'}\n`;
      output += `# Level: ${options.level || 'all'}\n`;
      output += `# Total Events: ${events.length}\n\n`;
      
      for (const event of events) {
        output += this.formatEvent(event);
        output += '\n';
      }

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(`✅ Exported ${events.length} events to ${options.output}`);
      } else {
        console.log(output);
      }
    }
  }

  /**
   * Display process tree visualization
   */
  async tree(options: TransparencyOptions): Promise<void> {
    await this.initialize();
    
    if (!this.dbManager) {
      console.error('❌ Database not available');
      return;
    }

    console.log('🌳 Process Tree Visualization');
    console.log('─'.repeat(80));

    const events = await this.getTransparencyEvents(options);
    
    if (events.length === 0) {
      console.log('└── ✅ Session Root (session) [ongoing]');
      return;
    }

    // Use ProcessTreeVisualizer for advanced tree rendering
    const visualizer = ProcessTreeVisualizer.fromTransparencyEvents(events);
    const treeOutput = visualizer.renderTree({
      showMetrics: true,
      showTimestamps: options.format === 'json',
      compactMode: false,
      maxDepth: 10
    });
    
    console.log(treeOutput);
    
    // Show statistics in JSON format
    if (options.format === 'json') {
      const stats = visualizer.getStatistics();
      console.log('\n📊 Process Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    }
  }

  private async getTransparencyEvents(options: TransparencyOptions & { since?: Date }) {
    if (!this.dbManager) return [];

    const dbOptions: any = {
      limit: options.lines || 100
    };

    if (options.sessionId) {
      dbOptions.sessionId = options.sessionId;
    }

    try {
      const events = await this.dbManager.getTransparencyEvents(dbOptions);
      
      return events.filter(event => {
        // Filter by level if specified
        if (options.level && event.level !== options.level) {
          return false;
        }
        
        // Filter by timestamp if since is specified
        if (options.since && event.eventTime) {
          const eventTime = new Date(event.eventTime);
          return eventTime > options.since;
        }
        
        return true;
      });
    } catch (error) {
      console.error('❌ Error fetching transparency events:', error);
      return [];
    }
  }

  private displayEvents(events: any[], options: TransparencyOptions): void {
    for (const event of events) {
      if (options.format === 'json') {
        console.log(JSON.stringify(event, null, 2));
      } else {
        console.log(this.formatEvent(event));
      }
    }
  }

  private formatEvent(event: any): string {
    const timestamp = event.eventTime ? new Date(event.eventTime).toISOString() : 'unknown';
    const level = event.level?.toUpperCase() || 'INFO';
    const source = event.source || 'unknown';
    const eventType = event.eventType || 'event';
    const message = event.message || '';
    
    let line = `${timestamp} [${level}] ${source}::${eventType}`;
    if (message) {
      line += ` - ${message}`;
    }
    
    if (event.metadata && Object.keys(event.metadata).length > 0) {
      const metadataStr = JSON.stringify(event.metadata);
      if (metadataStr.length < 100) {
        line += ` ${metadataStr}`;
      }
    }
    
    return line;
  }

  private buildProcessTree(events: any[]): ProcessNode {
    const root: ProcessNode = {
      id: 'root',
      name: 'Session Root',
      type: 'session',
      children: [],
      events: [],
      startTime: events[0]?.eventTime ? new Date(events[0].eventTime) : new Date(),
      status: 'completed'
    };

    const nodeMap = new Map<string, ProcessNode>();
    nodeMap.set('root', root);

    // Build tree from events
    for (const event of events) {
      const nodeId = this.getNodeIdFromEvent(event);
      const parentId = this.getParentIdFromEvent(event);

      if (!nodeMap.has(nodeId)) {
        const node: ProcessNode = {
          id: nodeId,
          name: this.getNodeNameFromEvent(event),
          type: this.getNodeTypeFromEvent(event),
          children: [],
          events: [],
          startTime: event.eventTime ? new Date(event.eventTime) : new Date(),
          status: 'running'
        };
        nodeMap.set(nodeId, node);

        // Add to parent
        const parent = nodeMap.get(parentId) || root;
        parent.children.push(node);
      }

      const node = nodeMap.get(nodeId)!;
      node.events.push(event);

      // Update status based on event
      if (event.eventType?.includes('completed') || event.eventType?.includes('archived')) {
        node.status = 'completed';
      } else if (event.eventType?.includes('failed') || event.eventType?.includes('error')) {
        node.status = 'error';
      }
    }

    return root;
  }

  private displayProcessTree(node: ProcessNode, prefix: string, options: TransparencyOptions, isLast = true): void {
    const connector = isLast ? '└── ' : '├── ';
    const statusIcon = this.getStatusIcon(node.status);
    const duration = node.endTime 
      ? `${((node.endTime.getTime() - node.startTime.getTime()) / 1000).toFixed(1)}s`
      : 'ongoing';
    
    console.log(`${prefix}${connector}${statusIcon} ${node.name} (${node.type}) [${duration}]`);

    if (options.format === 'json') {
      // Show some event details in tree view
      const recentEvents = node.events.slice(-2);
      for (const event of recentEvents) {
        const eventPrefix = prefix + (isLast ? '    ' : '│   ') + '    ';
        console.log(`${eventPrefix}• ${event.eventType}: ${event.message || 'no message'}`);
      }
    }

    // Display children
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const childIsLast = i === children.length - 1;
      this.displayProcessTree(child, childPrefix, options, childIsLast);
    }
  }

  private getNodeIdFromEvent(event: any): string {
    if (event.metadata?.agentId) {
      return `agent-${event.metadata.agentId}`;
    }
    if (event.metadata?.taskId) {
      return `task-${event.metadata.taskId}`;
    }
    if (event.source) {
      return `source-${event.source}`;
    }
    return 'unknown';
  }

  private getParentIdFromEvent(event: any): string {
    if (event.metadata?.agentId && event.metadata?.taskId) {
      return 'root'; // Agents are top-level
    }
    return 'root';
  }

  private getNodeNameFromEvent(event: any): string {
    if (event.metadata?.agentId) {
      return event.metadata.agentId;
    }
    if (event.metadata?.taskId) {
      return event.metadata.taskId;
    }
    return event.source || 'Unknown';
  }

  private getNodeTypeFromEvent(event: any): string {
    if (event.metadata?.agentId) {
      return event.metadata.agentType || 'agent';
    }
    if (event.metadata?.taskId) {
      return 'task';
    }
    return event.source || 'process';
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'running': return '🔄';
      default: return '⚫';
    }
  }
}

interface ProcessNode {
  id: string;
  name: string;
  type: string;
  children: ProcessNode[];
  events: any[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'error';
}

export function createTransparencyCommands(): Command {
  const cmd = new Command('transparency');
  cmd.description('Transparency monitoring and analysis tools');

  // Tail command
  cmd
    .command('tail')
    .description('Follow transparency events in real-time')
    .option('-s, --session-id <id>', 'Filter by session ID')
    .option('-l, --level <level>', 'Filter by log level (debug, info, warn, error)')
    .option('-f, --follow', 'Follow new events (like tail -f)', false)
    .option('-n, --lines <number>', 'Number of lines to show', '100')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(async (options) => {
      const transparency = new TransparencyCommand();
      await transparency.tail({
        sessionId: options.sessionId,
        level: options.level,
        follow: options.follow,
        lines: parseInt(options.lines, 10),
        format: options.format as 'text' | 'json'
      });
    });

  // Export command
  cmd
    .command('export')
    .description('Export transparency data')
    .option('-s, --session-id <id>', 'Filter by session ID')
    .option('-l, --level <level>', 'Filter by log level')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--format <format>', 'Output format (text, json)', 'json')
    .option('-n, --lines <number>', 'Number of events to export', '1000')
    .action(async (options) => {
      const transparency = new TransparencyCommand();
      await transparency.export({
        sessionId: options.sessionId,
        level: options.level,
        output: options.output,
        format: options.format as 'text' | 'json',
        lines: parseInt(options.lines, 10)
      });
    });

  // Tree command
  cmd
    .command('tree')
    .description('Show process tree visualization')
    .option('-s, --session-id <id>', 'Filter by session ID')
    .option('--format <format>', 'Display format (text, json)', 'text')
    .option('-n, --lines <number>', 'Number of events to analyze', '500')
    .action(async (options) => {
      const transparency = new TransparencyCommand();
      await transparency.tree({
        sessionId: options.sessionId,
        format: options.format as 'text' | 'json',
        lines: parseInt(options.lines, 10)
      });
    });

  return cmd;
}

export default createTransparencyCommands;