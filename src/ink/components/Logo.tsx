import React from 'react';
import { Box } from 'ink';
import { PixelFireLogo } from './PixelFireLogo.js';
import { GraphynTextLogo } from './GraphynTextLogo.js';

export const Logo: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center" gap={1}>
      <PixelFireLogo />
      <GraphynTextLogo />
    </Box>
  );
};