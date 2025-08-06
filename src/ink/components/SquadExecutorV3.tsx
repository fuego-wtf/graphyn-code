import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, Spacer, render } from 'ink';
import { colors, fuegoColors } from '../theme/colors.js';
import { ClaudeAgentLauncher } from '../../services/claude-agent-launcher.js';
import { exec as execCallback, spawn } from 'child_process';
import { promisify } from 'util';
import type { Task } from '../../services/claude-task-generator.js';
import type { AgentConfig, LocalSquad } from '../../services/squad-storage.js';
import type { RepositoryContext } from '../../services/claude-task-generator.js';
import EventEmitter from 'events';
import { showTmuxTips } from '../../services/tmux-tips.js';
import { createTmuxConfig } from '../../services/tmux-config.js';
import {
  AnimatedStatusIcon,
  EnhancedProgressBar,
  ActivityLog,
  MetricsDisplay,
  PriorityBadge,
  LoadingDots,
  GlassBox,
  SectionHeader,
  DependencyGraph,
  NotificationToast
} from './SquadExecutorUI.js';
import { TmuxAttachWrapper } from './TmuxAttachWrapper.js';
import { WorktreeCommitFlow } from './WorktreeCommitFlow.js';
import { AgentChangesView } from './AgentChangesView.js';

const exec = promisify(execCallback);

class TaskEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  emitTaskUpdate(taskId: string, update: Partial<TaskStatus>) {
    this.emit('taskUpdate', taskId, update);
  }

  emitTaskOutput(taskId: string, output: string) {
    this.emit('taskOutput', taskId, output);
  }

  emitTaskComplete(taskId: string) {
    this.emit('taskComplete', taskId);
  }
}

interface SquadExecutorProps {
  tasks: Task[];
  agents: AgentConfig[];
  squad: LocalSquad;
  repoContext: RepositoryContext;
  workDir: string;
  claudePath?: string;
  onTaskUpdate?: (taskId: string, status: TaskStatus) => void;
  onComplete?: (results: Map<string, TaskExecutionResult>) => void;
}

export interface TaskStatus {
  taskId: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'launching' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  output: string[];
  error?: string;
  startTime?: number;
  endTime?: number;
  currentActivity?: string;
  paneIndex?: number;
  worktreePath?: string;
  branchName?: string;
  stats?: {
    filesModified?: number;
    linesAdded?: number;
    linesRemoved?: number;
  };
}

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

// Enhanced Agent Card with animations and better layout
const EnhancedAgentCard: React.FC<{
  task: TaskStatus;
  taskDetails: Task;
  agent?: AgentConfig;
  isSelected: boolean;
  index: number;
  allTasks: Map<string, { title: string; status: TaskStatus['status'] }>;
}> = ({ task, taskDetails, agent, isSelected, index, allTasks }) => {
  const borderColor = isSelected ? fuegoColors.accent.cyan : 'gray';
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    setIsHovered(isSelected);
  }, [isSelected]);
  
  return (
    <Box
      borderStyle={isSelected ? 'double' : 'round'}
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      marginBottom={1}
      width="100%"
    >
      {/* Header with status and agent info */}
      <Box marginBottom={1}>
        <AnimatedStatusIcon status={task.status} />
        <Text> </Text>
        <Text bold color={isSelected ? fuegoColors.accent.cyan : 'white'}>
          {index + 1}. {agent?.emoji || '🤖'} {task.agentName}
        </Text>
        <Spacer />
        {task.stats && (
          <MetricsDisplay
            filesModified={task.stats.filesModified}
            linesAdded={task.stats.linesAdded}
            linesRemoved={task.stats.linesRemoved}
            duration={task.endTime && task.startTime ? task.endTime - task.startTime : undefined}
          />
        )}
      </Box>
      
      {/* Task Title */}
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.secondary}>{taskDetails.title}</Text>
      </Box>
      
      {/* Progress Bar */}
      {task.status === 'running' && (
        <Box marginBottom={1}>
          <EnhancedProgressBar 
            value={task.progress} 
            width={40}
            color={isSelected ? 'cyan' : 'green'}
          />
        </Box>
      )}
      
      {/* Current Activity or Error */}
      {task.error ? (
        <Text color="red">⚠ {task.error}</Text>
      ) : task.status === 'completed' ? (
        <Text color="green">
          ✓ Completed - Press Enter to review changes
        </Text>
      ) : task.currentActivity ? (
        <Text color={fuegoColors.text.dimmed} wrap="truncate">
          {task.status === 'running' ? '▸ ' : ''}{task.currentActivity}
        </Text>
      ) : (
        <Text color="gray">Waiting to start...</Text>
      )}
      
      {/* Worktree info */}
      {task.branchName && (
        <Box marginTop={1}>
          <Text color="gray">Branch: </Text>
          <Text color="cyan">{task.branchName}</Text>
        </Box>
      )}
      
      {/* Activity Log (shown when selected) */}
      {isSelected && task.output.length > 0 && (
        <ActivityLog 
          activities={task.output.slice(-3)} 
          maxLines={3}
          highlightKeywords={true}
        />
      )}
      
      {/* Dependencies (shown when selected and pending) */}
      {isSelected && task.status === 'pending' && taskDetails.dependencies.length > 0 && (
        <DependencyGraph
          taskId={task.taskId}
          dependencies={taskDetails.dependencies}
          allTasks={allTasks}
        />
      )}
    </Box>
  );
};

