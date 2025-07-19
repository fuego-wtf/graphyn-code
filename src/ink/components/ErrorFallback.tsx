import React from 'react';
import { Box, Text } from 'ink';

interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="red" padding={1}>
        <Text color="red" bold>⚠️  Application Error</Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Something unexpected happened:</Text>
        <Box marginLeft={2} marginTop={1}>
          <Text>{error.message}</Text>
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Possible solutions:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text dimColor>• Check your internet connection</Text>
          <Text dimColor>• Verify your authentication status</Text>
          <Text dimColor>• Try running 'graphyn doctor' to diagnose issues</Text>
        </Box>
      </Box>

      {resetError && (
        <Box marginTop={2}>
          <Text dimColor>Press <Text color="cyan">R</Text> to retry or <Text color="cyan">ESC</Text> to go back</Text>
        </Box>
      )}
    </Box>
  );
};