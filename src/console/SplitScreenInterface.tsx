/**
 * Split Screen Interface - Ultimate Orchestration Platform UI
 *
 * 70/20/10 Layout:
 * - 70% Streaming output (Claude agent outputs)
 * - 20% Approval workflow (task assignments, controls)
 * - 10% Persistent input (always-accessible user input)
 *
 * Performance targets:
 * - 60fps UI performance (<16ms render)
 * - Real-time streaming with zero lag
 * - Keyboard shortcuts: [A]pprove [M]odify [F]eedback [C]ancel
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp, Spacer } from 'ink';
import Spinner from 'ink-spinner';
import { EventEmitter } from 'events';

// Types with proper TypeScript naming (PascalCase without I prefix)
export interface StreamingOutput {
  id: string;
  agentId: string;
  content: string;
  type: 'OUTPUT' | 'ERROR' | 'STATUS';
  timestamp: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  agentEmoji: string;
  agentName: string;
  description: string;
  estimatedTimeMinutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'COMPLETED';
}

export interface ApprovalWorkflow {
  batchId: string;
  tasks: TaskAssignment[];
  totalEstimatedTime: number;
  currentSelection: number;
  showDetails: boolean;
}

export interface UiConfiguration {
  outputHeight: number;
  approvalHeight: number;
  inputHeight: number;
  maxOutputLines: number;
  scrollBuffer: number;
  refreshRateMs: number;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  enabled: boolean;
}

export interface SplitScreenProps {
  onUserInput: (input: string) => void;
  onApprovalAction: (action: 'approve' | 'modify' | 'feedback' | 'cancel', taskId?: string) => void;
  onExit: () => void;
  eventEmitter: EventEmitter;
  config?: Partial<UiConfiguration>;
}

export const SplitScreenInterface: React.FC<SplitScreenProps> = ({
  onUserInput,
  onApprovalAction,
  onExit,
  eventEmitter,
  config = {}
}) => {
  // State management
  const [streamingOutputs, setStreamingOutputs] = useState<StreamingOutput[]>([]);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [exitProtection, setExitProtection] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const { exit } = useApp();
  const outputRef = useRef<HTMLDivElement>(null);
  const lastRenderTime = useRef<number>(0);

  // Configuration with defaults
  const uiConfig: UiConfiguration = useMemo(() => ({
    outputHeight: Math.floor(process.stdout.rows * 0.7) || 20,
    approvalHeight: Math.floor(process.stdout.rows * 0.2) || 6,
    inputHeight: Math.floor(process.stdout.rows * 0.1) || 3,
    maxOutputLines: 1000,
    scrollBuffer: 50,
    refreshRateMs: 16, // 60fps target
    ...config
  }), [config, process.stdout.rows]);

  // Performance monitoring
  const trackRenderPerformance = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    if (timeSinceLastRender > 16) {
      console.warn(`⚠️  Render performance: ${timeSinceLastRender}ms (target: 16ms)`);
    }
    lastRenderTime.current = now;
  }, []);

  // Event handlers
  useEffect(() => {
    const handleStreamingOutput = (output: StreamingOutput) => {
      setStreamingOutputs(prev => {
        const newOutputs = [...prev, output].slice(-uiConfig.maxOutputLines);
        return newOutputs;
      });
    };

    const handleApprovalWorkflow = (workflow: ApprovalWorkflow) => {
      setApprovalWorkflow(workflow);
    };

    const handleExecutionStatus = (executing: boolean) => {
      setIsExecuting(executing);
    };

    eventEmitter.on('streaming-output', handleStreamingOutput);
    eventEmitter.on('approval-workflow', handleApprovalWorkflow);
    eventEmitter.on('execution-status', handleExecutionStatus);

    return () => {
      eventEmitter.off('streaming-output', handleStreamingOutput);
      eventEmitter.off('approval-workflow', handleApprovalWorkflow);
      eventEmitter.off('execution-status', handleExecutionStatus);
    };
  }, [eventEmitter, uiConfig.maxOutputLines]);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'a',
      description: '[A]pprove',
      action: () => onApprovalAction('approve'),
      enabled: !!approvalWorkflow && !isExecuting
    },
    {
      key: 'm',
      description: '[M]odify',
      action: () => onApprovalAction('modify'),
      enabled: !!approvalWorkflow && !isExecuting
    },
    {
      key: 'f',
      description: '[F]eedback',
      action: () => onApprovalAction('feedback'),
      enabled: !!approvalWorkflow && !isExecuting
    },
    {
      key: 'c',
      description: '[C]ancel',
      action: () => onApprovalAction('cancel'),
      enabled: !!approvalWorkflow
    },
    {
      key: 'h',
      description: '[H]elp',
      action: () => setShowHelp(!showHelp),
      enabled: true
    }
  ], [approvalWorkflow, isExecuting, onApprovalAction, showHelp]);

  // Input handling
  useInput((input, key) => {
    // Track render performance
    trackRenderPerformance();

    // Exit protection
    if (key.ctrl && input === 'c') {
      if (isExecuting && !exitProtection) {
        setExitProtection(true);
        return;
      }
      if (exitProtection) {
        onExit();
        exit();
        return;
      }
      if (!isExecuting) {
        onExit();
        exit();
        return;
      }
    }

    // Reset exit protection on any other key
    if (exitProtection) {
      setExitProtection(false);
    }

    // Handle shortcuts when not typing
    if (currentInput === '') {
      const shortcut = shortcuts.find(s => s.key === input.toLowerCase() && s.enabled);
      if (shortcut) {
        shortcut.action();
        return;
      }
    }

    // Handle input navigation
    if (key.upArrow) {
      if (historyIndex < inputHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentInput(inputHistory[inputHistory.length - 1 - newIndex] || '');
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(inputHistory[inputHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
      return;
    }

    // Handle text input
    if (key.return) {
      if (currentInput.trim()) {
        onUserInput(currentInput.trim());
        setInputHistory(prev => [...prev, currentInput.trim()].slice(-100));
        setHistoryIndex(-1);
        setCurrentInput('');
      }
      return;
    }

    if (key.backspace) {
      setCurrentInput(prev => prev.slice(0, -1));
      return;
    }

    if (key.delete) {
      setCurrentInput('');
      return;
    }

    // Add character
    if (input && !key.ctrl && !key.meta) {
      setCurrentInput(prev => prev + input);
    }
  });

  // Render streaming output section (70%)
  const renderStreamingOutput = () => {
    const visibleOutputs = streamingOutputs.slice(-uiConfig.outputHeight);

    return (
      <Box flexDirection="column" height={uiConfig.outputHeight} borderStyle="round" borderColor="blue">
        <Box>
          <Text bold color="blue">🖥️  Agent Output Stream </Text>
          <Spacer />
          {isExecuting && <Spinner type="dots" />}
          <Text color="gray"> [{visibleOutputs.length}/{streamingOutputs.length}]</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {visibleOutputs.length === 0 ? (
            <Box justifyContent="center" alignItems="center" height="100%">
              <Text color="gray" italic>Waiting for agent output...</Text>
            </Box>
          ) : (
            visibleOutputs.map((output, index) => (
              <Box key={`${output.id}-${index}`}>
                <Text color="cyan">[{output.agentId}]</Text>
                <Text color={output.type === 'ERROR' ? 'red' : 'white'}> {output.content}</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>
    );
  };

  // Render approval workflow section (20%)
  const renderApprovalWorkflow = () => {
    if (!approvalWorkflow) {
      return (
        <Box height={uiConfig.approvalHeight} borderStyle="round" borderColor="yellow">
          <Box justifyContent="center" alignItems="center" width="100%">
            <Text color="gray" italic>No pending approvals</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" height={uiConfig.approvalHeight} borderStyle="round" borderColor="yellow">
        <Box>
          <Text bold color="yellow">📋 Task Approval Required </Text>
          <Spacer />
          <Text color="gray">[{approvalWorkflow.tasks.length} tasks, ~{approvalWorkflow.totalEstimatedTime}min]</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          {approvalWorkflow.tasks.slice(0, 3).map((task, index) => (
            <Box key={task.taskId}>
              <Text color="white">{task.agentEmoji} </Text>
              <Text bold color="cyan">{task.agentName}</Text>
              <Text color="white">: {task.description}</Text>
              <Spacer />
              <Text color="gray">{task.estimatedTimeMinutes}min</Text>
            </Box>
          ))}

          {approvalWorkflow.tasks.length > 3 && (
            <Box>
              <Text color="gray" italic>...and {approvalWorkflow.tasks.length - 3} more tasks</Text>
            </Box>
          )}
        </Box>

        <Box>
          {shortcuts.filter(s => s.enabled && s.key !== 'h').map(shortcut => (
            <Box key={shortcut.key} marginRight={2}>
              <Text color="green">{shortcut.description}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  // Render persistent input section (10%)
  const renderPersistentInput = () => {
    return (
      <Box flexDirection="column" height={uiConfig.inputHeight} borderStyle="round" borderColor="green">
        <Box>
          <Text bold color="green">💬 Always-On Input</Text>
          <Spacer />
          {exitProtection && (
            <Text color="red" bold>⚠️  Press Ctrl+C again to exit</Text>
          )}
        </Box>

        <Box>
          <Text color="gray">$ </Text>
          <Text color="white">{currentInput}</Text>
          <Text color="green">█</Text>
        </Box>

        {showHelp && (
          <Box>
            <Text color="gray" italic>History: ↑↓ | Submit: Enter | Clear: Delete | Exit: Ctrl+C</Text>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {renderStreamingOutput()}
      {renderApprovalWorkflow()}
      {renderPersistentInput()}
    </Box>
  );
};

/**
 * Split Screen Interface Manager
 * Handles the lifecycle and event coordination for the split-screen UI
 */