// Enhanced Detail Overlay with glassmorphism
const EnhancedDetailOverlay: React.FC<{
  task: TaskStatus;
  taskDetails: Task;
  agent?: AgentConfig;
  onClose: () => void;
}> = ({ task, taskDetails, agent, onClose }) => {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'h') {
      // Vim: h = left (go back)
      onClose();
    }
  });
  
  return (
    <Box
      position="absolute"
      width="90%"
      height="90%"
      justifyContent="center"
      alignItems="center"
    >
      <GlassBox borderColor={fuegoColors.accent.cyan}>
        <Box flexDirection="column" width={80}>
          {/* Header */}
          <Box marginBottom={2}>
            <Text bold color={fuegoColors.accent.cyan}>
              {agent?.emoji || '🤖'} {task.agentName} - Task Details
            </Text>
            <Spacer />
            <Text color="gray">[ESC to close]</Text>
          </Box>
          
          {/* Task Info Section */}
          <SectionHeader title="Task Information" icon="📋" />
          <Box flexDirection="column" marginBottom={2}>
            <Text><Text color="gray">Title: </Text>{taskDetails.title}</Text>
            <Text><Text color="gray">Complexity: </Text>{taskDetails.estimated_complexity}</Text>
            <Text><Text color="gray">Status: </Text><AnimatedStatusIcon status={task.status} /> {task.status}</Text>
          </Box>
          
          {/* Acceptance Criteria */}
          <SectionHeader title="Acceptance Criteria" icon="✅" />
          <Box flexDirection="column" marginBottom={2}>
            {taskDetails.acceptance_criteria.map((criterion, i) => (
              <Text key={i} color={fuegoColors.text.secondary}>
                • {criterion}
              </Text>
            ))}
          </Box>
          
          {/* Activity Log */}
          <SectionHeader title="Recent Activity" icon="📊" />
          <Box flexDirection="column" height={10} overflowY="hidden">
            <ActivityLog 
              activities={task.output} 
              maxLines={20}
              highlightKeywords={true}
            />
          </Box>
        </Box>
      </GlassBox>
    </Box>
  );
};

// Enhanced Menu Bar with vim keybindings
const EnhancedMenuBar: React.FC<{
  isPaused: boolean;
  selectedIndex: number;
  totalTasks: number;
  hasRunningTasks: boolean;
  mode: 'normal' | 'detail';
}> = ({ isPaused, selectedIndex, totalTasks, hasRunningTasks, mode }) => {
  const menuItems = mode === 'normal' ? [
    { key: 'j/k/↑↓', action: 'Navigate', group: 'nav' },
    { key: 'g/G', action: 'Top/Bottom', group: 'nav' },
    { key: 'l/Enter', action: 'Details', group: 'nav' },
    { key: '1-9', action: 'Jump', group: 'nav' },
    { key: 'a', action: 'Attach Agent', group: 'tmux' },
    { key: 'A', action: 'Attach All', group: 'tmux' },
    { key: isPaused ? 'r' : 'p', action: isPaused ? 'Resume' : 'Pause', group: 'control' },
    { key: 'c', action: 'Complete Squad', group: 'control', condition: hasRunningTasks },
    { key: 'q', action: 'Quit', group: 'control' }
  ] : [
    { key: 'ESC/q/h', action: 'Back', group: 'nav' }
  ];
  
  const groups = {
    nav: { color: 'cyan', label: 'Navigation' },
    tmux: { color: 'magenta', label: 'TMUX' },
    control: { color: 'yellow', label: 'Control' }
  };
  
  return (
    <GlassBox borderColor="gray" blur={false}>
      <Box flexDirection="column" gap={1}>
        <Box flexWrap="wrap" gap={2}>
          {menuItems.filter(item => item.condition !== false).map((item, i) => (
            <Box key={i}>
              <Text bold color={groups[item.group as keyof typeof groups].color as any}>
                [{item.key}]
              </Text>
              <Text> {item.action}</Text>
            </Box>
          ))}
        </Box>
        {mode === 'normal' && (
          <Box>
            <Text dimColor>
              Agent {selectedIndex + 1} of {totalTasks} • 
              {isPaused ? ' PAUSED' : ' RUNNING'} • 
              Vim keys enabled
            </Text>
          </Box>
        )}
      </Box>
    </GlassBox>
  );
};

