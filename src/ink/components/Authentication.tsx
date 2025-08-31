import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../store.js';

interface AuthenticationProps {
  returnToBuilder?: boolean;
  isDev?: boolean;
}

export const Authentication: React.FC<AuthenticationProps> = ({ returnToBuilder = false, isDev = false }) => {
  const { setMode } = useStore();

  // Authentication is completely disabled - redirect immediately to prevent auth barrier
  React.useEffect(() => {
    // Skip authentication, go directly to target mode
    if (returnToBuilder) {
      setMode('builder');
    } else {
      setMode('menu');
    }
  }, [setMode, returnToBuilder]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow">⚠️ Authentication disabled</Text>
      <Text color="gray">System is fully offline - no auth required</Text>
      <Text color="gray">Redirecting...</Text>
    </Box>
  );
};