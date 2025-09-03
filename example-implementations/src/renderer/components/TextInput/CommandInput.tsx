import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, AtSign, Command as CommandIcon } from 'lucide-react';
import { Agent } from '../../../shared/types';
import { AutoComplete } from './AutoComplete';
import { cn } from '../../utils/cn';

interface CommandInputProps {
  agents: Agent[];
  onSendCommand: (command: string, agentId?: string) => void;
  placeholder?: string;
  className?: string;
  commandHistory: string[];
}

export const CommandInput: React.FC<CommandInputProps> = ({
  agents,
  onSendCommand,
  placeholder = "Type a command or @ to select an agent...",
  className,
  commandHistory
}) => {
  const [input, setInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Parse mentions in the input
  const parseMentions = useCallback((text: string) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({
        text: match[0],
        name: match[1],
        index: match.index
      });
    }
    
    return mentions;
  }, []);

  // Check if cursor is at a mention position
  const checkForMention = useCallback(() => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1 && cursorPos - lastAtIndex <= 20) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (/^\w*$/.test(textAfterAt)) {
        setShowAutocomplete(true);
        return textAfterAt;
      }
    }
    
    setShowAutocomplete(false);
    return null;
  }, [input]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    setCursorPosition(e.target.selectionStart || 0);
    checkForMention();
    setHistoryIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp' && !showAutocomplete) {
      e.preventDefault();
      navigateHistory(-1);
    } else if (e.key === 'ArrowDown' && !showAutocomplete) {
      e.preventDefault();
      navigateHistory(1);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  // Navigate command history
  const navigateHistory = (direction: number) => {
    const newIndex = historyIndex + direction;
    
    if (newIndex >= -1 && newIndex < commandHistory.length) {
      setHistoryIndex(newIndex);
      if (newIndex === -1) {
        setInput('');
      } else {
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    }
  };

  // Handle agent selection from autocomplete
  const handleAgentSelect = (agent: Agent) => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const newInput = 
        input.slice(0, lastAtIndex) + 
        `@${agent.name} ` + 
        input.slice(cursorPos);
      
      setInput(newInput);
      setSelectedAgentId(agent.id);
      setShowAutocomplete(false);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = lastAtIndex + agent.name.length + 2;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  // Submit command
  const handleSubmit = () => {
    if (!input.trim()) return;
    
    // Extract agent from mentions
    const mentions = parseMentions(input);
    let targetAgentId = selectedAgentId;
    
    if (mentions.length > 0) {
      const agentName = mentions[0].name;
      const agent = agents.find(a => 
        a.name.toLowerCase() === agentName.toLowerCase()
      );
      if (agent) {
        targetAgentId = agent.id;
      }
    }
    
    onSendCommand(input, targetAgentId);
    setInput('');
    setSelectedAgentId(null);
    setHistoryIndex(-1);
  };

  useEffect(() => {
    checkForMention();
  }, [cursorPosition, checkForMention]);

  const searchQuery = checkForMention() || '';

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors">
        {/* Command Icon */}
        <div className="pl-4 text-gray-500">
          {selectedAgent ? (
            <div className="flex items-center gap-2 text-sm">
              <AtSign className="w-4 h-4" />
              <span className="text-gray-400">{selectedAgent.displayName}</span>
            </div>
          ) : (
            <CommandIcon className="w-4 h-4" />
          )}
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 pr-2 text-white placeholder-gray-500 
                   focus:outline-none text-sm"
        />

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={cn(
            "mr-2 p-2 rounded-md transition-colors",
            input.trim()
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {showAutocomplete && (
        <AutoComplete
          agents={agents}
          searchQuery={searchQuery}
          onSelect={handleAgentSelect}
          onClose={() => setShowAutocomplete(false)}
        />
      )}

      {/* Command hints */}
      <div className="mt-2 text-xs text-gray-500">
        Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">@</kbd> to mention an agent, 
        <kbd className="px-1 py-0.5 bg-gray-800 rounded ml-2">↑↓</kbd> for history
      </div>
    </div>
  );
};