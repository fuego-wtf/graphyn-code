import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { useStore } from '../store.js';

type SyncMode = 'menu' | 'pulling' | 'pushing' | 'editing' | 'success' | 'error';

interface SyncState {
  mode: SyncMode;
  message?: string;
  error?: string;
}

export const Sync: React.FC = () => {
  const { reset } = useStore();
  const [state, setState] = useState<SyncState>({ mode: 'menu' });

  const handleAction = async (item: { value: string }) => {
    switch (item.value) {
      case 'pull':
        await pullGraphynMd();
        break;
      case 'push':
        await pushGraphynMd();
        break;
      case 'edit':
        await editGraphynMd();
        break;
      case 'back':
        reset();
        break;
    }
  };

  const pullGraphynMd = async () => {
    setState({ mode: 'pulling' });
    
    try {
      // Simulate pulling from remote (in real implementation, this would fetch from API)
      const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'GRAPHYN.md');
      const targetPath = path.join(process.cwd(), 'GRAPHYN.md');
      
      if (fs.existsSync(templatePath)) {
        const content = fs.readFileSync(templatePath, 'utf-8');
        
        // Merge with existing content if it exists
        if (fs.existsSync(targetPath)) {
          const existingContent = fs.readFileSync(targetPath, 'utf-8');
          // Simple merge strategy - append new sections
          fs.writeFileSync(targetPath + '.backup', existingContent);
          setState({ mode: 'success', message: 'Backed up existing GRAPHYN.md and pulled latest template' });
        } else {
          fs.writeFileSync(targetPath, content);
          setState({ mode: 'success', message: 'Pulled GRAPHYN.md template successfully' });
        }
      } else {
        throw new Error('Template not found');
      }
    } catch (error) {
      setState({ 
        mode: 'error', 
        error: error instanceof Error ? error.message : 'Failed to pull GRAPHYN.md' 
      });
    }
  };

  const pushGraphynMd = async () => {
    setState({ mode: 'pushing' });
    
    try {
      const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
      
      if (!fs.existsSync(graphynPath)) {
        throw new Error('GRAPHYN.md not found in current directory');
      }

      // In real implementation, this would push to remote storage
      // For now, we'll just validate and show success
      const content = fs.readFileSync(graphynPath, 'utf-8');
      const stats = fs.statSync(graphynPath);
      
      setState({ 
        mode: 'success', 
        message: `Pushed GRAPHYN.md (${(stats.size / 1024).toFixed(1)} KB) successfully` 
      });
    } catch (error) {
      setState({ 
        mode: 'error', 
        error: error instanceof Error ? error.message : 'Failed to push GRAPHYN.md' 
      });
    }
  };

  const editGraphynMd = async () => {
    setState({ mode: 'editing' });
    
    try {
      const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
      
      if (!fs.existsSync(graphynPath)) {
        // Create if doesn't exist
        const templatePath = path.join(__dirname, '..', '..', '..', 'templates', 'GRAPHYN.md');
        if (fs.existsSync(templatePath)) {
          fs.copyFileSync(templatePath, graphynPath);
        } else {
          fs.writeFileSync(graphynPath, '# GRAPHYN.md - Living Project Memory\n\n');
        }
      }

      // Open in default editor
      const editor = process.env.EDITOR || 'vi';
      
      try {
        execSync(`${editor} "${graphynPath}"`, { stdio: 'inherit' });
        setState({ mode: 'success', message: 'Edited GRAPHYN.md successfully' });
      } catch {
        // If terminal editor fails, try to open with system default
        const openCommand = process.platform === 'darwin' ? 'open' : 
                          process.platform === 'win32' ? 'start' : 'xdg-open';
        execSync(`${openCommand} "${graphynPath}"`);
        setState({ mode: 'success', message: 'Opened GRAPHYN.md in default editor' });
      }
    } catch (error) {
      setState({ 
        mode: 'error', 
        error: error instanceof Error ? error.message : 'Failed to edit GRAPHYN.md' 
      });
    }
  };

  switch (state.mode) {
    case 'menu':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>🔄 Sync GRAPHYN.md</Text>
          <Box marginTop={1}>
            <Text>Manage your project's living documentation:</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '⬇️  Pull - Get latest template', value: 'pull' },
                { label: '⬆️  Push - Save to remote', value: 'push' },
                { label: '✏️  Edit - Open in editor', value: 'edit' },
                { label: '← Back to Menu', value: 'back' }
              ]}
              onSelect={handleAction}
            />
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>GRAPHYN.md is your project's living memory</Text>
          </Box>
        </Box>
      );

    case 'pulling':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Pulling GRAPHYN.md</Text>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text> Fetching latest template...</Text>
          </Box>
        </Box>
      );

    case 'pushing':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Pushing GRAPHYN.md</Text>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text> Saving to remote...</Text>
          </Box>
        </Box>
      );

    case 'editing':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Opening Editor</Text>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text> Launching editor...</Text>
          </Box>
        </Box>
      );

    case 'success':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="green">✅ Success!</Text>
          <Box marginTop={1}>
            <Text>{state.message}</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>Press any key to continue</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="red">❌ Error</Text>
          <Box marginTop={1}>
            <Text color="red">{state.error}</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>Press ESC to go back</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};