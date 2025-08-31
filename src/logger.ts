import fs from 'fs';
import path from 'path';
import os from 'os';

export class GraphynLogger {
  private logFile: string;
  
  constructor() {
    // Create logs directory in user's home
    const logsDir = path.join(os.homedir(), '.graphyn', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create daily log file
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logsDir, `graphyn-${date}.log`);
  }
  
  logInteraction(data: {
    agent: string;
    query: string;
    contextFile: string;
    mode: 'interactive' | 'cli';
    timestamp?: Date;
  }) {
    const entry = {
      ...data,
      timestamp: data.timestamp || new Date(),
      version: '0.1.62'
    };
    
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      // Silently fail - logging shouldn't break the app
    }
  }
  
  logClaudeContext(agent: string, query: string, contextFile: string, fullContent: string) {
    // Save the full context for analysis
    const contextDir = path.join(os.homedir(), '.graphyn', 'contexts', agent);
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const contextBackup = path.join(contextDir, `${timestamp}.md`);
    
    try {
      // Save full context
      fs.writeFileSync(contextBackup, fullContent);
      
      // Save metadata
      const metadata = {
        query,
        originalFile: contextFile,
        timestamp: new Date(),
        agent
      };
      fs.writeFileSync(contextBackup + '.json', JSON.stringify(metadata, null, 2));
      
      // Log the interaction
      this.logInteraction({
        agent,
        query,
        contextFile,
        mode: process.stdin.isRaw ? 'interactive' : 'cli'
      });
      
    } catch (error) {
      // Silently fail
    }
  }
  
  // Get recent interactions for analysis
  getRecentInteractions(limit: number = 10): any[] {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      
      const logs = fs.readFileSync(this.logFile, 'utf8')
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));
      
      return logs.slice(-limit);
    } catch (error) {
      return [];
    }
  }
}