export class SplitScreenInterfaceManager extends EventEmitter {
  private isActive: boolean = false;
  private config: UiConfiguration;

  constructor(config?: Partial<UiConfiguration>) {
    super();
    this.config = {
      outputHeight: Math.floor(process.stdout.rows * 0.7) || 20,
      approvalHeight: Math.floor(process.stdout.rows * 0.2) || 6,
      inputHeight: Math.floor(process.stdout.rows * 0.1) || 3,
      maxOutputLines: 1000,
      scrollBuffer: 50,
      refreshRateMs: 16,
      ...config
    };
  }

  /**
   * Start the split screen interface
   */
  public start(): void {
    this.isActive = true;
    this.emit('interface-started');
  }

  /**
   * Stop the split screen interface
   */
  public stop(): void {
    this.isActive = false;
    this.emit('interface-stopped');
  }

  /**
   * Stream agent output to the interface
   */
  public streamOutput(agentId: string, content: string, type: 'OUTPUT' | 'ERROR' | 'STATUS' = 'OUTPUT'): void {
    if (!this.isActive) return;

    const output: StreamingOutput = {
      id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      content,
      type,
      timestamp: Date.now()
    };

    this.emit('streaming-output', output);
  }

  /**
   * Show approval workflow
   */
  public showApprovalWorkflow(tasks: TaskAssignment[]): void {
    if (!this.isActive) return;

    const workflow: ApprovalWorkflow = {
      batchId: `batch-${Date.now()}`,
      tasks,
      totalEstimatedTime: tasks.reduce((sum, task) => sum + task.estimatedTimeMinutes, 0),
      currentSelection: 0,
      showDetails: false
    };

    this.emit('approval-workflow', workflow);
  }

  /**
   * Update execution status
   */
  public setExecutionStatus(isExecuting: boolean): void {
    this.emit('execution-status', isExecuting);
  }

  /**
   * Clear all outputs
   */
  public clearOutputs(): void {
    this.emit('clear-outputs');
  }

  /**
   * Get interface configuration
   */
  public getConfig(): UiConfiguration {
    return { ...this.config };
  }

  /**
   * Update interface configuration
   */
  public updateConfig(updates: Partial<UiConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }
}

/**
 * Create and configure split screen interface
 */
export function createSplitScreenInterface(
  onUserInput: (input: string) => void,
  onApprovalAction: (action: 'approve' | 'modify' | 'feedback' | 'cancel', taskId?: string) => void,
  onExit: () => void,
  config?: Partial<UiConfiguration>
): {
  interface: React.ReactElement;
  manager: SplitScreenInterfaceManager;
} {
  const manager = new SplitScreenInterfaceManager(config);

  const interfaceElement = React.createElement(SplitScreenInterface, {
    onUserInput,
    onApprovalAction,
    onExit,
    eventEmitter: manager,
    config
  });

  return { interface: interfaceElement, manager };
}

export default SplitScreenInterface;