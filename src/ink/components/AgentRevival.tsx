import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { AgentRevivalService } from '../../services/agent-revival.js';
import { ParsedAgent } from '../../services/agent-parser.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { InlineSearch } from './InlineSearch.js';
import { HelpOverlay } from './HelpOverlay.js';
import chalk from 'chalk';

interface AgentRevivalProps {
  onComplete: () => void;
}

export const AgentRevival: React.FC<AgentRevivalProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<ParsedAgent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviving, setReviving] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const revivalService = new AgentRevivalService();
  
  useEffect(() => {
    const discoverAgents = async () => {
      try {
        const discovered = await revivalService.discoverAgents();
        setAgents(discovered);
        setLoading(false);
      } catch (error) {
        console.error('Failed to discover agents:', error);
        setLoading(false);
      }
    };
    
    discoverAgents();
  }, []);
  
  // Filter agents based on search
  const filteredAgents = useMemo(() => {
    if (!searchQuery) return agents;
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [agents, searchQuery]);

  // Adjust current index when filtering
  useEffect(() => {
    if (currentIndex >= filteredAgents.length) {
      setCurrentIndex(Math.max(0, filteredAgents.length - 1));
    }
  }, [filteredAgents.length, currentIndex]);

  // Navigation handlers
  const toggleSelection = useCallback(() => {
    if (filteredAgents.length === 0) return;
    const agent = filteredAgents[currentIndex];
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agent.name)) {
      newSelected.delete(agent.name);
    } else {
      newSelected.add(agent.name);
    }
    setSelectedAgents(newSelected);
  }, [currentIndex, filteredAgents, selectedAgents]);

  const toggleAndMoveNext = useCallback(() => {
    toggleSelection();
    setCurrentIndex(prev => Math.min(filteredAgents.length - 1, prev + 1));
  }, [toggleSelection, filteredAgents.length]);

  const invertSelection = useCallback(() => {
    const newSelected = new Set<string>();
    filteredAgents.forEach(agent => {
      if (!selectedAgents.has(agent.name)) {
        newSelected.add(agent.name);
      }
    });
    setSelectedAgents(newSelected);
  }, [filteredAgents, selectedAgents]);

  // Define handleRevive before using it in shortcuts
  const handleRevive = useCallback(async () => {
    setReviving(true);
    
    const selected = agents.filter(a => selectedAgents.has(a.name));
    const result = await revivalService.reviveAgents(selected);
    
    setResults(result);
    
    // Show results for 3 seconds then return
    setTimeout(() => {
      onComplete();
    }, 3000);
  }, [agents, selectedAgents, onComplete]);

  // Keyboard shortcuts
  const shortcuts = useKeyboardShortcuts({
    shortcuts: [
      // Search
      {
        key: '/',
        handler: () => setShowSearch(true),
        description: 'Filter agents',
        enabled: !showSearch && !showHelp && !reviving,
      },
      // Help
      {
        key: '?',
        handler: () => setShowHelp(true),
        description: 'Show help',
        enabled: !showHelp && !reviving,
      },
      // Navigation
      {
        key: ['up', 'k'],
        handler: () => setCurrentIndex(prev => Math.max(0, prev - 1)),
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      {
        key: ['down', 'j'],
        handler: () => setCurrentIndex(prev => Math.min(filteredAgents.length - 1, prev + 1)),
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      // TAB cycling with selection
      {
        key: 'tab',
        handler: toggleAndMoveNext,
        description: 'Toggle & next',
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      // Selection
      {
        key: ' ',
        handler: toggleSelection,
        description: 'Toggle selection',
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      {
        key: 'a',
        handler: () => setSelectedAgents(new Set(filteredAgents.map(a => a.name))),
        description: 'Select all',
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      {
        key: 'n',
        handler: () => setSelectedAgents(new Set()),
        description: 'Select none',
        enabled: !showSearch && !showHelp && !reviving,
      },
      {
        key: 'i',
        handler: invertSelection,
        description: 'Invert selection',
        enabled: !showSearch && !showHelp && !reviving && filteredAgents.length > 0,
      },
      // Actions
      {
        key: 'enter',
        handler: handleRevive,
        enabled: !showSearch && !showHelp && !reviving && selectedAgents.size > 0,
      },
      {
        key: 'escape',
        handler: () => {
          if (showSearch) {
            setShowSearch(false);
            setSearchQuery('');
          } else if (showHelp) {
            setShowHelp(false);
          } else {
            onComplete();
          }
        },
        enabled: true,
      },
    ],
  });

  // Legacy input handler disabled
  useInput(() => {});
  
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Discovering static agents...
          </Text>
        </Box>
      </Box>
    );
  }
  
  if (agents.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No static agents found in .claude/agents</Text>
        <Text color="gray">Create agent definitions in .claude/agents/*.md to get started!</Text>
        <Box marginTop={1}>
          <Text color="gray">Press ESC to return to menu</Text>
        </Box>
      </Box>
    );
  }
  
  if (results) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>✨ Agent Revival Complete!</Text>
        <Box marginTop={1}>
          <Text>Successfully revived {results.succeeded} of {results.total} agents</Text>
        </Box>
        {results.agents.map((agent: any) => (
          <Box key={agent.name} marginLeft={2}>
            <Text color={agent.status === 'success' ? 'green' : 'red'}>
              {agent.status === 'success' ? '✓' : '✗'} {agent.name}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }
  
  if (reviving) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Bringing agents to life...
          </Text>
        </Box>
      </Box>
    );
  }
  
  // Get shortcut descriptions
  const helpShortcuts = shortcuts.getShortcutDescriptions();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>🔥 AGENT REVIVAL SYSTEM</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>Found {agents.length} static agents that can be brought to life!</Text>
        {searchQuery && (
          <Text color="cyan"> (Showing {filteredAgents.length} matching "{searchQuery}")</Text>
        )}
      </Box>

      {/* Search overlay */}
      {showSearch && (
        <Box marginBottom={1}>
          <InlineSearch
            onSearch={setSearchQuery}
            onClose={() => {
              setShowSearch(false);
            }}
            placeholder="Filter agents by name or description..."
            initialValue={searchQuery}
          />
        </Box>
      )}
      
      <Box flexDirection="column" marginBottom={1}>
        {filteredAgents.map((agent, index) => {
          const isSelected = selectedAgents.has(agent.name);
          const isCurrent = index === currentIndex;
          
          return (
            <Box key={agent.name}>
              <Text color={isCurrent ? 'cyan' : 'white'}>
                {isCurrent ? '>' : ' '} [{isSelected ? 'x' : ' '}] {agent.name} - {agent.description.substring(0, 50)}...
              </Text>
            </Box>
          );
        })}
        {filteredAgents.length === 0 && searchQuery && (
          <Text dimColor italic>No agents match your filter</Text>
        )}
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        {!showHelp && !showSearch && (
          <Text color="gray">/ Filter | TAB: Toggle & Next | i: Invert | ? Help | ENTER: Revive</Text>
        )}
        <Text color="green">Selected: {selectedAgents.size} agents</Text>
      </Box>

      {/* Help overlay */}
      {showHelp && (
        <Box position="absolute" marginTop={2}>
          <HelpOverlay
            shortcuts={helpShortcuts}
            onClose={() => setShowHelp(false)}
            title="Agent Revival Shortcuts"
          />
        </Box>
      )}
    </Box>
  );
};