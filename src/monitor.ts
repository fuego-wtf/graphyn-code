import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { homedir } from 'os';

export interface FileChange {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: Date;
  content?: string;
  diff?: string;
}

export interface Pattern {
  type: string;
  frequency: number;
  context: any;
  confidence: number;
}

export class ClaudeMonitor extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private changes: FileChange[] = [];
  private patterns: Map<string, Pattern> = new Map();
  
  constructor() {
    super();
  }
  
  // Start monitoring a workspace
  startMonitoring(workspacePath: string, sessionId: string) {
    if (this.watcher) {
      this.watcher.close();
    }
    
    console.log(`🔍 Monitoring workspace: ${workspacePath}`);
    
    this.watcher = chokidar.watch(workspacePath, {
      ignored: [
        /node_modules/,
        /\.git/,
        /\.graphyn/,
        /dist/,
        /build/,
        /tmp/
      ],
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher
      .on('add', (filePath: string) => this.handleFileChange('add', filePath))
      .on('change', (filePath: string) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath: string) => this.handleFileChange('unlink', filePath));
    
    // Store session metadata
    this.logSession(sessionId, workspacePath);
  }
  
  // Handle file changes
  private async handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string) {
    const change: FileChange = {
      type,
      path: filePath,
      timestamp: new Date()
    };
    
    // Read content for new/changed files
    if (type !== 'unlink' && fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        // Only read text files under 1MB
        if (stats.size < 1024 * 1024 && this.isTextFile(filePath)) {
          change.content = fs.readFileSync(filePath, 'utf8');
        }
      } catch (e) {
        // Ignore read errors
      }
    }
    
    this.changes.push(change);
    this.emit('change', change);
    
    // Analyze patterns in background
    this.analyzePatterns();
  }
  
  // Check if file is likely text
  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt',
      '.yml', '.yaml', '.toml', '.env', '.css', '.scss',
      '.html', '.xml', '.py', '.go', '.rs', '.java'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext);
  }
  
  // Analyze patterns in changes
  private analyzePatterns() {
    // This will evolve to detect:
    // - Common file modifications
    // - Refactoring patterns
    // - Architecture decisions
    // - Coding style preferences
    
    // For now, just track file type frequencies
    const typeFrequency = new Map<string, number>();
    
    this.changes.forEach(change => {
      const ext = path.extname(change.path);
      typeFrequency.set(ext, (typeFrequency.get(ext) || 0) + 1);
    });
    
    // Store patterns
    typeFrequency.forEach((count, ext) => {
      this.patterns.set(`file_type_${ext}`, {
        type: 'file_type_preference',
        frequency: count,
        context: { extension: ext },
        confidence: count > 5 ? 0.8 : 0.5
      });
    });
  }
  
  // Get current patterns
  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }
  
  // Get recent changes
  getRecentChanges(limit: number = 50): FileChange[] {
    return this.changes.slice(-limit);
  }
  
  // Log session for future analysis
  private logSession(sessionId: string, workspacePath: string) {
    const sessionDir = path.join(
      homedir(),
      '.graphyn',
      'sessions',
      sessionId
    );
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    const metadata = {
      sessionId,
      workspacePath,
      startTime: new Date(),
      platform: process.platform,
      nodeVersion: process.version
    };
    
    fs.writeFileSync(
      path.join(sessionDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }
  
  // Stop monitoring
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    
    // Save final patterns
    this.savePatterns();
  }
  
  // Save patterns for future use
  private savePatterns() {
    const patternsFile = path.join(
      homedir(),
      '.graphyn',
      'patterns',
      `patterns-${Date.now()}.json`
    );
    
    const dir = path.dirname(patternsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(patternsFile, JSON.stringify({
      patterns: Array.from(this.patterns.entries()),
      changes: this.changes.slice(-100), // Keep last 100 changes
      timestamp: new Date()
    }, null, 2));
  }
}