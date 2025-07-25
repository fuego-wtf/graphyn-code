import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

interface TerminalFrameProps {
  children: React.ReactNode;
  title?: string;
}

export const TerminalFrame: React.FC<TerminalFrameProps> = ({ 
  children, 
  title = 'Graphyn Code' 
}) => {
  const frameColor = pixelTheme.colors.innerFrame;
  const width = 80; // Fixed width for consistent appearance
  
  // Title bar with window controls
  const titleBar = (
    <Box width={width - 2} justifyContent="space-between">
      <Box>
        <Text color={pixelTheme.colors.dim}>●</Text>
        <Text color={pixelTheme.colors.dim}> ●</Text>
        <Text color={pixelTheme.colors.dim}> ●</Text>
        <Text color={pixelTheme.colors.text}>  {title}</Text>
      </Box>
      <Text> </Text>
    </Box>
  );

  // Create border lines
  const horizontalLine = '─'.repeat(width - 2);
  const topBorder = `┌${horizontalLine}┐`;
  const middleBorder = `├${horizontalLine}┤`;
  const bottomBorder = `└${horizontalLine}┘`;
  
  return (
    <Box flexDirection="column">
      {/* Outer frame simulation */}
      <Box 
        flexDirection="column" 
        paddingX={1}
        paddingY={0}
      >
        {/* Terminal window */}
        <Box flexDirection="column">
          {/* Top border */}
          <Text color={frameColor}>{topBorder}</Text>
          
          {/* Title bar */}
          <Box>
            <Text color={frameColor}>│</Text>
            {titleBar}
            <Text color={frameColor}>│</Text>
          </Box>
          
          {/* Middle border */}
          <Text color={frameColor}>{middleBorder}</Text>
          
          {/* Content area with black background */}
          <Box 
            flexDirection="row"
            minHeight={20}
          >
            <Text color={frameColor}>│</Text>
            <Box 
              width={width - 2} 
              paddingX={3} 
              paddingY={1}
              flexDirection="column"
            >
              {children}
            </Box>
            <Text color={frameColor}>│</Text>
          </Box>
          
          {/* Bottom border */}
          <Text color={frameColor}>{bottomBorder}</Text>
        </Box>
      </Box>
    </Box>
  );
};