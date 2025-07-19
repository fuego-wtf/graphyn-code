import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useApp } from 'ink';
import Spinner from 'ink-spinner';
import { initGraphynFolder } from '../../utils/graphyn-folder.js';

export const InitGraphyn: React.FC = () => {
  const { exit } = useApp();
  const [status, setStatus] = useState<'initializing' | 'success' | 'error'>('initializing');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const initialize = async () => {
      try {
        setMessage('Creating .graphyn folder structure...');
        await initGraphynFolder();
        
        setStatus('success');
        setMessage('Successfully initialized .graphyn folder!');
        
        // Show success message briefly then exit
        setTimeout(() => {
          exit();
        }, 2000);
      } catch (error) {
        setStatus('error');
        setMessage(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        setTimeout(() => {
          exit();
        }, 3000);
      }
    };
    
    initialize();
  }, [exit]);
  
  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        {status === 'initializing' && <Spinner type="dots" />}
        {status === 'success' && <Text color="green">✅</Text>}
        {status === 'error' && <Text color="red">❌</Text>}
        <Text> {message}</Text>
      </Box>
      
      {status === 'success' && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Created:</Text>
          <Text color="cyan">• .graphyn/init.md - Session notes</Text>
          <Text color="cyan">• .graphyn/docs/sitemap.md - Project structure</Text>
          <Text color="cyan">• .graphyn/docs/servicemap.md - Service architecture</Text>
          <Text color="cyan">• .graphyn/docs/temp/ - Temporary documentation</Text>
        </Box>
      )}
    </Box>
  );
};