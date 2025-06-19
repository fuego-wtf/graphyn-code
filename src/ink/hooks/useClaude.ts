import { useState, useCallback } from 'react';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { findClaude } from '../../utils/claude-detector.js';

export interface ClaudeLaunchOptions {
  content: string;
  agent?: string;
  projectContext?: string;
  saveToHistory?: boolean;
}

export interface ClaudeLaunchResult {
  success: boolean;
  tempFile?: string;
  error?: string;
  claudePath?: string;
}

export const useClaude = () => {
  const [launching, setLaunching] = useState(false);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);
  const [claudePath, setClaudePath] = useState<string | null>(null);

  // Check if Claude is available
  const checkClaude = useCallback(async () => {
    try {
      const result = await findClaude();
      setClaudeAvailable(result.found);
      setClaudePath(result.path || null);
      return result;
    } catch (error) {
      setClaudeAvailable(false);
      return { found: false, path: null };
    }
  }, []);

  // Launch Claude with content
  const launchClaude = useCallback(async (options: ClaudeLaunchOptions): Promise<ClaudeLaunchResult> => {
    setLaunching(true);
    
    try {
      // Check Claude availability
      const claudeResult = await checkClaude();
      
      if (!claudeResult.found || !claudeResult.path) {
        return {
          success: false,
          error: 'Claude Code not found. Please install from https://claude.ai/code'
        };
      }

      // Prepare full context
      const { content, agent, projectContext, saveToHistory = true } = options;
      
      let fullContext = content;
      
      if (agent) {
        fullContext = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent Context\n\n${content}`;
      }
      
      if (projectContext) {
        fullContext += `\n\n# Project Context\n${projectContext}`;
      }

      // Save to history if requested
      if (saveToHistory) {
        await saveToClaudeHistory(agent || 'general', fullContext);
      }

      // Create temp file as fallback
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `graphyn-${agent || 'context'}-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, fullContext);

      // Schedule cleanup
      setTimeout(() => {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Try direct launch first
      try {
        const escapedContent = fullContext
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/`/g, '\\`')
          .replace(/\$/g, '\\$');
        
        execSync(`"${claudeResult.path}" "${escapedContent}"`, { 
          stdio: 'inherit'
        });

        return {
          success: true,
          tempFile: tmpFile,
          claudePath: claudeResult.path
        };
      } catch (error) {
        // Direct launch might fail for large content
        // Fallback to file-based approach
        console.log('\n📄 Context saved to:', tmpFile);
        console.log('\nTo launch Claude Code with this context:');
        console.log(`1. Run: claude`);
        console.log(`2. Use: /read ${tmpFile}`);
        
        return {
          success: true,
          tempFile: tmpFile,
          claudePath: claudeResult.path
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to launch Claude'
      };
    } finally {
      setLaunching(false);
    }
  }, [checkClaude]);

  // Save context to history
  const saveToClaudeHistory = async (agent: string, content: string) => {
    try {
      const graphynDir = path.join(os.homedir(), '.graphyn');
      const historyDir = path.join(graphynDir, 'history', agent);
      
      // Ensure directory exists
      fs.mkdirSync(historyDir, { recursive: true });
      
      // Create history entry
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const historyFile = path.join(historyDir, `${timestamp}.md`);
      
      fs.writeFileSync(historyFile, content);
      
      // Also update latest link
      const latestLink = path.join(historyDir, 'latest.md');
      if (fs.existsSync(latestLink)) {
        fs.unlinkSync(latestLink);
      }
      fs.symlinkSync(historyFile, latestLink);
    } catch (error) {
      // History saving is optional, don't fail the operation
      console.error('Failed to save to history:', error);
    }
  };

  // Get Claude installation info
  const getClaudeInfo = useCallback(async () => {
    const result = await checkClaude();
    
    return {
      installed: result.found,
      path: result.path,
      version: result.found ? await getClaudeVersion(result.path!) : null
    };
  }, [checkClaude]);

  // Get Claude version
  const getClaudeVersion = async (claudePath: string): Promise<string | null> => {
    try {
      const output = execSync(`"${claudePath}" --version`, { encoding: 'utf-8' }).trim();
      return output;
    } catch {
      return null;
    }
  };

  return {
    launching,
    claudeAvailable,
    claudePath,
    checkClaude,
    launchClaude,
    getClaudeInfo
  };
};