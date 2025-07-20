import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { useNaturalLanguage } from '../hooks/useNaturalLanguage.js';
import { useClaude } from '../hooks/useClaude.js';
import { useStore } from '../store.js';

interface NaturalLanguageQueryProps {
  query: string;
}

export const NaturalLanguageQuery: React.FC<NaturalLanguageQueryProps> = ({ query }) => {
  const { exit } = useApp();
  const { analyzeIntent } = useNaturalLanguage();
  const { launchClaude } = useClaude();
  const { setLoading, setError } = useStore();
  
  const [status, setStatus] = useState<'analyzing' | 'launching' | 'error'>('analyzing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    handleNaturalQuery();
  }, [query]);

  const handleNaturalQuery = async () => {
    try {
      setLoading(true);
      setStatus('analyzing');

      // Analyze intent with backend or fallback
      const result = await analyzeIntent(query);
      
      if (!result) {
        throw new Error('Could not understand the query');
      }

      // Launch Claude with the determined agent and context
      setStatus('launching');
      
      const launchResult = await launchClaude({
        content: result.context,
        agent: result.agent,
        saveToHistory: true
      });

      if (launchResult.success) {
        // Exit silently - Claude is taking over
        exit();
      } else {
        throw new Error(launchResult.error || 'Failed to launch Claude');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
      
      // Show error for a few seconds then exit
      setTimeout(() => exit(), 3000);
    }
  };

  // Silent mode - only show errors
  if (status !== 'error') {
    return null;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red">✗ {errorMessage}</Text>
      <Box marginTop={1}>
        <Text color="gray">Exiting...</Text>
      </Box>
    </Box>
  );
};