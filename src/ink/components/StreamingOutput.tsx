import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { fuegoColors, colors } from '../theme/colors.js';

interface StreamingOutputProps {
  output: string[];
  currentMessage?: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  maxHeight?: number;
  showSyntaxHighlighting?: boolean;
}

export const StreamingOutput: React.FC<StreamingOutputProps> = ({
  output,
  currentMessage,
  connectionStatus,
  maxHeight = 20,
  showSyntaxHighlighting = true
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef<string[]>([]);

  // Update output reference
  useEffect(() => {
    outputRef.current = output;
    
    // Auto-scroll to bottom when new content arrives
    if (autoScroll) {
      setScrollPosition(Math.max(0, output.length - maxHeight));
    }
  }, [output, autoScroll, maxHeight]);

  // Syntax highlighting for common patterns
  const highlightText = (text: string): React.ReactNode => {
    if (!showSyntaxHighlighting) {
      return <Text>{text}</Text>;
    }

    // Detect different types of content and apply styling
    if (text.startsWith('✅')) {
      return <Text color={colors.success}>{text}</Text>;
    }
    if (text.startsWith('❌') || text.startsWith('Error:')) {
      return <Text color={colors.error}>{text}</Text>;
    }
    if (text.startsWith('⚠️') || text.startsWith('Warning:')) {
      return <Text color={colors.warning}>{text}</Text>;
    }
    if (text.startsWith('🔍') || text.startsWith('Info:')) {
      return <Text color={colors.info}>{text}</Text>;
    }
    if (text.includes('@backend') || text.includes('@frontend') || text.includes('@architect')) {
      const parts = text.split(/(@\w+)/g);
      return (
        <Text>
          {parts.map((part, index) => 
            part.match(/@\w+/) ? (
              <Text key={index} color={fuegoColors.accent.cyan} bold>{part}</Text>
            ) : (
              <Text key={index}>{part}</Text>
            )
          )}
        </Text>
      );
    }

    // Code blocks or file paths
    if (text.includes('src/') || text.includes('.tsx') || text.includes('.ts') || text.includes('.js')) {
      return <Text color={fuegoColors.accent.blue}>{text}</Text>;
    }

    // Commands or shell output
    if (text.startsWith('$') || text.startsWith('npm') || text.startsWith('git')) {
      return <Text color={fuegoColors.accent.magenta}>{text}</Text>;
    }

    return <Text color={fuegoColors.text.primary}>{text}</Text>;
  };

  // Get visible output based on scroll position
  const getVisibleOutput = () => {
    const allOutput = [...output];
    if (currentMessage) {
      allOutput.push(currentMessage);
    }
    
    return allOutput.slice(scrollPosition, scrollPosition + maxHeight);
  };

  // Connection status indicator
  const getConnectionStatusElement = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Text color={colors.success}>
            🟢 Connected • Live streaming
          </Text>
        );
      case 'connecting':
        return (
          <Text color={colors.warning}>
            <Spinner type="dots" /> Connecting...
          </Text>
        );
      case 'disconnected':
        return (
          <Text color={colors.error}>
            🔴 Disconnected • Offline mode
          </Text>
        );
      default:
        return null;
    }
  };

  const visibleOutput = getVisibleOutput();
  const hasMoreAbove = scrollPosition > 0;
  const hasMoreBelow = scrollPosition + maxHeight < output.length + (currentMessage ? 1 : 0);

  return (
    <Box flexDirection="column" height={maxHeight + 2}>
      {/* Connection status header */}
      <Box borderBottom marginBottom={1} paddingBottom={1}>
        <Box justifyContent="space-between">
          {getConnectionStatusElement()}
          <Text color={fuegoColors.text.dimmed} dimColor>
            {hasMoreAbove && '↑ '}{output.length + (currentMessage ? 1 : 0)} lines{hasMoreBelow && ' ↓'}
          </Text>
        </Box>
      </Box>

      {/* Scroll indicator - more content above */}
      {hasMoreAbove && (
        <Box justifyContent="center" marginBottom={1}>
          <Text color={fuegoColors.text.dimmed} dimColor>
            ⋯ {scrollPosition} more lines above ⋯
          </Text>
        </Box>
      )}

      {/* Main output area */}
      <Box flexDirection="column" flexGrow={1}>
        {visibleOutput.length === 0 ? (
          <Box justifyContent="center" alignItems="center" height="100%">
            <Text color={fuegoColors.text.dimmed} dimColor>
              {connectionStatus === 'connected' ? '⏳ Waiting for output...' : '📭 No output available'}
            </Text>
          </Box>
        ) : (
          visibleOutput.map((line, index) => {
            const isCurrentMessage = currentMessage && index === visibleOutput.length - 1 && line === currentMessage;
            
            return (
              <Box key={scrollPosition + index} marginBottom={0}>
                {isCurrentMessage ? (
                  <Box flexDirection="row">
                    {highlightText(line)}
                    <Text color={colors.info}>
                      <Spinner type="simpleDotsScrolling" />
                    </Text>
                  </Box>
                ) : (
                  highlightText(line)
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Scroll indicator - more content below */}
      {hasMoreBelow && (
        <Box justifyContent="center" marginTop={1}>
          <Text color={fuegoColors.text.dimmed} dimColor>
            ⋯ {(output.length + (currentMessage ? 1 : 0)) - (scrollPosition + maxHeight)} more lines below ⋯
          </Text>
        </Box>
      )}

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <Box marginTop={1}>
          <Text color={colors.warning} dimColor>
            ⏸️  Auto-scroll paused • Press 'a' to resume
          </Text>
        </Box>
      )}
    </Box>
  );
};