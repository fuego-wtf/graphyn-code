import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <Box padding={1}>
      <Text>
        <Spinner type="dots" /> {message}
      </Text>
    </Box>
  );
};