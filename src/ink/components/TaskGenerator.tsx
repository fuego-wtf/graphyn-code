import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { colors } from '../theme/colors.js';

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dependencies: string[];
  phase: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'ready' | 'blocked';
}

interface TaskPlan {
  tasks: Task[];
  phases: {
    number: number;
    name: string;
    description: string;
  }[];
}

interface TaskGeneratorProps {
  squad: any;
  onAccept: (tasks: TaskPlan) => void;
  onRequestChanges: (feedback: string) => void;
  onBack: () => void;
}

type ViewMode = 'overview' | 'phase-view' | 'task-detail' | 'feedback';

export const TaskGenerator: React.FC<TaskGeneratorProps> = ({
  squad,
  onAccept,
  onRequestChanges,
  onBack
}) => {
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPhase, setSelectedPhase] = useState(0);
  const [selectedTask, setSelectedTask] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate task generation
    setTimeout(() => {
      setTaskPlan(generateMockTaskPlan(squad));
      setLoading(false);
    }, 2000);
  }, [squad]);

  useInput((input, key) => {
    if (loading) return;

    if (key.escape) {
      if (viewMode === 'task-detail' || viewMode === 'phase-view') {
        setViewMode('overview');
      } else if (viewMode === 'feedback') {
        setViewMode('overview');
      } else {
        onBack();
      }
    }

    if (viewMode === 'overview') {
      if (input === 'a' || input === 'A') {
        handleAccept();
      } else if (input === 'f' || input === 'F') {
        setViewMode('feedback');
      } else if (input === 'p' || input === 'P') {
        setViewMode('phase-view');
      }
    }
  });

  const handleAccept = () => {
    if (taskPlan) {
      onAccept(taskPlan);
    }
  };

  const handleSubmitFeedback = () => {
    if (feedback.trim()) {
      setLoading(true);
      onRequestChanges(feedback);
    }
  };

  if (loading || !taskPlan) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Generating task plan...</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>Analyzing squad capabilities and creating optimal task distribution...</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'feedback') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">Task Plan Feedback</Text>
        
        <Box marginTop={1}>
          <Text>What changes would you like to make to the task plan?</Text>
        </Box>
        
        <Box marginTop={1}>
          <TextInput
            value={feedback}
            onChange={setFeedback}
            placeholder="e.g., Add more testing tasks, split the authentication task..."
            onSubmit={handleSubmitFeedback}
          />
        </Box>
        
        <Box marginTop={2}>
          <Text color={colors.dim}>Press Enter to submit, ESC to cancel</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'phase-view') {
    const phase = taskPlan.phases[selectedPhase];
    const phaseTasks = taskPlan.tasks.filter(t => t.phase === phase.number);

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Phase {phase.number}: {phase.name}</Text>
        <Text color="gray">{phase.description}</Text>
        
        <Box marginTop={1} borderStyle="round" borderColor="cyan" padding={1}>
          <Box flexDirection="column">
            {phaseTasks.map((task, index) => (
              <Box key={task.id} marginTop={index > 0 ? 1 : 0}>
                <Box>
                  <Text color={getPriorityColor(task.priority)}>
                    [{task.priority.toUpperCase()}]
                  </Text>
                  <Text> {task.title}</Text>
                </Box>
                <Box paddingLeft={2}>
                  <Text color="gray">→ {task.assignedTo}</Text>
                </Box>
                {task.dependencies.length > 0 && (
                  <Box paddingLeft={2}>
                    <Text color="yellow">⚡ Depends on: {task.dependencies.join(', ')}</Text>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
        
        <Box marginTop={1}>
          <Text color={colors.dim}>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Overview mode
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">📋 Task Plan Generated!</Text>
      
      <Box marginTop={1} borderStyle="round" borderColor="green" padding={1}>
        <Box flexDirection="column">
          <Text bold>Total Tasks: <Text color="cyan">{taskPlan.tasks.length}</Text></Text>
          <Text bold>Phases: <Text color="cyan">{taskPlan.phases.length}</Text></Text>
          
          <Box marginTop={1}>
            <Text bold>Task Distribution:</Text>
            {squad.agents.map((agent: any) => {
              const agentTasks = taskPlan.tasks.filter(t => t.assignedTo === agent.name);
              return (
                <Box key={agent.name} paddingLeft={1}>
                  <Text>{agent.emoji} {agent.name}: </Text>
                  <Text color="cyan">{agentTasks.length} tasks</Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Text bold>Implementation Phases:</Text>
        {taskPlan.phases.map((phase) => {
          const phaseTasks = taskPlan.tasks.filter(t => t.phase === phase.number);
          return (
            <Box key={phase.number} marginTop={1} paddingLeft={1}>
              <Text color="cyan">Phase {phase.number}: {phase.name}</Text>
              <Text color="gray"> ({phaseTasks.length} tasks)</Text>
            </Box>
          );
        })}
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text bold>Actions:</Text>
        <Text color="green">[A] Accept task plan</Text>
        <Text color="yellow">[F] Request changes</Text>
        <Text color="cyan">[P] View phases in detail</Text>
        <Text color={colors.dim}>[ESC] Go back</Text>
      </Box>
    </Box>
  );
};

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'green';
    default: return 'white';
  }
}

function generateMockTaskPlan(squad: any): TaskPlan {
  // This would be replaced with actual API call
  return {
    phases: [
      {
        number: 1,
        name: 'Foundation',
        description: 'Set up core infrastructure and basic components'
      },
      {
        number: 2,
        name: 'Integration',
        description: 'Connect components and implement business logic'
      },
      {
        number: 3,
        name: 'Hardening',
        description: 'Security, testing, and production readiness'
      }
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Create authentication endpoints',
        description: 'Implement login, register, and token refresh endpoints',
        assignedTo: 'Backend Auth Specialist',
        dependencies: [],
        phase: 1,
        priority: 'high',
        status: 'ready'
      },
      {
        id: 'task-2',
        title: 'Build login/register UI components',
        description: 'Create responsive forms with validation',
        assignedTo: 'Frontend Auth Expert',
        dependencies: [],
        phase: 1,
        priority: 'high',
        status: 'ready'
      },
      {
        id: 'task-3',
        title: 'Connect UI to authentication API',
        description: 'Implement API calls and state management',
        assignedTo: 'Integration Midfielder',
        dependencies: ['task-1', 'task-2'],
        phase: 2,
        priority: 'high',
        status: 'blocked'
      },
      {
        id: 'task-4',
        title: 'Write authentication tests',
        description: 'Unit and integration tests for auth flow',
        assignedTo: 'Testing Specialist',
        dependencies: ['task-1', 'task-2'],
        phase: 2,
        priority: 'medium',
        status: 'blocked'
      },
      {
        id: 'task-5',
        title: 'Security audit',
        description: 'Review implementation for vulnerabilities',
        assignedTo: 'Security Defender',
        dependencies: ['task-3'],
        phase: 3,
        priority: 'high',
        status: 'blocked'
      },
      {
        id: 'task-6',
        title: 'Configure CI/CD pipeline',
        description: 'Set up automated deployment',
        assignedTo: 'DevOps Engineer',
        dependencies: ['task-4'],
        phase: 3,
        priority: 'medium',
        status: 'blocked'
      }
    ]
  };
}