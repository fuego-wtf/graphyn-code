import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { PixelFireLogo } from './PixelFireLogo.js';
import { GraphynTextLogo } from './GraphynTextLogo.js';
import { BlinkingCursor } from './BlinkingCursor.js';
import { pixelTheme, applyPixelTheme } from '../theme/pixelart.js';

interface MainMenuProps {
  onSelect: (value: string) => void;
}

// Menu items with terminal-style prefixes
const menuItems = [
  { label: 'Backend Agent', value: 'backend' },
  { label: 'Frontend Agent', value: 'frontend' },
  { label: 'Architect Agent', value: 'architect' },
  { label: 'Design Agent', value: 'design' },
  { label: 'CLI Agent', value: 'cli' },
  { label: '', value: 'separator' },
  { label: 'Authentication', value: 'auth' },
  { label: 'Exit', value: 'exit' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectableItems = menuItems.filter(item => item.value !== 'separator');
  
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const newIndex = prev - 1;
        // Skip separators when navigating
        if (newIndex < 0) return selectableItems.length - 1;
        return newIndex;
      });
    } else if (key.downArrow) {
      setSelectedIndex((prev) => {
        const newIndex = prev + 1;
        // Skip separators when navigating
        if (newIndex >= selectableItems.length) return 0;
        return newIndex;
      });
    } else if (key.return) {
      const selectedItem = selectableItems[selectedIndex];
      if (selectedItem) {
        onSelect(selectedItem.value);
      }
    } else if (input === 'q' || key.escape) {
      onSelect('exit');
    }
  });

  // Get currently selected value for comparison
  const currentValue = selectableItems[selectedIndex]?.value;

  return (
    <Box flexDirection="column" alignItems="flex-start" paddingY={1}>
      {/* Fire Logo */}
      <Box marginBottom={1} alignSelf="center">
        <PixelFireLogo />
      </Box>
      
      {/* GRAPHYN Text Logo */}
      <Box marginBottom={2} alignSelf="center">
        <GraphynTextLogo />
      </Box>
      
      {/* Subtitle with terminal styling */}
      <Box marginBottom={3} alignSelf="center">
        <Text color={pixelTheme.colors.dim}>
          Squad Initializer for Claude Code
        </Text>
      </Box>
      
      {/* Menu Section with terminal-style items */}
      <Box flexDirection="column" width="100%">
        {menuItems.map((item, index) => {
          if (item.value === 'separator') {
            return (
              <Box key={index} marginY={1}>
                <Text color={pixelTheme.colors.dim}>
                  {pixelTheme.characters.horizontal.repeat(50)}
                </Text>
              </Box>
            );
          }
          
          const isSelected = item.value === currentValue;
          const menuText = applyPixelTheme.menuItem(item.label, isSelected);
          
          return (
            <Box key={item.value}>
              <Text color={isSelected ? pixelTheme.colors.accent : pixelTheme.colors.text}>
                {menuText}
              </Text>
            </Box>
          );
        })}
      </Box>
      
      {/* Help Text with terminal styling */}
      <Box marginTop={3} alignSelf="center">
        <Text>
          <Text color={pixelTheme.colors.accent}>↑↓</Text>
          <Text color={pixelTheme.colors.dim}> Navigate  </Text>
          <Text color={pixelTheme.colors.accent}>↵</Text>
          <Text color={pixelTheme.colors.dim}> Select  </Text>
          <Text color={pixelTheme.colors.accent}>?</Text>
          <Text color={pixelTheme.colors.dim}> Help  </Text>
          <Text color={pixelTheme.colors.accent}>ESC</Text>
          <Text color={pixelTheme.colors.dim}> Exit</Text>
        </Text>
      </Box>
      
      {/* Blinking cursor at the bottom */}
      <Box marginTop={1}>
        <BlinkingCursor />
      </Box>
    </Box>
  );
};

