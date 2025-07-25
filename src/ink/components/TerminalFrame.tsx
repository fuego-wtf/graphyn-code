import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

interface TerminalFrameProps {
  children: React.ReactNode;
  title?: string;
}

export const TerminalFrame: React.FC<TerminalFrameProps> = ({ 
  children, 
  title = 'Terminal-First-time' 
}) => {
  // Simplified terminal frame matching Figma design
  return (
    <Box flexDirection="column">
      {/* Title bar with window controls */}
      <Box 
        paddingX={1} 
        paddingY={1}
        borderStyle="single"
        borderColor={pixelTheme.colors.innerFrame}
      >
        <Box>
          <Text color="#FF5F56">●</Text>
          <Text color="#FFBD2E"> ●</Text>
          <Text color="#27C93F"> ●</Text>
        </Box>
      </Box>
      
      {/* Content area */}
      <Box 
        paddingX={2} 
        paddingY={1}
        minHeight={20}
      >
        {children}
      </Box>
    </Box>
  );
};