import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { spawn } from 'child_process';

interface TmuxAttachWrapperProps {
  sessionName: string;
  paneIndex?: number;
  agentName?: string;
  onDetach: () => void;
}

export const TmuxAttachWrapper: React.FC<TmuxAttachWrapperProps> = ({
  sessionName,
  paneIndex,
  agentName,
  onDetach
}) => {
  const [isAttaching, setIsAttaching] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  
  useEffect(() => {
    let child: ReturnType<typeof spawn> | null = null;
    
    const attach = async () => {
      try {
        // Clear terminal completely
        process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
        process.stdout.write('\x1bc'); // Reset terminal
        
        // Build tmux command
        let tmuxCmd: string[];
        if (paneIndex !== undefined) {
          // Attach to specific pane
          tmuxCmd = [
            'tmux',
            'select-pane', '-t', `${sessionName}:0.${paneIndex}`,
            '&&',
            'tmux', 'resize-pane', '-t', `${sessionName}:0.${paneIndex}`, '-Z',
            '&&',
            'tmux', 'attach-session', '-t', sessionName
          ];
        } else {
          // Attach to full session
          tmuxCmd = ['tmux', 'attach-session', '-t', sessionName];
        }
        
        // Use sh to run the compound command
        child = spawn('sh', ['-c', tmuxCmd.join(' ')], {
          stdio: 'inherit',
          env: {
            ...process.env,
            TERM: 'xterm-256color' // Ensure proper terminal support
          }
        });
        
        child.on('error', (err) => {
          setAttachError(err.message);
          setIsAttaching(false);
        });
        
        child.on('exit', (code) => {
          // Clean up terminal after detaching
          process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
          process.stdout.write('\x1bc'); // Reset terminal
          
          if (code !== 0) {
            setAttachError(`TMUX exited with code ${code}`);
          }
          
          setIsAttaching(false);
          
          // Delay before calling onDetach to ensure terminal is ready
          setTimeout(() => {
            onDetach();
          }, 100);
        });
      } catch (err) {
        setAttachError(err instanceof Error ? err.message : 'Unknown error');
        setIsAttaching(false);
      }
    };
    
    // Small delay to ensure terminal is ready
    const timer = setTimeout(attach, 100);
    
    return () => {
      clearTimeout(timer);
      if (child && !child.killed) {
        child.kill();
      }
    };
  }, [sessionName, paneIndex, onDetach]);
  
  if (attachError) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="red">❌ Failed to attach to TMUX session</Text>
        <Text color="gray">{attachError}</Text>
        <Box marginTop={1}>
          <Text>Press any key to return...</Text>
        </Box>
      </Box>
    );
  }
  
  if (isAttaching) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">
          🎯 Attaching to {agentName || 'TMUX session'}...
        </Text>
        <Box marginTop={1}>
          <Text color="gray">Tips:</Text>
          <Text color="gray">• Use Alt+Q to detach from TMUX</Text>
          <Text color="gray">• Use Ctrl+B then D to detach</Text>
          <Text color="gray">• Use Ctrl+B then [ for scroll mode</Text>
        </Box>
      </Box>
    );
  }
  
  return null;
};