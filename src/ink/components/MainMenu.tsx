import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

interface MainMenuProps {
  onSelect: (value: string) => void;
}

const menuItems = [
  { label: '⚡ Backend Agent', value: 'backend' },
  { label: '✨ Frontend Agent', value: 'frontend' },
  { label: '🏗️  Architect Agent', value: 'architect' },
  { label: '🎨 Design Agent', value: 'design' },
  { label: '🤖 CLI Agent', value: 'cli' },
  { label: '─────────────────', value: 'separator1' },
  { label: '📋 Manage Threads', value: 'threads' },
  { label: '🔐 Authentication', value: 'auth' },
  { label: '🩺 Doctor', value: 'doctor' },
  { label: '📊 Monitor', value: 'monitor' },
  { label: '─────────────────', value: 'separator2' },
  { label: '📊 Project Status', value: 'status' },
  { label: '🔄 Sync GRAPHYN.md', value: 'sync' },
  { label: '📜 History', value: 'history' },
  { label: '🚀 Share Agent', value: 'share' },
  { label: '🤝 Collaborate', value: 'collaborate' },
  { label: '─────────────────', value: 'separator3' },
  { label: '❌ Exit', value: 'exit' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
  const handleSelect = (item: { value: string }) => {
    if (!item.value.startsWith('separator')) {
      onSelect(item.value);
    }
  };

  const filteredItems = menuItems.filter(item => !item.value.startsWith('separator'));

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      {/* Logo Section */}
      <Box justifyContent="center" marginBottom={1}>
        <Gradient name="rainbow">
          <BigText text="GRAPHYN" font="chrome" />
        </Gradient>
      </Box>
      
      {/* Subtitle */}
      <Box justifyContent="center" marginBottom={2}>
        <Text color="gray" dimColor>AI Development Tool for Claude Code</Text>
      </Box>
      
      {/* Menu Section */}
      <Box flexDirection="column" width={40}>
        <SelectInput 
          items={filteredItems} 
          onSelect={handleSelect}
          indicatorComponent={({ isSelected }) => (
            <Box marginRight={1}>
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? '▶' : ' '}
              </Text>
            </Box>
          )}
          itemComponent={({ isSelected, label }) => (
            <Box>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {label}
              </Text>
            </Box>
          )}
        />
      </Box>
      
      {/* Help Text */}
      <Box marginTop={3} justifyContent="center">
        <Text dimColor>
          <Text color="cyan">↑↓</Text> Navigate  <Text color="cyan">↵</Text> Select  <Text color="cyan">?</Text> Help  <Text color="cyan">⎋</Text> Exit
        </Text>
      </Box>
    </Box>
  );
};