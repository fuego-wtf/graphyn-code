import React, { useState, useEffect } from 'react';
import { Box, useInput, useApp } from 'ink';
import { SplitScreenLayout } from './SplitScreenLayout.js';
import { ApprovalWorkflow } from './ApprovalWorkflow.js';
import { ExitProtection } from './ExitProtection.js';
import { ProgressIndicators } from './ProgressIndicators.js';
import { Typography, Card, Alert } from './VisualDesignSystem.js';
import { fuegoColors, colors } from '../theme/colors.js';

type DemoMode = 'splitscreen' | 'approval' | 'exit' | 'progress' | 'overview';

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
  startTime?: number;
  endTime?: number;
}

export const EnhancedUXDemo: React.FC = () => {
  const { exit } = useApp();
  const [mode, setMode] = useState<DemoMode>('overview');
  const [selectedDemo, setSelectedDemo] = useState(0);

  // Mock data for demonstrations
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Setup database schema',
      description: 'Create PostgreSQL tables with proper indexing and constraints',
      agentType: '@backend',
      status: 'completed',
      priority: 'high',
      estimatedTime: '15m',
      startTime: Date.now() - 900000,
      endTime: Date.now() - 600000
    },
    {
      id: '2', 
      title: 'Implement authentication API',
      description: 'JWT-based auth with refresh tokens and role-based access control',
      agentType: '@backend',
      status: 'in_progress',
      priority: 'high',
      estimatedTime: '30m',
      startTime: Date.now() - 300000,
      output: ['Setting up JWT middleware...', 'Configuring token validation...']
    },
    {
      id: '3',
      title: 'Design dashboard UI components',
      description: 'Create responsive dashboard with real-time data visualization',
      agentType: '@frontend',
      status: 'pending',
      priority: 'medium',
      estimatedTime: '45m',
      dependencies: ['2']
    },
    {
      id: '4',
      title: 'Write integration tests',
      description: 'Test API endpoints and UI interactions',
      agentType: '@tester',
      status: 'blocked',
      priority: 'low',
      estimatedTime: '20m',
      dependencies: ['1', '2'],
      error: 'Waiting for auth endpoint completion'
    }
  ];

  const mockStreamingData = {
    connectionStatus: 'connected' as const,
    currentPhase: 'execution' as const,
    output: [
      '🚀 Starting task execution...',
      '📋 Analyzing project structure...',
      '✅ Found 4 tasks to execute',
      '@backend Starting database schema setup',
      '  ├─ Creating users table...',
      '  ├─ Adding indexes for performance...',
      '  └─ ✅ Schema setup complete',
      '@backend Working on authentication API...',
      '  ├─ Setting up JWT middleware...',
      '  ├─ Configuring token validation...',
      '  └─ ⚡ In progress...'
    ],
    currentMessage: 'Implementing refresh token rotation strategy...'
  };

  const mockProgressPhases = [
    {
      id: 'analysis',
      name: 'Project Analysis',
      icon: '🔍',
      status: 'completed' as const,
      startTime: Date.now() - 1800000,
      endTime: Date.now() - 1500000,
      substeps: ['Scan codebase', 'Identify patterns', 'Generate recommendations']
    },
    {
      id: 'planning', 
      name: 'Task Planning',
      icon: '📋',
      status: 'completed' as const,
      startTime: Date.now() - 1500000,
      endTime: Date.now() - 1200000,
      substeps: ['Break down requirements', 'Assign agents', 'Set dependencies']
    },
    {
      id: 'execution',
      name: 'Task Execution',
      icon: '⚡',
      status: 'active' as const,
      startTime: Date.now() - 1200000,
      substeps: ['Database setup', 'API development', 'UI components', 'Testing'],
      currentSubstep: 1
    },
    {
      id: 'review',
      name: 'Code Review',
      icon: '👀',
      status: 'pending' as const,
      substeps: ['Static analysis', 'Security check', 'Performance audit']
    },
    {
      id: 'deployment',
      name: 'Deployment',
      icon: '🚀',
      status: 'pending' as const,
      substeps: ['Build artifacts', 'Deploy to staging', 'Run E2E tests']
    }
  ];

  const mockStreamingStatus = {
    isConnected: true,
    connectionHealth: 'excellent' as const,
    latency: 45,
    messagesReceived: 127,
    lastMessageTime: Date.now() - 2000,
    bufferStatus: 'normal' as const
  };

  const mockWorkState = {
    sessionId: 'ses_abc123def456',
    tasksInProgress: 2,
    tasksCompleted: 1,
    unsavedChanges: true,
    artifacts: [
      'src/auth/middleware.ts',
      'src/database/schema.sql',
      'src/components/Dashboard.tsx'
    ],
    lastSaved: new Date(Date.now() - 300000)
  };

  const demos = [
    { key: 'splitscreen', name: 'Split-Screen Layout', description: 'Real-time streaming with task decomposition' },
    { key: 'approval', name: 'Approval Workflow', description: 'Professional approval interface with shortcuts' },
    { key: 'progress', name: 'Progress Indicators', description: 'Comprehensive progress tracking and streaming status' },
    { key: 'exit', name: 'Exit Protection', description: 'Work preservation and safe exit system' }
  ];

  // Handle keyboard navigation
  useInput((input, key) => {
    if (mode === 'overview') {
      if (key.upArrow || input === 'k') {
        setSelectedDemo(Math.max(0, selectedDemo - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedDemo(Math.min(demos.length - 1, selectedDemo + 1));
      } else if (key.return || input === ' ') {
        setMode(demos[selectedDemo].key as DemoMode);
      } else if (key.escape || (key.ctrl && input === 'c')) {
        exit();
      }
    } else {
      if (key.escape) {
        setMode('overview');
      } else if (key.ctrl && input === 'c') {
        exit();
      }
    }
  });

  // Demo handlers
  const handleApproval = () => console.log('Approved!');
  const handleModify = (changes: string) => console.log('Modifications:', changes);
  const handleFeedback = (feedback: string) => console.log('Feedback:', feedback);
  const handleCancel = () => setMode('overview');
  const handleExitConfirm = () => exit();
  const handlePreserveWork = async (): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return '/tmp/graphyn-session-backup.json';
  };

  // Render overview screen
  if (mode === 'overview') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Card title="🎯 Graphyn CLI Enhanced UX Phase 2 Demo" variant="accent">
          <Typography variant="body">
            Showcase of sophisticated Ink components for the orchestration engine.
          </Typography>
          
          <Alert type="info" title="Spacecraft-Style Interface">
            Professional, responsive components designed for "piloting a spacecraft rather than operating heavy machinery"
          </Alert>
        </Card>

        <Card title="📋 Available Demonstrations">
          <Box flexDirection="column">
            {demos.map((demo, index) => (
              <Box key={demo.key} marginBottom={1}>
                <Box flexDirection="row" alignItems="center">
                  <Typography 
                    variant="body" 
                    color={selectedDemo === index ? fuegoColors.text.primary : 'transparent'}
                  >
                    ▶{' '}
                  </Typography>
                  
                  <Box flexGrow={1}>
                    <Typography 
                      variant="h3" 
                      color={selectedDemo === index ? fuegoColors.text.primary : fuegoColors.text.secondary}
                      bold={selectedDemo === index}
                    >
                      {demo.name}
                    </Typography>
                    <Typography variant="caption" color={fuegoColors.text.dimmed}>
                      {demo.description}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Card>

        <Card>
          <Typography variant="caption" color={fuegoColors.text.dimmed}>
            ↑↓/jk: Navigate • Enter/Space: Select demo • Esc/Ctrl+C: Exit
          </Typography>
        </Card>
      </Box>
    );
  }

  // Render specific demo modes
  switch (mode) {
    case 'splitscreen':
      return (
        <SplitScreenLayout
          tasks={mockTasks}
          streamingData={mockStreamingData}
          onTaskSelect={(taskId) => console.log('Selected task:', taskId)}
          onPhaseChange={(phase) => console.log('Phase changed:', phase)}
        />
      );

    case 'approval':
      return (
        <ApprovalWorkflow
          title="🔍 Task Plan Review"
          description="Review the generated task plan and provide your feedback"
          context={{
            tasks: mockTasks,
            summary: 'Generated 4 tasks across backend, frontend, and testing domains'
          }}
          onApprove={handleApproval}
          onModify={handleModify}
          onFeedback={handleFeedback}
          onCancel={handleCancel}
          showWorkPreservation={true}
        />
      );

    case 'progress':
      return (
        <ProgressIndicators
          phases={mockProgressPhases}
          currentPhaseIndex={2}
          streamingStatus={mockStreamingStatus}
          overallProgress={65}
          showDetailedProgress={true}
        />
      );

    case 'exit':
      return (
        <ExitProtection
          workState={mockWorkState}
          onConfirmExit={handleExitConfirm}
          onCancelExit={handleCancel}
          onPreserveWork={handlePreserveWork}
          autoPreserve={false}
        />
      );

    default:
      return (
        <Card>
          <Alert type="error" title="Unknown Demo Mode">
            Demo mode "{mode}" not implemented
          </Alert>
        </Card>
      );
  }
};