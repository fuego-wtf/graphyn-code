import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

export const CombinedLogo: React.FC = () => {
  // Pixel art style fire and GRAPHYN text matching Figma
  const firePixel = '🔥';
  const graphynText = 'GRAPHYN';
  
  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={pixelTheme.colors.accent}>{firePixel} </Text>
      <Text color={pixelTheme.colors.accent} bold>{graphynText}</Text>
    </Box>
  );
};