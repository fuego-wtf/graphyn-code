import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { StreamingOutput } from './StreamingOutput.js';
import { TaskDecomposition } from './TaskDecomposition.js';
import { StatusBar } from './StatusBar.js';
import { fuegoColors, colors } from '../theme/colors.js';

interface Task {
  id: string;
  title: string;
  description: string;
  agentType: '@backend' | '@frontend' | '@architect' | '@tester' | '@mobile';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: string;
  dependencies?: string[];
  output?: string[];
  error?: string;
}

interface SplitScreenLayoutProps {
  tasks: Task[];
  streamingData: {
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    currentPhase: 'analysis' | 'planning' | 'execution' | 'review' | 'complete';
    output: string[];
    currentMessage?: string;
  };
  onTaskSelect?: (taskId: string) => void;
  onPhaseChange?: (phase: string) => void;
  showHelp?: boolean;
}

export const SplitScreenLayout: React.FC<SplitScreenLayoutProps> = ({
  tasks,
  streamingData,
  onTaskSelect,
  onPhaseChange,
  showHelp = false
}) => {
  const { stdout } = useStdout();
  const [selectedPanel, setSelectedPanel] = useState<'left' | 'right'>('left');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 120);
  const [showDetailView, setShowDetailView] = useState(false);
  
  // Get terminal dimensions
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(process.stdout.columns || 120);
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.tab) {
      // Switch between panels
      setSelectedPanel(selectedPanel === 'left' ? 'right' : 'left');
    } else if (key.upArrow || input === 'k') {
      if (selectedPanel === 'right' && tasks.length > 0) {
        setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
        onTaskSelect?.(tasks[selectedTaskIndex]?.id);
      }
    } else if (key.downArrow || input === 'j') {
      if (selectedPanel === 'right' && tasks.length > 0) {
        setSelectedTaskIndex(Math.min(tasks.length - 1, selectedTaskIndex + 1));
        onTaskSelect?.(tasks[selectedTaskIndex]?.id);
      }
    } else if (key.return) {
      if (selectedPanel === 'right' && tasks[selectedTaskIndex]) {
        setShowDetailView(!showDetailView);
      }
    } else if (input === '1' || input === '2' || input === '3' || input === '4' || input === '5') {
      const phases = ['analysis', 'planning', 'execution', 'review', 'complete'];
      const phaseIndex = parseInt(input) - 1;
      if (phases[phaseIndex]) {
        onPhaseChange?.(phases[phaseIndex]);
      }
    }
  });

  // Calculate panel widths based on terminal width
  const leftPanelWidth = Math.floor(terminalWidth * 0.6);
  const rightPanelWidth = terminalWidth - leftPanelWidth - 3; // Account for borders

  // Get current phase indicator
  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'analysis': return '🔍';
      case 'planning': return '📋';
      case 'execution': return '⚡';
      case 'review': return '👀';
      case 'complete': return '✅';
      default: return '•';
    }
  };

  // Get connection status indicator
  const getConnectionIcon = (status: string) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.accent}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box justifyContent="space-between" width="100%">
          <Text color={fuegoColors.text.primary} bold>
            🚀 Graphyn Orchestration Engine
          </Text>
          <Box flexDirection="row" gap={2}>
            <Text color={fuegoColors.text.secondary}>
              {getConnectionIcon(streamingData.connectionStatus)} {streamingData.connectionStatus}
            </Text>
            <Text color={fuegoColors.text.secondary}>
              {getPhaseIcon(streamingData.currentPhase)} {streamingData.currentPhase}
            </Text>
            <Text color={fuegoColors.text.dimmed}>
              {tasks.filter(t => t.status === 'completed').length}/{tasks.length} tasks
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Main split-screen content */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel - Streaming Output */}
        <Box 
          flexDirection="column"
          width={leftPanelWidth}
          borderStyle="round"
          borderColor={selectedPanel === 'left' ? fuegoColors.border.accent : fuegoColors.border.subtle}
          paddingX={1}
          marginRight={1}
        >
          <Box borderBottom marginBottom={1} paddingBottom={1}>
            <Text color={selectedPanel === 'left' ? fuegoColors.text.primary : fuegoColors.text.secondary} bold>
              📡 Real-time Streaming Output
            </Text>
            {selectedPanel === 'left' && (
              <Text color={fuegoColors.accent.blue} dimColor>
                {' '}• Active Panel
              </Text>
            )}
          </Box>
          
          <StreamingOutput
            output={streamingData.output}
            currentMessage={streamingData.currentMessage}
            connectionStatus={streamingData.connectionStatus}
            maxHeight={process.stdout.rows ? process.stdout.rows - 8 : 20}
          />
        </Box>

        {/* Right Panel - Task Decomposition */}
        <Box 
          flexDirection="column"
          width={rightPanelWidth}
          borderStyle="round"
          borderColor={selectedPanel === 'right' ? fuegoColors.border.accent : fuegoColors.border.subtle}
          paddingX={1}
        >
          <Box borderBottom marginBottom={1} paddingBottom={1}>
            <Text color={selectedPanel === 'right' ? fuegoColors.text.primary : fuegoColors.text.secondary} bold>
              📋 Task Decomposition
            </Text>
            {selectedPanel === 'right' && (
              <Text color={fuegoColors.accent.blue} dimColor>
                {' '}• Active Panel
              </Text>
            )}
          </Box>
          
          <TaskDecomposition
            tasks={tasks}
            selectedIndex={selectedTaskIndex}
            showDetailView={showDetailView}
            onTaskSelect={(index) => {
              setSelectedTaskIndex(index);
              onTaskSelect?.(tasks[index]?.id);
            }}
            maxHeight={process.stdout.rows ? process.stdout.rows - 8 : 20}
          />
        </Box>
      </Box>

      {/* Footer - Status Bar with keyboard shortcuts */}
      <StatusBar
        activePanel={selectedPanel}
        currentPhase={streamingData.currentPhase}
        tasksCompleted={tasks.filter(t => t.status === 'completed').length}
        totalTasks={tasks.length}
        showHelp={showHelp}
        shortcuts={[
          { key: 'Tab', description: 'Switch panels' },
          { key: '↑↓/jk', description: 'Navigate tasks' },
          { key: 'Enter', description: 'Toggle details' },
          { key: '1-5', description: 'Jump to phase' },
          { key: '?', description: 'Toggle help' }
        ]}
      />
    </Box>
  );
};