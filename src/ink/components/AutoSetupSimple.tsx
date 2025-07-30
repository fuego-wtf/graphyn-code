import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface AutoSetupProps {
  needsClaudeCode: boolean;
  needsFigmaMCP?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

type SetupState = 'waiting' | 'installing' | 'waiting-confirmation' | 'complete' | 'error';

export const AutoSetup: React.FC<AutoSetupProps> = ({ 
  needsClaudeCode, 
  needsFigmaMCP, 
  onComplete, 
  onCancel 
}) => {
  const [state, setState] = useState<SetupState>('waiting');
  const [error, setError] = useState<string | null>(null);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
    
    if (state === 'waiting' && (input === 'y' || input === 'Y' || key.return)) {
      startInstallation();
    }
    
    if (state === 'waiting' && (input === 'n' || input === 'N')) {
      onCancel();
    }
    
    if (state === 'waiting-confirmation' && (input === 'y' || input === 'Y' || key.return)) {
      onComplete();
    }
  });

  const startInstallation = async () => {
    setState('installing');
    
    try {
      // Open Claude Code download page in browser
      const platform = os.platform();
      const url = 'https://claude.ai/download';
      
      let command;
      if (platform === 'darwin') {
        command = `open "${url}"`;
      } else if (platform === 'win32') {
        command = `start "${url}"`;
      } else {
        command = `xdg-open "${url}"`;
      }
      
      await execAsync(command);
      
      // After opening browser, wait for user confirmation
      setState('waiting-confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setState('error');
    }
  };

  if (state === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Error: {error}</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  if (state === 'waiting') {
    return (
      <Box flexDirection="column">
        <Text bold>🔧 Automatic Setup</Text>
        <Text> </Text>
        <Text>The following components need to be installed:</Text>
        {needsClaudeCode && <Text color="yellow">  • Claude Code (required)</Text>}
        {needsFigmaMCP && <Text color="gray">  • Figma MCP (optional)</Text>}
        <Text> </Text>
        <Text>This will open your browser to download Claude Code.</Text>
        <Text> </Text>
        <Text color="cyan">Proceed with installation? (Y/n)</Text>
      </Box>
    );
  }

  if (state === 'installing') {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="green"><Spinner type="dots" /></Text>
          <Text> Opening browser to download Claude Code...</Text>
        </Box>
        <Text> </Text>
        <Text color="gray">The download page should open in your browser.</Text>
      </Box>
    );
  }

  if (state === 'waiting-confirmation') {
    return (
      <Box flexDirection="column">
        <Text bold>📥 Claude Code Installation</Text>
        <Text> </Text>
        <Text>Please complete the following steps:</Text>
        <Text> </Text>
        <Text>1. Download Claude Code from the browser page that just opened</Text>
        <Text>2. Install Claude Code following the instructions</Text>
        <Text>3. Make sure the 'claude' command is available in your terminal</Text>
        <Text> </Text>
        <Text color="gray">You can test by opening a new terminal and typing: claude --version</Text>
        <Text> </Text>
        <Text color="cyan">Have you completed the installation? (Y/n)</Text>
      </Box>
    );
  }

  return null;
};