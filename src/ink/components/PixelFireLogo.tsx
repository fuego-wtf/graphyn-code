import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

export const PixelFireLogo: React.FC = () => {
  // Pixel-perfect ASCII art based on the SVG fire logo
  const fireArt = [
    '   ▀▀   ',
    '   ██   ',
    '  ████  ',
    ' ██████ ',
    ' ██████ ',
    ' ██████ ',
    '████████',
    '████████',
    '████████',
    '█ ████ █',
    '  ████  '
  ];

  return (
    <Box flexDirection="column" alignItems="center">
      {fireArt.map((line, index) => (
        <Text key={index} color={pixelTheme.colors.accent}>
          {line}
        </Text>
      ))}
    </Box>
  );
};