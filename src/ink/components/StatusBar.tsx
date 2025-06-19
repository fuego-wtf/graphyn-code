import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../store.js';

interface StatusBarProps {
  showHelp?: boolean;
  customHints?: string[];
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  showHelp = true, 
  customHints = [] 
}) => {
  const { mode, isAuthenticated, agentsLoading, agentsError } = useStore();

  const getDefaultHints = () => {
    switch (mode) {
      case 'menu':
        return ['↑↓ Navigate', '↵ Select', '? Help', 'Ctrl+C Exit'];
      case 'agent':
        return ['ESC Cancel', 'Ctrl+C Exit'];
      case 'threads':
        return ['↑↓ Navigate', '↵ Select', 'n New', 'd Delete', 'ESC Back'];
      case 'auth':
        return ['↑↓ Navigate', '↵ Select', 'ESC Back'];
      case 'init':
        return ['Tab Next field', '↵ Submit', 'ESC Cancel'];
      default:
        return ['ESC Back', 'Ctrl+C Exit'];
    }
  };

  const hints = customHints.length > 0 ? customHints : getDefaultHints();
  
  return (
    <Box 
      borderStyle="single" 
      borderColor="gray"
      paddingX={1}
      marginTop={1}
      justifyContent="space-between"
      width="100%"
    >
      {/* Left side - status */}
      <Box>
        {isAuthenticated ? (
          <Text color="green">● Authenticated</Text>
        ) : (
          <Text color="yellow">○ Not authenticated</Text>
        )}
        {agentsLoading && (
          <Text color="cyan"> • Loading agents...</Text>
        )}
        {agentsError && (
          <Text color="red"> • Error: {agentsError}</Text>
        )}
      </Box>
      
      {/* Right side - keyboard hints */}
      {showHelp && (
        <Box>
          <Text dimColor>
            {hints.map((hint, i) => (
              <Text key={i}>
                {i > 0 && '  '}
                {hint.split(' ').map((part, j) => {
                  if (j === 0) {
                    return <Text key={j} color="cyan">{part}</Text>;
                  }
                  return <Text key={j}> {part}</Text>;
                })}
              </Text>
            ))}
          </Text>
        </Box>
      )}
    </Box>
  );
};