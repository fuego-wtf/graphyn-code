import React from 'react';
import { Box, Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

export const DogAsciiArt: React.FC = () => {
  // ASCII art dog - clean terminal style
  const dogArt = [
    '     __',
    '  o-\'\'|\\_____/)',
    '   \\_/|_)     )',
    '    \\  __  /',
    '    (_/ (_/'
  ];

  return (
    <Box flexDirection="column">
      {dogArt.map((line, index) => (
        <Text key={index} color={pixelTheme.colors.text}>
          {line}
        </Text>
      ))}
    </Box>
  );
};