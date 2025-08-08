import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import type { Task } from '../../services/claude-task-generator.js';
import type { AgentConfig } from '../../types/agent.js';

const exec = promisify(execCallback);

interface CockpitMonitorProps {
  tasks: Task[];
  agents: AgentConfig[];
  sessionName: string;
}

interface TaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent: string;
  startTime?: Date;
  endTime?: Date;
}

const CockpitMonitor: React.FC<CockpitMonitorProps> = ({ tasks, agents, sessionName }) => {
  const { exit } = useApp();
  const [taskStatuses, setTaskStatuses] = useState<Map<string, TaskStatus>>(new Map());
  const [selectedPane, setSelectedPane] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Initialize task statuses
  useEffect(() => {
    const initialStatuses = new Map<string, TaskStatus>();
    tasks.forEach((task, index) => {
      const agent = agents.find(a => 
        a.name.toLowerCase() === task.assigned_agent.toLowerCase()
      );
      initialStatuses.set(task.id, {
        taskId: task.id,
        status: 'running',
        agent: agent?.name || task.assigned_agent,
        startTime: new Date()
      });
    });
    setTaskStatuses(initialStatuses);
  }, [tasks, agents]);

  // Poll for pane statuses
  useEffect(() => {
    const checkStatuses = async () => {
      const newStatuses = new Map(taskStatuses);
      let hasChanges = false;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const paneIndex = i + 1; // Pane 0 is the monitor
        
        try {
          // Check if pane has active process
          const result = await exec(`tmux list-panes -t ${sessionName}:0.${paneIndex} -F "#{pane_pid}"`);
          const pid = result.stdout.trim();
          
          if (pid) {
            try {
              await exec(`ps -p ${pid}`);
              // Process is still running
              if (newStatuses.get(task.id)?.status !== 'running') {
                hasChanges = true;
              }
            } catch {
              // Process has exited
              const currentStatus = newStatuses.get(task.id);
              if (currentStatus && currentStatus.status === 'running') {
                currentStatus.status = 'completed';
                currentStatus.endTime = new Date();
                hasChanges = true;
              }
            }
          }
        } catch (error) {
          // Pane might not exist or error checking
          const currentStatus = newStatuses.get(task.id);
          if (currentStatus && currentStatus.status === 'running') {
            currentStatus.status = 'failed';
            currentStatus.endTime = new Date();
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setTaskStatuses(newStatuses);
        setLastUpdate(new Date());
      }
    };

    const interval = setInterval(checkStatuses, 2000);
    return () => clearInterval(interval);
  }, [tasks, sessionName, taskStatuses]);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    } else if (key.tab) {
      setSelectedPane((prev) => (prev + 1) % (tasks.length + 1));
    } else if (input >= '1' && input <= '9') {
      const paneNum = parseInt(input);
      if (paneNum <= tasks.length) {
        // Switch to agent pane
        exec(`tmux select-pane -t ${sessionName}:0.${paneNum}`);
      }
    }
  });

  // Calculate statistics
  const completedCount = Array.from(taskStatuses.values()).filter(s => s.status === 'completed').length;
  const runningCount = Array.from(taskStatuses.values()).filter(s => s.status === 'running').length;
  const failedCount = Array.from(taskStatuses.values()).filter(s => s.status === 'failed').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🚀 Graphyn Cockpit - Agent Task Monitor</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Last Update: {lastUpdate.toLocaleTimeString()} | 
          <Text color="green"> ✓ {completedCount}</Text> | 
          <Text color="yellow"> ⚡ {runningCount}</Text> | 
          <Text color="red"> ✗ {failedCount}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Task Status:</Text>
        </Box>
        {tasks.map((task, index) => {
          const status = taskStatuses.get(task.id);
          const agent = agents.find(a => a.name.toLowerCase() === task.assigned_agent.toLowerCase());
          
          let statusIcon = '⚡';
          let statusColor = 'yellow';
          
          if (status?.status === 'completed') {
            statusIcon = '✓';
            statusColor = 'green';
          } else if (status?.status === 'failed') {
            statusIcon = '✗';
            statusColor = 'red';
          }

          const duration = status?.startTime && status?.endTime
            ? Math.round((status.endTime.getTime() - status.startTime.getTime()) / 1000)
            : status?.startTime
            ? Math.round((new Date().getTime() - status.startTime.getTime()) / 1000)
            : 0;

          return (
            <Box key={task.id} marginBottom={1}>
              <Text>
                [{index + 1}] <Text color={statusColor}>{statusIcon}</Text> {agent?.emoji || '🤖'} {agent?.name || task.assigned_agent}: 
              </Text>
              <Box marginLeft={2}>
                <Text dimColor>{task.title} ({duration}s)</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Controls:</Text>
        <Text dimColor>• Press 1-{tasks.length} to switch to agent pane</Text>
        <Text dimColor>• Press Tab to cycle through panes</Text>
        <Text dimColor>• Press Q to quit</Text>
      </Box>

      {runningCount === 0 && (
        <Box marginTop={1}>
          <Text bold color="green">
            🎉 All tasks completed! Press Q to exit and provide feedback.
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default CockpitMonitor;