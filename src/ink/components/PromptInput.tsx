import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, fuegoColors } from '../theme/colors.js';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  getSuggestions?: (prompt: string) => Promise<string[]>;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your prompt...',
  getSuggestions
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoWriteMode, setAutoWriteMode] = useState(false);
  const [lastTabTime, setLastTabTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useInput((input, key) => {
    if (key.tab) {
      const now = Date.now();
      const timeSinceLastTab = now - lastTabTime;
      
      if (timeSinceLastTab < 500) {
        // Double tab - activate auto-write mode
        setAutoWriteMode(true);
        setShowSuggestions(false);
        handleAutoWrite();
      } else {
        // Single tab - show suggestions
        if (!showSuggestions && getSuggestions && value.trim()) {
          fetchSuggestions();
        } else {
          setShowSuggestions(false);
        }
      }
      setLastTabTime(now);
    } else if (key.escape) {
      setShowSuggestions(false);
      setAutoWriteMode(false);
    }
  });

  const fetchSuggestions = useCallback(async () => {
    if (!getSuggestions || !value.trim()) return;
    
    setIsLoading(true);
    try {
      const results = await getSuggestions(value);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [value, getSuggestions]);

  const handleAutoWrite = useCallback(async () => {
    if (!getSuggestions || !value.trim()) return;
    
    setIsLoading(true);
    try {
      const results = await getSuggestions(value);
      if (results.length > 0) {
        // In auto-write mode, directly use the first suggestion
        onChange(results[0]);
        setAutoWriteMode(false);
      }
    } catch (error) {
      console.error('Failed to auto-write:', error);
    } finally {
      setIsLoading(false);
    }
  }, [value, getSuggestions, onChange]);

  const handleSuggestionSelect = useCallback((item: { value: string }) => {
    onChange(item.value);
    setShowSuggestions(false);
  }, [onChange]);

  const handleTextSubmit = useCallback(() => {
    setShowSuggestions(false);
    setAutoWriteMode(false);
    onSubmit(value);
  }, [value, onSubmit]);

  return (
    <Box flexDirection="column">
      <Box>
        {autoWriteMode ? (
          <Text color={colors.warning}>✨ </Text>
        ) : (
          <Text color={fuegoColors.text.primary}>{'> '}</Text>
        )}
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={handleTextSubmit}
          placeholder={placeholder}
        />
        {isLoading && (
          <Text color={fuegoColors.text.secondary}> ⟳</Text>
        )}
      </Box>
      
      {showSuggestions && suggestions.length > 0 && (
        <Box 
          flexDirection="column" 
          marginTop={1}
          borderStyle="single"
          borderColor={fuegoColors.border.subtle}
          paddingX={1}
        >
          <Text color={fuegoColors.text.dimmed} dimColor>
            Suggestions (↑/↓ to navigate, Enter to select, ESC to close):
          </Text>
          <SelectInput
            items={suggestions.map(s => ({ label: s, value: s }))}
            onSelect={handleSuggestionSelect}
            limit={5}
            indicatorComponent={({ isSelected }) => (
              <Text color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}>
                {isSelected ? '▶ ' : '  '}
              </Text>
            )}
          />
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color={fuegoColors.text.dimmed} dimColor>
          Tab: suggestions • Double Tab: auto-write • Enter: submit
        </Text>
      </Box>
    </Box>
  );
};