import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { CombinedLogo } from './CombinedLogo.js';
import { DogPixelArt } from './DogPixelArt.js';
import { pixelTheme } from '../theme/pixelart.js';

interface MainMenuProps {
  onSelect: (value: string) => void;
}

// Menu items matching Figma design
const menuItems = [
  { label: 'Login', value: 'auth' },
  { label: 'Analyze my repository', value: 'analyze' },
  { label: 'Revive .claude/agents 🔥', value: 'revive' },
  { label: 'Connect your accounts', value: 'connect' },
  { label: 'Exit', value: 'exit' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectableItems = menuItems;
  
  useInput((input, key) => {
    // Arrow key navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => {
        const newIndex = prev - 1;
        // Skip separators when navigating
        if (newIndex < 0) return selectableItems.length - 1;
        return newIndex;
      });
    } else if (key.downArrow || input === 'j') {
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
    } else if (input === 'g') {
      // Jump to first item (vim style)
      setSelectedIndex(0);
    } else if (input === 'G') {
      // Jump to last item (vim style)
      setSelectedIndex(selectableItems.length - 1);
    }
  });

  // Get currently selected value for comparison
  const currentValue = selectableItems[selectedIndex]?.value;

  return (
    <Box flexDirection="column" alignItems="flex-start" paddingX={1} paddingY={1}>
      {/* Top section with Dog and Text side by side */}
      <Box flexDirection="row" width="100%" marginBottom={2}>
        {/* Dog Pixel Art on the left */}
        <Box marginRight={3}>
          <DogPixelArt scale={1} color={pixelTheme.colors.accent} />
        </Box>
        
        {/* Logo and tagline section */}
        <Box flexDirection="column" alignItems="flex-start" justifyContent="center">
          {/* Combined Logo - left aligned */}
          <Box marginBottom={2}>
            <CombinedLogo />
          </Box>
          
          {/* Tagline with emoji - left aligned */}
          <Box>
            <Text color={pixelTheme.colors.text}>
              Hi there! Ignite intelligence in every line of code 🔥
            </Text>
          </Box>
        </Box>
      </Box>
      
      {/* Menu Section with terminal-style items */}
      <Box flexDirection="column" width="100%" marginTop={2}>
        {menuItems.map((item, index) => {
          const isSelected = item.value === currentValue;
          const menuText = `└─ ${item.label}`;
          
          return (
            <Box key={item.value} marginBottom={0}>
              <Text color={isSelected ? pixelTheme.colors.accent : pixelTheme.colors.text}>
                {menuText}
              </Text>
            </Box>
          );
        })}
      </Box>
      
      {/* Removed help text and cursor to match Figma design */}
    </Box>
  );
};

