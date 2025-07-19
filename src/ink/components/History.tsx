import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { useStore } from '../store.js';

interface HistoryEntry {
  timestamp: string;
  agent: string;
  query: string;
  contextFile: string;
}

export const History: React.FC = () => {
  const { reset } = useStore();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');

  useInput((input, key) => {
    if (key.escape) {
      if (showContent) {
        setShowContent(false);
        setFileContent('');
      } else {
        reset();
      }
    } else if (key.upArrow && !showContent) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow && !showContent) {
      setSelectedIndex(prev => Math.min(entries.length - 1, prev + 1));
    } else if (key.return && entries[selectedIndex] && !showContent) {
      // Show content of selected entry
      loadFileContent(entries[selectedIndex].contextFile);
    }
  });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    
    try {
      const graphynDir = path.join(os.homedir(), '.graphyn');
      const logsDir = path.join(graphynDir, 'logs');
      
      if (!fs.existsSync(logsDir)) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Read all log files
      const logFiles = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 5); // Last 5 days

      const allEntries: HistoryEntry[] = [];
      
      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              allEntries.push(entry);
            } catch {
              // Skip invalid JSON lines
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      // Sort by timestamp and take last 20
      const sortedEntries = allEntries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      setEntries(sortedEntries);
    } catch (error) {
      console.error('Failed to load history:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        setFileContent(content);
        setShowContent(true);
      } else {
        setFileContent('File no longer exists');
        setShowContent(true);
      }
    } catch (error) {
      setFileContent('Failed to read file');
      setShowContent(true);
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📜 History</Text>
        <Box marginTop={1}>
          <Text>Loading history...</Text>
        </Box>
      </Box>
    );
  }

  if (showContent) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Context File Content</Text>
        <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1} height={20}>
          <Text>{fileContent.slice(0, 2000)}...</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📜 History</Text>
        <Box marginTop={1}>
          <Text color="gray">No history entries found</Text>
        </Box>
        <Box marginTop={2}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>📜 Recent Graphyn Interactions</Text>
      <Box marginTop={1}>
        <Text color="gray">{entries.length} entries found</Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        {entries.map((entry, index) => {
          const date = new Date(entry.timestamp);
          const isSelected = index === selectedIndex;
          
          return (
            <Box key={index} marginBottom={1}>
              <Box width={3}>
                <Text color={isSelected ? 'cyan' : 'gray'}>
                  {isSelected ? '▶' : ' '}
                </Text>
              </Box>
              <Box flexDirection="column">
                <Box>
                  <Text bold={isSelected} color={isSelected ? 'cyan' : 'white'}>
                    {entry.agent.charAt(0).toUpperCase() + entry.agent.slice(1)} Agent
                  </Text>
                  <Text color="gray"> - {date.toLocaleString()}</Text>
                </Box>
                <Box marginLeft={2}>
                  <Text color="gray" wrap="truncate-end">
                    {entry.query.length > 60 ? entry.query.slice(0, 60) + '...' : entry.query}
                  </Text>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>↑↓ Navigate • ↵ View context • ESC Exit</Text>
        <Text dimColor>Contexts saved in: ~/.graphyn/contexts/</Text>
      </Box>
    </Box>
  );
};