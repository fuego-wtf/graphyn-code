import React from 'react';
import { Box, Text } from 'ink';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation.js';

interface SelectItem {
  label: string;
  value: string;
  disabled?: boolean;
}

interface EnhancedSelectProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
  onCancel?: () => void;
  isFocused?: boolean;
  showSearch?: boolean;
  indicatorComponent?: React.FC<{ isSelected: boolean }>;
  itemComponent?: React.FC<{ isSelected: boolean; item: SelectItem }>;
}

const DefaultIndicator: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
  <Box marginRight={1}>
    <Text color={isSelected ? 'cyan' : 'gray'}>
      {isSelected ? '▶' : ' '}
    </Text>
  </Box>
);

const DefaultItem: React.FC<{ isSelected: boolean; item: SelectItem }> = ({ isSelected, item }) => (
  <Text 
    color={item.disabled ? 'gray' : (isSelected ? 'cyan' : 'white')} 
    bold={isSelected && !item.disabled}
    dimColor={item.disabled}
  >
    {item.label}
  </Text>
);

export const EnhancedSelect: React.FC<EnhancedSelectProps> = ({
  items,
  onSelect,
  onCancel,
  isFocused = true,
  showSearch = true,
  indicatorComponent: IndicatorComponent = DefaultIndicator,
  itemComponent: ItemComponent = DefaultItem
}) => {
  const selectableItems = items.filter(item => !item.disabled);
  
  const {
    selectedIndex,
    searchMode,
    searchQuery
  } = useKeyboardNavigation({
    items: selectableItems,
    onSelect: (item) => onSelect(item),
    onCancel,
    isActive: isFocused
  });

  // Map selected index back to full items array
  const fullSelectedIndex = items.indexOf(selectableItems[selectedIndex]);

  return (
    <Box flexDirection="column">
      {searchMode && showSearch && (
        <Box marginBottom={1}>
          <Text color="cyan">Search: </Text>
          <Text>{searchQuery}_</Text>
        </Box>
      )}
      
      {items.map((item, index) => (
        <Box key={index}>
          <IndicatorComponent isSelected={index === fullSelectedIndex} />
          <ItemComponent 
            isSelected={index === fullSelectedIndex} 
            item={item} 
          />
        </Box>
      ))}
      
      {showSearch && !searchMode && (
        <Box marginTop={1}>
          <Text dimColor>Press / to search</Text>
        </Box>
      )}
    </Box>
  );
};