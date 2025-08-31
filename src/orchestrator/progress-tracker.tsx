/**
 * Progress Tracker
 * Tracks and visualizes progress across all agents with real-time updates
 */
import { EventEmitter } from 'events';
import React from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Task } from './multi-agent-orchestrator.js';
import { debug } from '../utils/debug.js';

export interface ProgressState {
  taskId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  currentStage: string;
  startTime: number;
  estimatedEndTime?: number;
  agentProgress: Map<string, AgentProgress>;
}

export interface AgentProgress {
  agent: string;
  sessionId?: string;
  currentTask?: Task;
  tasksCompleted: number;
  tasksTotal: number;
  status: 'idle' | 'working' | 'waiting' | 'error';
  lastUpdate: number;
  output?: string[];
}

export interface TaskProgress {
  task: Task;
  progress: number; // 0-100
  status: string;
  startTime?: number;
  estimatedDuration?: number;
  agentOutput?: string[];
}

export class ProgressTracker extends EventEmitter {
  private progressStates = new Map<string, ProgressState>();
  private taskProgresses = new Map<string, Map<string, TaskProgress>>();
  private renderInstances = new Map<string, any>();
  private isVisualizationEnabled = true;

  constructor() {
    super();
  }

  /**
   * Initialize progress tracking for a new orchestration task
   */
  initializeTask(taskId: string, tasks: Task[]): void {
    debug('Initializing progress tracking:', taskId, tasks.length, 'tasks');

    const agentProgress = new Map<string, AgentProgress>();
    const uniqueAgents = [...new Set(tasks.map(t => t.agent))];

    // Initialize progress for each agent
    uniqueAgents.forEach(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent);
      agentProgress.set(agent, {
        agent,
        tasksCompleted: 0,
        tasksTotal: agentTasks.length,
        status: 'idle',
        lastUpdate: Date.now(),
        output: []
      });
    });

    const progressState: ProgressState = {
      taskId,
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: tasks.length,
      currentStage: 'initializing',
      startTime: Date.now(),
      agentProgress
    };

    this.progressStates.set(taskId, progressState);

    // Initialize task progress
    const taskProgressMap = new Map<string, TaskProgress>();
    tasks.forEach(task => {
      taskProgressMap.set(task.id, {
        task,
        progress: 0,
        status: 'pending',
        agentOutput: []
      });
    });
    this.taskProgresses.set(taskId, taskProgressMap);

    // Start visualization if enabled
    if (this.isVisualizationEnabled) {
      this.startVisualization(taskId);
    }

    this.emit('progress_initialized', { taskId, progressState });
  }

  /**
   * Mark a task as started
   */
  markTaskStarted(taskId: string, task: Task): void {
    const progressState = this.progressStates.get(taskId);
    const taskProgressMap = this.taskProgresses.get(taskId);
    
    if (!progressState || !taskProgressMap) return;

    debug('Task started:', taskId, task.id);

    // Update overall progress
    progressState.inProgressTasks++;
    progressState.pendingTasks--;
    progressState.currentStage = `Executing ${task.agent} tasks`;

    // Update agent progress
    const agentProgress = progressState.agentProgress.get(task.agent);
    if (agentProgress) {
      agentProgress.currentTask = task;
      agentProgress.status = 'working';
      agentProgress.lastUpdate = Date.now();
    }

    // Update task progress
    const taskProgress = taskProgressMap.get(task.id);
    if (taskProgress) {
      taskProgress.status = 'in_progress';
      taskProgress.startTime = Date.now();
      taskProgress.progress = 10; // Initial progress
    }

    this.emit('progress_updated', { taskId, progressState, task, event: 'task_started' });
  }

  /**
   * Mark a task as completed
   */
  markTaskComplete(taskId: string, taskTaskId: string): void {
    const progressState = this.progressStates.get(taskId);
    const taskProgressMap = this.taskProgresses.get(taskId);
    
    if (!progressState || !taskProgressMap) return;

    const taskProgress = taskProgressMap.get(taskTaskId);
    if (!taskProgress) return;

    debug('Task completed:', taskId, taskTaskId);

    // Update overall progress
    progressState.completedTasks++;
    progressState.inProgressTasks--;

    // Update agent progress
    const agentProgress = progressState.agentProgress.get(taskProgress.task.agent);
    if (agentProgress) {
      agentProgress.tasksCompleted++;
      agentProgress.status = agentProgress.tasksCompleted >= agentProgress.tasksTotal ? 'idle' : 'waiting';
      agentProgress.currentTask = undefined;
      agentProgress.lastUpdate = Date.now();
    }

    // Update task progress
    taskProgress.status = 'completed';
    taskProgress.progress = 100;

    // Update current stage
    if (progressState.completedTasks === progressState.totalTasks) {
      progressState.currentStage = 'completed';
      progressState.estimatedEndTime = Date.now();
    } else {
      const completionRate = progressState.completedTasks / progressState.totalTasks;
      progressState.currentStage = `${Math.round(completionRate * 100)}% completed`;
    }

    this.emit('progress_updated', { taskId, progressState, task: taskProgress.task, event: 'task_completed' });
  }

  /**
   * Mark a task as failed
   */
  markTaskFailed(taskId: string, taskTaskId: string, error: string): void {
    const progressState = this.progressStates.get(taskId);
    const taskProgressMap = this.taskProgresses.get(taskId);
    
    if (!progressState || !taskProgressMap) return;

    const taskProgress = taskProgressMap.get(taskTaskId);
    if (!taskProgress) return;

    debug('Task failed:', taskId, taskTaskId, error);

    // Update overall progress
    progressState.failedTasks++;
    progressState.inProgressTasks--;

    // Update agent progress
    const agentProgress = progressState.agentProgress.get(taskProgress.task.agent);
    if (agentProgress) {
      agentProgress.status = 'error';
      agentProgress.currentTask = undefined;
      agentProgress.lastUpdate = Date.now();
      agentProgress.output?.push(`ERROR: ${error}`);
    }

    // Update task progress
    taskProgress.status = 'failed';
    taskProgress.progress = 0; // Reset progress on failure

    progressState.currentStage = `${progressState.failedTasks} task(s) failed`;

    this.emit('progress_updated', { taskId, progressState, task: taskProgress.task, event: 'task_failed', error });
  }

  /**
   * Update task progress percentage
   */
  updateTaskProgress(taskId: string, taskTaskId: string, progress: number, status?: string): void {
    const taskProgressMap = this.taskProgresses.get(taskId);
    if (!taskProgressMap) return;

    const taskProgress = taskProgressMap.get(taskTaskId);
    if (!taskProgress) return;

    taskProgress.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      taskProgress.status = status;
    }

    this.emit('task_progress_updated', { taskId, taskTaskId, progress, status });
  }

  /**
   * Add agent output
   */
  addAgentOutput(taskId: string, agent: string, output: string): void {
    const progressState = this.progressStates.get(taskId);
    if (!progressState) return;

    const agentProgress = progressState.agentProgress.get(agent);
    if (agentProgress) {
      agentProgress.output = agentProgress.output || [];
      agentProgress.output.push(`[${new Date().toLocaleTimeString()}] ${output}`);
      
      // Keep only last 50 lines
      if (agentProgress.output.length > 50) {
        agentProgress.output = agentProgress.output.slice(-50);
      }
      
      agentProgress.lastUpdate = Date.now();
    }

    this.emit('agent_output_updated', { taskId, agent, output });
  }

  /**
   * Get current progress state
   */
  getProgress(taskId: string): ProgressState | null {
    return this.progressStates.get(taskId) || null;
  }

  /**
   * Get detailed task progress
   */
  getTaskProgress(taskId: string): Map<string, TaskProgress> | null {
    return this.taskProgresses.get(taskId) || null;
  }

  /**
   * Enable/disable visualization
   */
  setVisualizationEnabled(enabled: boolean): void {
    this.isVisualizationEnabled = enabled;
    
    if (!enabled) {
      // Clean up existing visualizations
      for (const [taskId, renderInstance] of this.renderInstances) {
        if (renderInstance && renderInstance.unmount) {
          renderInstance.unmount();
        }
      }
      this.renderInstances.clear();
    }
  }

  /**
   * Start real-time visualization for a task
   */
  private startVisualization(taskId: string): void {
    if (!this.isVisualizationEnabled) return;

    try {
      const ProgressComponent = this.createProgressComponent(taskId);
      const renderInstance = render(<ProgressComponent />);
      this.renderInstances.set(taskId, renderInstance);

      // Auto-cleanup when task is done
      this.once(`task_${taskId}_completed`, () => {
        setTimeout(() => {
          if (renderInstance && renderInstance.unmount) {
            renderInstance.unmount();
          }
          this.renderInstances.delete(taskId);
        }, 5000); // Keep visualization for 5 seconds after completion
      });

    } catch (error) {
      debug('Error starting visualization:', error);
      // Disable visualization on error
      this.isVisualizationEnabled = false;
    }
  }

  /**
   * Create a React component for progress visualization
   */
  private createProgressComponent(taskId: string) {
    const progressTracker = this;
    
    return function ProgressDisplay() {
      const [progressState, setProgressState] = React.useState<ProgressState | null>(null);
      const [taskProgresses, setTaskProgresses] = React.useState<Map<string, TaskProgress> | null>(null);
      const [showDetails, setShowDetails] = React.useState(false);
      const { exit } = useApp();

      // Handle keyboard input
      useInput((input, key) => {
        if (input === 'd' || input === 'D') {
          setShowDetails(!showDetails);
        }
        if (input === 'q' || input === 'Q' || key.escape) {
          exit();
        }
      });

      // Update state when progress changes
      React.useEffect(() => {
        const updateHandler = (data: any) => {
          if (data.taskId === taskId) {
            setProgressState(progressTracker.getProgress(taskId));
            setTaskProgresses(progressTracker.getTaskProgress(taskId));
          }
        };

        progressTracker.on('progress_updated', updateHandler);
        progressTracker.on('task_progress_updated', updateHandler);
        progressTracker.on('agent_output_updated', updateHandler);

        // Initial load
        setProgressState(progressTracker.getProgress(taskId));
        setTaskProgresses(progressTracker.getTaskProgress(taskId));

        return () => {
          progressTracker.removeListener('progress_updated', updateHandler);
          progressTracker.removeListener('task_progress_updated', updateHandler);
          progressTracker.removeListener('agent_output_updated', updateHandler);
        };
      }, [taskId]);

      if (!progressState) {
        return (
          <Box flexDirection="column">
            <Text>Loading progress...</Text>
          </Box>
        );
      }

      const elapsedTime = Date.now() - progressState.startTime;
      const elapsedSeconds = Math.floor(elapsedTime / 1000);
      const completionRate = progressState.completedTasks / progressState.totalTasks;
      const estimatedTotal = completionRate > 0 ? elapsedTime / completionRate : 0;
      const estimatedRemaining = Math.max(0, estimatedTotal - elapsedTime);

      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="blue">🤖 Multi-Agent Orchestrator - Task: {taskId}</Text>
          <Text></Text>
          
          {/* Overall Progress */}
          <Box flexDirection="row">
            <Text bold>Overall Progress: </Text>
            <Text color="green">{progressState.completedTasks}</Text>
            <Text>/</Text>
            <Text>{progressState.totalTasks}</Text>
            <Text> tasks ({Math.round(completionRate * 100)}%)</Text>
          </Box>
          
          <Box flexDirection="row">
            <Text bold>Status: </Text>
            <Text color="blue">{progressState.currentStage}</Text>
          </Box>

          <Box flexDirection="row">
            <Text bold>Time: </Text>
            <Text>{Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</Text>
            {estimatedRemaining > 0 && (
              <>
                <Text> (Est. remaining: {Math.floor(estimatedRemaining / 60000)}m)</Text>
              </>
            )}
          </Box>

          <Text></Text>

          {/* Agent Progress */}
          <Text bold>Agent Status:</Text>
          {Array.from(progressState.agentProgress.entries()).map(([agent, progress]) => (
            <Box key={agent} flexDirection="row" marginLeft={2}>
              <Box width={15}>
                <Text color={progress.status === 'working' ? 'green' : progress.status === 'error' ? 'red' : 'gray'}>
                  {progress.status === 'working' && <Spinner type="dots" />}
                  {progress.status === 'error' && '❌'}
                  {progress.status === 'idle' && '💤'}
                  {progress.status === 'waiting' && '⏳'}
                  {` ${agent}`}
                </Text>
              </Box>
              <Text>
                {progress.tasksCompleted}/{progress.tasksTotal} tasks
                {progress.currentTask && ` - ${progress.currentTask.description.substring(0, 40)}...`}
              </Text>
            </Box>
          ))}

          {/* Task Details */}
          {showDetails && taskProgresses && (
            <>
              <Text></Text>
              <Text bold>Task Details:</Text>
              {Array.from(taskProgresses.entries()).map(([taskTaskId, taskProgress]) => (
                <Box key={taskTaskId} flexDirection="column" marginLeft={2} marginBottom={1}>
                  <Box flexDirection="row">
                    <Text color={
                      taskProgress.status === 'completed' ? 'green' : 
                      taskProgress.status === 'failed' ? 'red' : 
                      taskProgress.status === 'in_progress' ? 'blue' : 'gray'
                    }>
                      {taskProgress.status === 'completed' && '✅'}
                      {taskProgress.status === 'failed' && '❌'}
                      {taskProgress.status === 'in_progress' && '🔄'}
                      {taskProgress.status === 'pending' && '⏸️'}
                      {` [${taskProgress.task.agent}] ${taskProgress.task.description.substring(0, 60)}...`}
                    </Text>
                  </Box>
                  {taskProgress.progress > 0 && (
                    <Box marginLeft={2}>
                      <Text color="gray">Progress: {taskProgress.progress}%</Text>
                    </Box>
                  )}
                </Box>
              ))}
            </>
          )}

          <Text></Text>
          <Text color="gray">Press 'D' for details, 'Q' to quit</Text>
        </Box>
      );
    };
  }

  /**
   * Clean up progress tracking for a task
   */
  cleanup(taskId: string): void {
    debug('Cleaning up progress tracking:', taskId);
    
    this.progressStates.delete(taskId);
    this.taskProgresses.delete(taskId);
    
    const renderInstance = this.renderInstances.get(taskId);
    if (renderInstance && renderInstance.unmount) {
      renderInstance.unmount();
    }
    this.renderInstances.delete(taskId);

    this.emit(`task_${taskId}_completed`);
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    activeTasks: number;
    totalTasksTracked: number;
    averageCompletionTime: number;
  } {
    const activeTasks = this.progressStates.size;
    
    let totalTasksTracked = 0;
    let completedTasks = 0;
    let totalCompletionTime = 0;

    for (const [taskId, progress] of this.progressStates) {
      totalTasksTracked += progress.totalTasks;
      completedTasks += progress.completedTasks;
      
      if (progress.estimatedEndTime) {
        totalCompletionTime += (progress.estimatedEndTime - progress.startTime);
      }
    }

    const averageCompletionTime = completedTasks > 0 ? totalCompletionTime / completedTasks : 0;

    return {
      activeTasks,
      totalTasksTracked,
      averageCompletionTime
    };
  }
}