// Main Enhanced Squad Executor Component
export const SquadExecutorV3: React.FC<SquadExecutorProps> = ({
  tasks,
  agents,
  squad,
  repoContext,
  workDir,
  claudePath,
  onTaskUpdate,
  onComplete
}) => {
  const { exit } = useApp();
  const [taskStatuses, setTaskStatuses] = useState<Map<string, TaskStatus>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionName] = useState(`graphyn-squad-${Date.now()}`);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [agentLauncher] = useState(() => new ClaudeAgentLauncher());
  const [eventEmitter] = useState(() => new TaskEventEmitter());
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>>([]);
  const [attachMode, setAttachMode] = useState<{ 
    active: boolean; 
    type: 'agent' | 'session';
    agentName?: string;
    paneIndex?: number;
  } | null>(null);
  const [showCommitFlow, setShowCommitFlow] = useState(false);
  const [allTasksCompleted, setAllTasksCompleted] = useState(false);
  const [viewingAgentChanges, setViewingAgentChanges] = useState<string | null>(null); // taskId of agent being viewed
  
  // Add notification helper
  const addNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message }]);
  };
  
  // Initialize task statuses
  useEffect(() => {
    const initialStatuses = new Map<string, TaskStatus>();
    tasks.forEach((task) => {
      const agent = agents.find(a => a.name.toLowerCase() === task.assigned_agent.toLowerCase());
      if (agent) {
        initialStatuses.set(task.id, {
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          status: 'pending',
          progress: 0,
          output: [],
          currentActivity: `Ready to ${task.title.toLowerCase()}`
        });
      } else {
        console.warn(`No agent found for task ${task.id}: looking for "${task.assigned_agent}" in`, agents.map(a => a.name));
      }
    });
    setTaskStatuses(initialStatuses);
  }, [tasks, agents]);
  
  // Handle keyboard input with vim keybindings
  useInput((input, key) => {
    if (showDetails) return; // Let overlay handle input
    
    if (key.escape || input === 'q') {
      if (input === 'q') {
        cleanup();
        exit();
      }
    } else if (key.upArrow || input === 'k') {
      // Vim: k = up
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      // Vim: j = down
      setSelectedIndex(Math.min(taskStatuses.size - 1, selectedIndex + 1));
    } else if (input === 'g') {
      // Vim: gg = go to top
      setSelectedIndex(0);
    } else if (input === 'G') {
      // Vim: G = go to bottom
      setSelectedIndex(taskStatuses.size - 1);
    } else if (key.return || input === 'l') {
      // Check if the selected task is completed
      const taskArr = Array.from(taskStatuses.values());
      const selectedTask = taskArr[selectedIndex];
      
      if (selectedTask && selectedTask.status === 'completed') {
        // Show agent changes view for completed tasks
        setViewingAgentChanges(selectedTask.taskId);
      } else {
        // Show details for other tasks
        setShowDetails(true);
      }
    } else if (input === 'p' && !isPaused) {
      pauseAllAgents();
    } else if (input === 'r' && isPaused) {
      resumeAllAgents();
    } else if (input === 'a') {
      attachToSelectedAgent();
    } else if (input === 'A') {
      attachToTmux();
    } else if (input === 'c') {
      handleManualComplete();
    } else if (input >= '1' && input <= '9') {
      const index = parseInt(input) - 1;
      if (index < taskStatuses.size) {
        setSelectedIndex(index);
      }
    }
  });
  
  const pauseAllAgents = async () => {
    setIsPaused(true);
    addNotification('info', 'Pausing all agents...');
    
    for (const [taskId, status] of taskStatuses) {
      if (status.status === 'running') {
        try {
          await exec(`tmux send-keys -t ${sessionName}:0.${status.paneIndex || 0} C-z`);
          setTaskStatuses(prev => {
            const newMap = new Map(prev);
            const task = newMap.get(taskId);
            if (task) {
              task.status = 'paused';
              task.currentActivity = 'Paused by user';
            }
            return newMap;
          });
        } catch (error) {
          console.error(`Failed to pause agent ${status.agentName}:`, error);
        }
      }
    }
  };
  
  const resumeAllAgents = async () => {
    setIsPaused(false);
    addNotification('info', 'Resuming all agents...');
    
    for (const [taskId, status] of taskStatuses) {
      if (status.status === 'paused') {
        try {
          await exec(`tmux send-keys -t ${sessionName}:0.${status.paneIndex || 0} 'fg' Enter`);
          setTaskStatuses(prev => {
            const newMap = new Map(prev);
            const task = newMap.get(taskId);
            if (task) {
              task.status = 'running';
              task.currentActivity = 'Resumed work';
            }
            return newMap;
          });
        } catch (error) {
          console.error(`Failed to resume agent ${status.agentName}:`, error);
        }
      }
    }
  };
  
  const attachToTmux = () => {
    setAttachMode({
      active: true,
      type: 'session'
    });
  };
  
  const attachToSelectedAgent = () => {
    const taskArr = Array.from(taskStatuses.values());
    const selectedTask = taskArr[selectedIndex];
    if (selectedTask && selectedTask.paneIndex !== undefined) {
      setAttachMode({
        active: true,
        type: 'agent',
        agentName: selectedTask.agentName,
        paneIndex: selectedTask.paneIndex
      });
    }
  };
  
  // Handle attachment in separate effect
  useEffect(() => {
    if (!attachMode?.active) return;
    
    let child: ReturnType<typeof spawn> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const doAttach = async () => {
      try {
        // Stop monitoring while attached
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          setMonitoringInterval(null);
        }
        
        // Clear screen
        process.stdout.write('\x1bc\x1b[3J\x1b[H');
        
        // Show attachment message
        console.log('\n' + '='.repeat(60));
        if (attachMode.type === 'agent') {
          console.log(`🎯 Attaching to ${attachMode.agentName}...`);
        } else {
          console.log('🎯 Attaching to squad session...');
        }
        console.log('='.repeat(60));
        console.log('\nTMUX Controls:');
        console.log('  • Alt+Q or Ctrl+B then D - Detach from session');
        console.log('  • Ctrl+B then [ - Enter scroll mode');
        console.log('  • Ctrl+B then arrows - Navigate panes');
        console.log('  • Ctrl+B then z - Toggle pane zoom');
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Wait a bit for user to read
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Build command
        let command: string;
        if (attachMode.type === 'agent' && attachMode.paneIndex !== undefined) {
          // Select and zoom specific pane
          await exec(`tmux select-pane -t ${sessionName}:0.${attachMode.paneIndex}`);
          await exec(`tmux resize-pane -t ${sessionName}:0.${attachMode.paneIndex} -Z`);
          command = `tmux attach-session -t ${sessionName}`;
        } else {
          // Attach to full session
          command = `tmux attach-session -t ${sessionName}`;
        }
        
        // Spawn tmux attach
        child = spawn('sh', ['-c', command], {
          stdio: 'inherit',
          env: { ...process.env, TERM: 'xterm-256color' }
        });
        
        child.on('exit', (code) => {
          // Clear screen after detach
          process.stdout.write('\x1bc\x1b[3J\x1b[H');
          console.log('\n✅ Detached from TMUX session\n');
          
          // Reset attach mode
          setAttachMode(null);
          
          // Restart monitoring
          timeoutId = setTimeout(() => {
            startMonitoring();
          }, 500);
        });
        
      } catch (error) {
        console.error('Failed to attach:', error);
        setAttachMode(null);
        startMonitoring();
      }
    };
    
    doAttach();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (child && !child.killed) {
        child.kill();
      }
    };
  }, [attachMode, sessionName, monitoringInterval]);
  
  // Setup event listeners
  useEffect(() => {
    const handleTaskUpdate = (taskId: string, update: Partial<TaskStatus>) => {
      setTaskStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(taskId);
        if (status) {
          Object.assign(status, update);
          
          // Add notifications for important status changes
          if (update.status === 'completed') {
            addNotification('success', `${status.agentName} completed task`);
          } else if (update.status === 'failed') {
            addNotification('error', `${status.agentName} failed: ${update.error || 'Unknown error'}`);
          }
        }
        return newMap;
      });
      onTaskUpdate?.(taskId, update as TaskStatus);
    };

    const handleTaskOutput = (taskId: string, output: string) => {
      setTaskStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(taskId);
        if (status) {
          status.output = [...status.output.slice(-50), output];
        }
        return newMap;
      });
    };

    eventEmitter.on('taskUpdate', handleTaskUpdate);
    eventEmitter.on('taskOutput', handleTaskOutput);

    return () => {
      eventEmitter.off('taskUpdate', handleTaskUpdate);
      eventEmitter.off('taskOutput', handleTaskOutput);
    };
  }, [eventEmitter, onTaskUpdate]);

  // Initialize TMUX session and launch agents
  useEffect(() => {
    const init = async () => {
      try {
        await checkDependencies();
        await launchSquadExecution();
        setIsInitializing(false);
      } catch (error) {
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        setIsInitializing(false);
      }
    };

    init();

    return () => {
      cleanup();
    };
  }, []);

  const checkDependencies = async () => {
    try {
      await exec('which tmux');
    } catch {
      throw new Error('TMUX is not installed. Please install TMUX to use Squad Executor.');
    }

    const claudeCmd = claudePath || 'claude';
    try {
      const result = await exec(`which ${claudeCmd}`);
      console.log(`Claude CLI found at: ${result.stdout.trim()}`);
      
      // Also try to check Claude version
      try {
        const versionResult = await exec(`${claudeCmd} --version`);
        console.log(`Claude version: ${versionResult.stdout.trim()}`);
      } catch (e) {
        console.warn(`Could not get Claude version: ${e}`);
      }
    } catch {
      // Try some common installation paths
      const commonPaths = [
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        `${process.env.HOME}/.local/bin/claude`,
        `${process.env.HOME}/.claude/bin/claude`,
        `${process.env.HOME}/.claude/local/claude`
      ];
      
      console.error(`Claude CLI not found in PATH. Checking common locations...`);
      for (const path of commonPaths) {
        try {
          await exec(`test -f ${path}`);
          console.log(`Found Claude at: ${path}`);
          throw new Error(`Claude CLI found at '${path}' but not in PATH. Please add it to PATH or specify claudePath="${path}"`);
        } catch {
          // Continue checking
        }
      }
      
      throw new Error(`Claude CLI not found. Please install Claude Code CLI from https://github.com/anthropics/claude-code`);
    }
  };

  const launchSquadExecution = async () => {
    try {
      await exec(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
      await exec(`tmux new-session -d -s ${sessionName} -n "Squad Dashboard"`);
      await exec(createTmuxConfig(sessionName));
      await createTmuxLayout(tasks.length);
      
      let paneIndex = 0;
      for (const task of tasks) {
        const agent = agents.find(a => a.name.toLowerCase() === task.assigned_agent.toLowerCase());
        if (agent) {
          await launchClaudeForTask(task, agent, paneIndex);
          paneIndex++;
        }
      }
      
      startMonitoring();
    } catch (error) {
      throw new Error(`Failed to launch squad: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createTmuxLayout = async (taskCount: number) => {
    if (taskCount > 1) {
      const cols = Math.ceil(Math.sqrt(taskCount));
      
      for (let i = 1; i < taskCount; i++) {
        if (i < cols) {
          await exec(`tmux split-window -h -t ${sessionName}:0`);
        } else {
          const targetPane = i % cols;
          await exec(`tmux split-window -v -t ${sessionName}:0.${targetPane}`);
        }
      }
    }
    
    await exec(`tmux select-layout -t ${sessionName}:0 tiled`);
  };

  const launchClaudeForTask = async (task: Task, agent: AgentConfig, paneIndex: number) => {
    setTaskStatuses(prev => {
      const newMap = new Map(prev);
      const status = newMap.get(task.id);
      if (status) {
        status.status = 'launching';
        status.currentActivity = 'Setting up Claude environment...';
        status.paneIndex = paneIndex;
      }
      return newMap;
    });

    try {
      console.log(`Launching agent ${agent.name} for task ${task.id} in pane ${paneIndex}`);
      const command = await agentLauncher.launchAgentInTmuxPane(
        {
          agent,
          task,
          workDir,
          repoContext,
          squadName: squad.name,
          allTasks: tasks,
          claudePath,
          squadId: squad.id
        },
        sessionName,
        paneIndex
      );
      console.log(`Command for ${agent.name}: ${command}`);

      await exec(`tmux select-pane -t ${sessionName}:0.${paneIndex} -T "${agent.emoji || '🤖'} ${agent.name}"`);
      
      // Execute the command directly without additional wrapping since we have a wrapper script
      await exec(`tmux send-keys -t ${sessionName}:0.${paneIndex} "${command}" Enter`);
      
      const worktreeInfo = agentLauncher.getWorktreeInfo(task.id);
      
      setTaskStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(task.id);
        if (status) {
          status.status = 'running';
          status.startTime = Date.now();
          status.currentActivity = 'Claude is analyzing the task...';
          status.progress = 10;
          if (worktreeInfo) {
            status.worktreePath = worktreeInfo.path;
            status.branchName = worktreeInfo.branch;
          }
        }
        return newMap;
      });
    } catch (error) {
      setTaskStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(task.id);
        if (status) {
          status.status = 'failed';
          status.error = error instanceof Error ? error.message : 'Unknown error';
        }
        return newMap;
      });
    }
  };

  const startMonitoring = () => {
    if (monitoringInterval) clearInterval(monitoringInterval);

    const interval = setInterval(async () => {
      for (const [taskId, status] of taskStatuses) {
        if (status.status === 'running' && status.paneIndex !== undefined) {
          try {
            const output = await exec(`tmux capture-pane -t ${sessionName}:0.${status.paneIndex} -p`);
            const lines = output.stdout.split('\n').filter(l => l.trim());
            
            const lastLine = lines[lines.length - 1] || '';
            if (lastLine && !lastLine.includes('===')) {
              eventEmitter.emitTaskUpdate(taskId, {
                currentActivity: lastLine.substring(0, 80) + (lastLine.length > 80 ? '...' : '')
              });
            }
            
            // Update progress based on activity
            const progress = status.progress || 10;
            if (lastLine.toLowerCase().includes('analyzing')) {
              eventEmitter.emitTaskUpdate(taskId, { progress: Math.min(30, progress + 5) });
            } else if (lastLine.toLowerCase().includes('implementing')) {
              eventEmitter.emitTaskUpdate(taskId, { progress: Math.min(70, progress + 10) });
            } else if (lastLine.toLowerCase().includes('testing')) {
              eventEmitter.emitTaskUpdate(taskId, { progress: Math.min(90, progress + 5) });
            }
            
            // Check if Claude process is still active
            try {
              const paneInfo = await exec(`tmux list-panes -t ${sessionName}:0 -F "#{pane_index}:#{pane_pid}:#{pane_dead}" | grep "^${status.paneIndex}:"`);
              const [, pid, dead] = paneInfo.stdout.trim().split(':');
              
              if (dead === '1') {
                // Pane is dead, but let's check if it completed successfully
                const captureResult = await exec(`tmux capture-pane -t ${sessionName}:0.${status.paneIndex} -p`);
                const paneOutput = captureResult.stdout;
                
                // Check for completion markers
                const hasCompletedMarker = paneOutput.includes('✅ Task completed successfully') || 
                                         paneOutput.includes('Task completed successfully') ||
                                         paneOutput.includes('Press Enter to close this pane');
                
                const hasErrorMarker = paneOutput.includes('❌ Claude exited with code') ||
                                     paneOutput.includes('error') ||
                                     paneOutput.includes('Error') ||
                                     paneOutput.includes('failed');
                
                // Only mark as completed if we have a clear completion marker
                // and the task has been running for at least 10 seconds
                const runningTime = Date.now() - (status.startTime || Date.now());
                
                if (hasCompletedMarker && runningTime > 10000) {
                  eventEmitter.emitTaskUpdate(taskId, {
                    status: 'completed',
                    endTime: Date.now(),
                    progress: 100,
                    currentActivity: 'Task completed successfully'
                  });
                } else if (hasErrorMarker) {
                  eventEmitter.emitTaskUpdate(taskId, {
                    status: 'failed',
                    endTime: Date.now(),
                    error: 'Claude encountered an error',
                    currentActivity: 'Task failed'
                  });
                } else if (runningTime < 5000) {
                  // Task ended too quickly, probably Claude didn't start properly
                  eventEmitter.emitTaskUpdate(taskId, {
                    status: 'failed',
                    endTime: Date.now(),
                    error: 'Claude exited immediately - check if Claude CLI is installed',
                    currentActivity: 'Failed to start'
                  });
                }
                // Otherwise, don't mark as complete yet - might be a temporary issue
              }
            } catch (error) {
              // Error checking process
            }
            
            // Parse file stats
            const filesMatch = output.stdout.match(/Modified:\s*(\d+)\s*files?/);
            const addedMatch = output.stdout.match(/Added:\s*(\d+)\s*lines?/);
            const removedMatch = output.stdout.match(/Removed:\s*(\d+)\s*lines?/);
            
            if (filesMatch || addedMatch || removedMatch) {
              eventEmitter.emitTaskUpdate(taskId, {
                stats: {
                  filesModified: filesMatch ? parseInt(filesMatch[1]) : status.stats?.filesModified,
                  linesAdded: addedMatch ? parseInt(addedMatch[1]) : status.stats?.linesAdded,
                  linesRemoved: removedMatch ? parseInt(removedMatch[1]) : status.stats?.linesRemoved
                }
              });
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('no pane')) {
              // Pane doesn't exist anymore - don't automatically mark as complete
              // The dead pane check above will handle this properly
              console.log(`Pane for task ${taskId} no longer exists`);
            }
          }
        }
      }

      const allComplete = Array.from(taskStatuses.values()).every(
        s => s.status === 'completed' || s.status === 'failed'
      );

      if (allComplete && !allTasksCompleted) {
        clearInterval(interval);
        setMonitoringInterval(null);
        setAllTasksCompleted(true);
        // Don't automatically show commit flow - let user review each agent's changes
        addNotification('success', 'All tasks completed! Click on each agent to review their changes.');
      }
    }, 2000);

    setMonitoringInterval(interval);
  };

  const handleAllTasksComplete = () => {
    const results = new Map<string, TaskExecutionResult>();
    
    for (const [taskId, status] of taskStatuses) {
      results.set(taskId, {
        taskId,
        success: status.status === 'completed',
        error: status.error,
        duration: status.startTime && status.endTime 
          ? status.endTime - status.startTime 
          : undefined
      });
    }

    onComplete?.(results);
  };
  
  const handleManualComplete = () => {
    setTaskStatuses(prev => {
      const newMap = new Map(prev);
      newMap.forEach((status) => {
        if (status.status === 'running') {
          status.status = 'completed';
          status.endTime = Date.now();
          status.currentActivity = 'Manually completed by user';
        }
      });
      return newMap;
    });
    
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
    }
    
    handleAllTasksComplete();
  };

  const cleanup = async () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
    
    try {
      await exec(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
      agentLauncher.cleanup();
    } catch {
      // Ignore cleanup errors
    }
  };
  
  // Render
  const taskArray = Array.from(taskStatuses.values());
  const selectedTask = taskArray[selectedIndex];
  const selectedTaskDetails = tasks.find(t => t.id === selectedTask?.taskId);
  const selectedAgent = agents.find(a => a.id === selectedTask?.agentId);
  
  const completedCount = taskArray.filter(t => t.status === 'completed').length;
  const runningCount = taskArray.filter(t => t.status === 'running').length;
  const failedCount = taskArray.filter(t => t.status === 'failed').length;
  
  // Create task map for dependency visualization
  const taskMap = new Map<string, { title: string; status: TaskStatus['status'] }>();
  taskArray.forEach(status => {
    const task = tasks.find(t => t.id === status.taskId);
    if (task) {
      taskMap.set(status.taskId, { title: task.title, status: status.status });
    }
  });
  
  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={2}>
        <Box>
          <Text color={fuegoColors.accent.cyan}>
            <LoadingDots text="Initializing Squad Executor" />
          </Text>
        </Box>
      </Box>
    );
  }
  
  if (initError) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={colors.error}>❌ {initError}</Text>
        <Box marginTop={1}>
          <Text color="gray">Press q to exit</Text>
        </Box>
      </Box>
    );
  }
  
  // If in attach mode, render nothing (terminal is taken over by tmux)
  if (attachMode?.active) {
    return null;
  }
  
  // Show agent changes view when viewing a specific completed task
  if (viewingAgentChanges) {
    const taskStatus = taskStatuses.get(viewingAgentChanges);
    const task = tasks.find(t => t.id === viewingAgentChanges);
    const agent = agents.find(a => a.id === taskStatus?.agentId);
    
    if (taskStatus && task && agent) {
      return (
        <AgentChangesView
          taskStatus={taskStatus}
          task={task}
          agent={agent}
          workDir={workDir}
          onAccept={() => {
            // Mark as accepted and merge changes
            addNotification('success', `Accepted changes from ${agent.name}`);
            setViewingAgentChanges(null);
            
            // TODO: Implement actual merge to main branch
            // For now, just update the status
            setTaskStatuses(prev => {
              const newMap = new Map(prev);
              const status = newMap.get(viewingAgentChanges);
              if (status) {
                status.currentActivity = 'Changes accepted';
              }
              return newMap;
            });
          }}
          onReject={() => {
            // Reset task to pending and re-run agent
            addNotification('warning', `Rejected changes from ${agent.name}. Agent will redo the task.`);
            setViewingAgentChanges(null);
            
            // Reset task status and re-launch agent
            setTaskStatuses(prev => {
              const newMap = new Map(prev);
              const status = newMap.get(viewingAgentChanges);
              if (status) {
                status.status = 'pending';
                status.progress = 0;
                status.currentActivity = 'Waiting to restart...';
                status.error = undefined;
                status.endTime = undefined;
              }
              return newMap;
            });
            
            // Re-launch the agent for this task
            setTimeout(async () => {
              const paneIndex = taskStatus.paneIndex;
              if (paneIndex !== undefined) {
                await launchClaudeForTask(task, agent, paneIndex);
              }
            }, 1000);
          }}
          onBack={() => {
            setViewingAgentChanges(null);
          }}
        />
      );
    }
  }
  
  // Show commit flow when all tasks are completed
  if (showCommitFlow) {
    return (
      <WorktreeCommitFlow
        taskStatuses={taskStatuses}
        onComplete={() => {
          handleAllTasksComplete();
        }}
        onCommit={(taskId, message) => {
          addNotification('success', `Committed changes for ${taskId}`);
        }}
      />
    );
  }
  
  return (
    <Box flexDirection="column">
      {/* Notifications */}
      <Box flexDirection="column" marginBottom={1}>
        {notifications.map(notif => (
          <NotificationToast
            key={notif.id}
            type={notif.type}
            message={notif.message}
            onDismiss={() => {
              setNotifications(prev => prev.filter(n => n.id !== notif.id));
            }}
          />
        ))}
      </Box>
      
      {/* Header */}
      <GlassBox borderColor={fuegoColors.accent.cyan} blur={false}>
        <Box>
          <Text bold color={fuegoColors.accent.cyan}>
            🎯 {squad.name}
          </Text>
          <Spacer />
          <Box gap={2}>
            <Box>
              <Text color="green">✓ </Text>
              <Text bold color="green">{completedCount}</Text>
            </Box>
            <Box>
              <Text color="yellow">⚡ </Text>
              <Text bold color="yellow">{runningCount}</Text>
            </Box>
            <Box>
              <Text color="red">✗ </Text>
              <Text bold color="red">{failedCount}</Text>
            </Box>
            <Text color="gray">/ {tasks.length} tasks</Text>
          </Box>
        </Box>
      </GlassBox>
      
      {/* Agent Cards Container */}
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        {taskArray.map((task, index) => {
          const agent = agents.find(a => a.id === task.agentId);
          const taskDetails = tasks.find(t => t.id === task.taskId);
          
          return taskDetails ? (
            <EnhancedAgentCard
              key={task.taskId}
              task={task}
              taskDetails={taskDetails}
              agent={agent}
              isSelected={index === selectedIndex}
              index={index}
              allTasks={taskMap}
            />
          ) : null;
        })}
      </Box>
      
      {/* Menu Bar */}
      <Box marginTop={1}>
        <EnhancedMenuBar
          isPaused={isPaused}
          selectedIndex={selectedIndex}
          totalTasks={taskStatuses.size}
          hasRunningTasks={runningCount > 0}
          mode={showDetails ? 'detail' : 'normal'}
        />
      </Box>
      
      {/* Detail Overlay */}
      {showDetails && selectedTask && selectedTaskDetails && (
        <EnhancedDetailOverlay
          task={selectedTask}
          taskDetails={selectedTaskDetails}
          agent={selectedAgent}
          onClose={() => setShowDetails(false)}
        />
      )}
    </Box>
  );
};