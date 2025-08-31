import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { CombinedLogo } from './CombinedLogo.js';
import { DogPixelArt } from './DogPixelArt.js';
import { pixelTheme } from '../theme/pixelart.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { InlineSearch } from './InlineSearch.js';
import { HelpOverlay } from './HelpOverlay.js';

interface MainMenuProps {
  onSelect: (value: string) => void;
}

// Menu items matching Figma design
const menuItems = [
  { label: 'Analyze my repository', value: 'analyze' },
  { label: 'Revive .claude/agents 🔥', value: 'revive' },
  { label: 'Connect your accounts', value: 'connect' },
  { label: 'Exit', value: 'exit' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return menuItems;
    return menuItems.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);
  
  const selectableItems = filteredItems;
  
  // Navigation handlers
  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => {
      const newIndex = prev - 1;
      if (newIndex < 0) return selectableItems.length - 1;
      return newIndex;
    });
  }, [selectableItems.length]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => {
      const newIndex = prev + 1;
      if (newIndex >= selectableItems.length) return 0;
      return newIndex;
    });
  }, [selectableItems.length]);

  const selectCurrent = useCallback(() => {
    const selectedItem = selectableItems[selectedIndex];
    if (selectedItem) {
      onSelect(selectedItem.value);
    }
  }, [selectedIndex, selectableItems, onSelect]);

  const selectByNumber = useCallback((num: number) => {
    const index = num - 1;
    if (index >= 0 && index < selectableItems.length) {
      setSelectedIndex(index);
      const item = selectableItems[index];
      if (item) {
        onSelect(item.value);
      }
    }
  }, [selectableItems, onSelect]);

  // Advanced keyboard shortcuts
  const shortcuts = useKeyboardShortcuts({
    shortcuts: [
      // Search
      {
        key: '/',
        handler: () => setShowSearch(true),
        description: 'Search menu items',
        enabled: !showSearch && !showHelp,
      },
      // Help
      {
        key: '?',
        handler: () => setShowHelp(true),
        description: 'Show help',
        enabled: !showHelp,
      },
      // Navigation
      {
        key: ['up', 'k'],
        handler: moveUp,
        enabled: !showSearch && !showHelp,
      },
      {
        key: ['down', 'j'],
        handler: moveDown,
        enabled: !showSearch && !showHelp,
      },
      {
        key: 'tab',
        handler: moveDown,
        description: 'Next item',
        enabled: !showSearch && !showHelp,
      },
      {
        key: 'tab',
        shift: true,
        handler: moveUp,
        description: 'Previous item',
        enabled: !showSearch && !showHelp,
      },
      // Selection
      {
        key: 'enter',
        handler: selectCurrent,
        enabled: !showSearch && !showHelp,
      },
      // Number keys for quick selection
      ...Array.from({ length: 5 }, (_, i) => ({
        key: String(i + 1),
        handler: () => selectByNumber(i + 1),
        description: `Select item ${i + 1}`,
        enabled: !showSearch && !showHelp,
      })),
      // Vim-style navigation
      {
        key: 'g',
        handler: () => setSelectedIndex(0),
        description: 'Go to first',
        enabled: !showSearch && !showHelp,
      },
      {
        key: 'G',
        handler: () => setSelectedIndex(selectableItems.length - 1),
        description: 'Go to last',
        enabled: !showSearch && !showHelp,
      },
      // Exit
      {
        key: ['q', 'escape'],
        handler: () => {
          if (showSearch) {
            setShowSearch(false);
            setSearchQuery('');
          } else if (showHelp) {
            setShowHelp(false);
          } else {
            onSelect('exit');
          }
        },
        enabled: true,
      },
    ],
  });

  // Legacy input handler for compatibility
  useInput(() => {
    // All input is now handled by useKeyboardShortcuts
  });

  // Get currently selected value for comparison
  const currentValue = selectableItems[selectedIndex]?.value;

  // Get shortcut descriptions for help
  const helpShortcuts = shortcuts.getShortcutDescriptions();

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
      
      {/* Search overlay */}
      {showSearch && (
        <Box marginBottom={1}>
          <InlineSearch
            onSearch={setSearchQuery}
            onClose={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            placeholder="Type to filter menu items..."
            initialValue={searchQuery}
          />
        </Box>
      )}

      {/* Menu Section with terminal-style items */}
      <Box flexDirection="column" width="100%" marginTop={2}>
        {filteredItems.map((item, index) => {
          const isSelected = item.value === currentValue;
          const displayIndex = menuItems.indexOf(item) + 1;
          const menuText = `└─ ${item.label}`;
          
          return (
            <Box key={item.value} marginBottom={0}>
              <Box>
                <Text dimColor>{displayIndex}. </Text>
                <Text color={isSelected ? pixelTheme.colors.accent : pixelTheme.colors.text}>
                  {menuText}
                </Text>
              </Box>
            </Box>
          );
        })}
        {filteredItems.length === 0 && (
          <Text dimColor italic>No items match your search</Text>
        )}
      </Box>

      {/* Help text */}
      {!showHelp && !showSearch && (
        <Box marginTop={2}>
          <Text dimColor>
            Press / to search • ? for help • 1-5 for quick select
          </Text>
        </Box>
      )}

      {/* Help overlay */}
      {showHelp && (
        <Box position="absolute" marginTop={2}>
          <HelpOverlay
            shortcuts={helpShortcuts}
            onClose={() => setShowHelp(false)}
            title="Main Menu Shortcuts"
          />
        </Box>
      )}
    </Box>
  );
};

