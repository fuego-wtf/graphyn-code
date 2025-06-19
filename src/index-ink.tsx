#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text, useApp } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';

interface AppProps {
  command?: string;
  args?: string[];
}

const App: React.FC<AppProps> = ({ command, args = [] }) => {
  const { exit } = useApp();
  const [mode, setMode] = useState<'menu' | 'loading' | 'done'>('menu');
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const items = [
    { label: 'Backend Agent', value: 'backend' },
    { label: 'Frontend Agent', value: 'frontend' },
    { label: 'Architect Agent', value: 'architect' },
    { label: 'Design Agent', value: 'design' },
    { label: 'Exit', value: 'exit' }
  ];

  const handleSelect = (item: { value: string }) => {
    if (item.value === 'exit') {
      exit();
    } else {
      setSelectedAgent(item.value);
      setMode('loading');
      
      // Simulate context preparation
      setTimeout(() => {
        setMode('done');
        setTimeout(() => exit(), 2000);
      }, 2000);
    }
  };

  if (mode === 'loading') {
    return (
      <Box padding={1}>
        <Text>
          <Spinner type="dots" /> Preparing {selectedAgent} agent context...
        </Text>
      </Box>
    );
  }

  if (mode === 'done') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✅ Context prepared!</Text>
        <Text>Run: claude "your query here"</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="rainbow">
        <BigText text="GRAPHYN" />
      </Gradient>
      <Text>Select an agent:</Text>
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
};

// Parse command line args
const [, , command, ...args] = process.argv;

// Render the app
render(<App command={command} args={args} />);