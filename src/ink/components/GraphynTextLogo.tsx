import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

export const GraphynTextLogo: React.FC = () => {
  // Pixel-style GRAPHYN text matching the SVG
  const graphynArt = [
    '█████ ████  ████ ████ █  █ █   █ █   █',
    '█     █   █ █  █ █  █ █  █  █ █  ██  █',
    '█ ███ ████  ████ ████ ████   ██  █ █ █',
    '█   █ █   █ █  █ █    █  █   █   █  ██',
    '█████ █   █ █  █ █    █  █   █   █   █'
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