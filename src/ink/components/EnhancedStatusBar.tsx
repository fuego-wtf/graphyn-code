import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { fuegoColors, colors } from '../theme/colors.js';

interface EnhancedStatusBarProps {
  activePanel?: 'left' | 'right';
  currentPhase?: string;
  tasksCompleted?: number;
  totalTasks?: number;
  showHelp?: boolean;
  shortcuts?: Array<{
    key: string;
    description: string;
  }>;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  mode?: string;
  isLoading?: boolean;
  progress?: {
    current: number;
    total: number;
  };
}

export const EnhancedStatusBar: React.FC<EnhancedStatusBarProps> = ({ 
  activePanel,
  currentPhase,
  tasksCompleted,
  totalTasks,
  showHelp = false,
  shortcuts = [],
  connectionStatus = 'connected',
  mode = 'ready', 
  isLoading = false,
  progress
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Default shortcuts when none provided
  const defaultShortcuts = [
    { key: 'Tab', description: 'Switch panels' },
    { key: '↑↓', description: 'Navigate' },
    { key: '?', description: 'Help' },
    { key: 'Ctrl+C', description: 'Exit' }
  ];

  const displayShortcuts = shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  // Get connection status indicator
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      default:
        return '⚪';
    }
  };

  // Get phase icon
  const getPhaseIcon = (phase?: string) => {
    if (!phase) return '•';
    switch (phase.toLowerCase()) {
      case 'analysis':
        return '🔍';
      case 'planning':
        return '📋';
      case 'execution':
        return '⚡';
      case 'review':
        return '👀';
      case 'complete':
        return '✅';
      default:
        return '•';
    }
  };

  return (
    <Box 
      borderStyle="round" 
      borderColor={fuegoColors.border.subtle} 
      paddingX={2} 
      paddingY={1}
      marginTop={1}
    >
      <Box justifyContent="space-between" width="100%">
        {/* Left side - Status information */}
        <Box flexDirection="row" gap={2} alignItems="center">
          <Text color={fuegoColors.accent.cyan} bold>
            🎯 Graphyn
          </Text>
          
          <Text color={fuegoColors.text.dimmed}>•</Text>
          
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text>{getConnectionIcon()}</Text>
            <Text color={connectionStatus === 'connected' ? colors.success : colors.warning}>
              {connectionStatus}
            </Text>
          </Box>

          {currentPhase && (
            <>
              <Text color={fuegoColors.text.dimmed}>•</Text>
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Text>{getPhaseIcon(currentPhase)}</Text>
                <Text color={fuegoColors.text.secondary}>
                  {currentPhase}
                </Text>
              </Box>
            </>
          )}

          {activePanel && (
            <>
              <Text color={fuegoColors.text.dimmed}>•</Text>
              <Text color={colors.info}>
                📱 {activePanel === 'left' ? 'Stream' : 'Tasks'}
              </Text>
            </>
          )}

          {(tasksCompleted !== undefined && totalTasks !== undefined) && (
            <>
              <Text color={fuegoColors.text.dimmed}>•</Text>
              <Text color={colors.success}>
                ✅ {tasksCompleted}/{totalTasks}
              </Text>
            </>
          )}

          {/* Legacy support for existing progress prop */}
          {progress && (
            <>
              <Text color={fuegoColors.text.dimmed}>•</Text>
              <Text color={colors.info}>
                📊 {progress.current}/{progress.total}
              </Text>
            </>
          )}

          {isLoading && (
            <>
              <Text color={fuegoColors.text.dimmed}>•</Text>
              <Text color={colors.warning}>
                ⏳ Working...
              </Text>
            </>
          )}
        </Box>
        
        {/* Right side - Shortcuts and time */}
        <Box flexDirection="row" gap={1} alignItems="center">
          {showHelp ? (
            // Extended help mode
            <Box flexDirection="row" gap={2}>
              {displayShortcuts.slice(0, 3).map((shortcut, index) => (
                <Box key={shortcut.key} flexDirection="row">
                  {index > 0 && <Text color={fuegoColors.text.dimmed}> | </Text>}
                  <Text color={fuegoColors.accent.cyan} bold>{shortcut.key}</Text>
                  <Text color={fuegoColors.text.dimmed}>: {shortcut.description}</Text>
                </Box>
              ))}
              <Text color={fuegoColors.text.dimmed}>
                {' '}| Press ? to toggle help
              </Text>
            </Box>
          ) : (
            // Compact mode
            <Box flexDirection="row" gap={2}>
              {displayShortcuts.slice(0, 2).map((shortcut, index) => (
                <Box key={shortcut.key} flexDirection="row">
                  {index > 0 && <Text color={fuegoColors.text.dimmed}> | </Text>}
                  <Text color={fuegoColors.accent.cyan} bold>{shortcut.key}</Text>
                  <Text color={fuegoColors.text.dimmed}>: {shortcut.description}</Text>
                </Box>
              ))}
              <Text color={fuegoColors.text.dimmed}>
                {' '}| ? for help
              </Text>
            </Box>
          )}
          
          <Text color={fuegoColors.text.dimmed}>
            {' '}| {time}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};