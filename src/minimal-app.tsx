#!/usr/bin/env node
import React, { useEffect } from 'react';
import { render, Text, Box, useApp } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

const MinimalApp = () => {
  const { exit } = useApp();

  useEffect(() => {
    // Auto-exit after 2 seconds
    const timer = setTimeout(() => {
      exit();
    }, 2000);

    return () => clearTimeout(timer);
  }, [exit]);

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={1}>
      <Gradient name="rainbow">
        <BigText text="GRAPHYN" font="chrome" />
      </Gradient>
      <Text>Hello from Ink! Auto-exiting in 2 seconds...</Text>
    </Box>
  );
};

// Render the app
render(<MinimalApp />);