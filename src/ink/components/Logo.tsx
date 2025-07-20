import React from 'react';
import { Box, Text } from 'ink';

export const Logo: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="cyan" bold>
        GRAPHYN
      </Text>
    </Box>
  );
};