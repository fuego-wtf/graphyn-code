import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

export const GraphynTextLogo: React.FC = () => {
  // Pixel-style GRAPHYN text - cleaner version for terminal
  const graphynArt = [
    '███████ ██████  ███████ ██████ ██   ██ ██    ██ ███    ██',
    '██      ██   ██ ██   ██ ██  ██ ██   ██  ██  ██  ████   ██',
    '██ ████ ██████  ███████ ██████ ███████   ████   ██ ██  ██',
    '██   ██ ██   ██ ██   ██ ██     ██   ██    ██    ██  ██ ██',
    '███████ ██   ██ ██   ██ ██     ██   ██    ██    ██   ████'
  ];

  return (
    <Box flexDirection="column" alignItems="center">
      {graphynArt.map((line, index) => (
        <Text key={index} color={pixelTheme.colors.accent}>
          {line}
        </Text>
      ))}
    </Box>
  );
};