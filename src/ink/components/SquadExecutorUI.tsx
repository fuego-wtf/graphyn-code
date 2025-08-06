import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, fuegoColors } from '../theme/colors.js';
import type { TaskStatus } from './SquadExecutorV3.js';

// Enhanced Progress Bar with gradient effect
export const EnhancedProgressBar: React.FC<{ 
  value: number; 
  width?: number;
  showPercentage?: boolean;
  color?: string;
}> = ({ value, width = 20, showPercentage = true, color = 'cyan' }) => {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  
  // Create gradient effect with different block characters
  const gradientBlocks = ['█', '▓', '▒', '░'];
  const filledBar = Array(filled).fill(0).map((_, i) => {
    const gradientIndex = Math.min(Math.floor(i / (filled / gradientBlocks.length)), gradientBlocks.length - 1);
    return gradientBlocks[0]; // Use full block for now
  }).join('');
  
  return (
    <Box>
      <Text color={color}>{filledBar}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      {showPercentage && (
        <Text color={color}> {Math.round(value)}%</Text>
      )}
    </Box>
  );
};

// Animated Status Indicator with pulse effect
export const AnimatedStatusIcon: React.FC<{ status: TaskStatus['status'] }> = ({ status }) => {
  const [frame, setFrame] = useState(0);
  const animationFrames = ['◐', '◓', '◑', '◒'];
  
  useEffect(() => {
    if (status === 'running' || status === 'launching') {
      const timer = setInterval(() => {
        setFrame(prev => (prev + 1) % animationFrames.length);
      }, 200);
      return () => clearInterval(timer);
    }
  }, [status]);
  
  switch (status) {
    case 'pending': 
      return <Text color="gray">○</Text>;
    case 'launching': 
      return <Text color="yellow">{animationFrames[frame]}</Text>;
    case 'running': 
      return <Text color={fuegoColors.accent.cyan}>{animationFrames[frame]}</Text>;
    case 'completed': 
      return <Text color="green">✓</Text>;
    case 'failed': 
      return <Text color="red">✗</Text>;
    case 'paused': 
      return <Text color="yellow">⏸</Text>;
    default: 
      return <Text>-</Text>;
  }
};

// Mini Activity Log with syntax highlighting
export const ActivityLog: React.FC<{ 
  activities: string[]; 
  maxLines?: number;
  highlightKeywords?: boolean;
}> = ({ activities, maxLines = 3, highlightKeywords = true }) => {
  const recentActivities = activities.slice(-maxLines);
  
  const highlightActivity = (activity: string) => {
    if (!highlightKeywords) return <Text color="gray">{activity}</Text>;
    
    // Highlight different types of activities
    const keywords = {
      'error': 'red',
      'success': 'green',
      'warning': 'yellow',
      'info': 'cyan',
      'analyzing': 'magenta',
      'building': 'blue',
      'testing': 'yellow',
      'deploying': 'green'
    };
    
    let highlighted = activity;
    for (const [keyword, color] of Object.entries(keywords)) {
      if (activity.toLowerCase().includes(keyword)) {
        return <Text color={color as any}>{activity}</Text>;
      }
    }
    
    return <Text color="gray">{activity}</Text>;
  };
  
  return (
    <Box flexDirection="column" marginTop={1}>
      {recentActivities.map((activity, i) => (
        <Box key={i}>
          <Text color="gray">└ </Text>
          {highlightActivity(activity)}
        </Box>
      ))}
    </Box>
  );
};

// Performance Metrics Display
export const MetricsDisplay: React.FC<{
  filesModified?: number;
  linesAdded?: number;
  linesRemoved?: number;
  duration?: number;
}> = ({ filesModified, linesAdded, linesRemoved, duration }) => {
  return (
    <Box gap={2}>
      {filesModified !== undefined && (
        <Box>
          <Text color="blue">📄 </Text>
          <Text color="white">{filesModified}</Text>
        </Box>
      )}
      {linesAdded !== undefined && (
        <Box>
          <Text color="green">+ </Text>
          <Text color="green">{linesAdded}</Text>
        </Box>
      )}
      {linesRemoved !== undefined && (
        <Box>
          <Text color="red">- </Text>
          <Text color="red">{linesRemoved}</Text>
        </Box>
      )}
      {duration !== undefined && (
        <Box>
          <Text color="cyan">⏱ </Text>
          <Text color="white">{Math.round(duration / 1000)}s</Text>
        </Box>
      )}
    </Box>
  );
};

// Task Priority Badge
export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const getPriorityColor = () => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };
  
  const getPrioritySymbol = () => {
    switch (priority) {
      case 'high': return '!!!';
      case 'medium': return '!!';
      case 'low': return '!';
      default: return '·';
    }
  };
  
  return (
    <Box>
      <Text color={getPriorityColor() as any}>{getPrioritySymbol()}</Text>
    </Box>
  );
};

// Animated Loading Dots
export const LoadingDots: React.FC<{ text?: string }> = ({ text = 'Loading' }) => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 300);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <Text color="cyan">
      {text}{dots}
      <Text color="transparent">{'.'.repeat(3 - dots.length)}</Text>
    </Text>
  );
};

// Glassmorphism Box Component
export const GlassBox: React.FC<{
  children: React.ReactNode;
  borderColor?: string;
  blur?: boolean;
}> = ({ children, borderColor = 'cyan', blur = true }) => {
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor as any}
      paddingX={2}
      paddingY={1}
    >
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  );
};

// Section Header with decorative elements
export const SectionHeader: React.FC<{ 
  title: string; 
  icon?: string;
  color?: string;
}> = ({ title, icon, color = 'cyan' }) => {
  return (
    <Box marginBottom={1}>
      <Text color={color as any}>
        ╭{'─'.repeat(title.length + 4)}╮
      </Text>
      <Text color={color as any}> </Text>
      {icon && <Text>{icon} </Text>}
      <Text bold color={color as any}>{title}</Text>
      <Text color={color as any}> </Text>
      <Text color={color as any}>
        ╰{'─'.repeat(title.length + 4)}╯
      </Text>
    </Box>
  );
};

// Task Dependencies Visualization
export const DependencyGraph: React.FC<{
  taskId: string;
  dependencies: string[];
  allTasks: Map<string, { title: string; status: TaskStatus['status'] }>;
}> = ({ taskId, dependencies, allTasks }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">Dependencies:</Text>
      {dependencies.length === 0 ? (
        <Text color="gray">  └─ None</Text>
      ) : (
        dependencies.map((depId, i) => {
          const dep = allTasks.get(depId);
          const isLast = i === dependencies.length - 1;
          const connector = isLast ? '└─' : '├─';
          const statusColor = dep?.status === 'completed' ? 'green' : 'yellow';
          
          return (
            <Box key={depId}>
              <Text color="gray">  {connector} </Text>
              <Text color={statusColor as any}>
                {dep?.title || depId}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};

// Notification Toast Component
export const NotificationToast: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
}> = ({ type, message, onDismiss }) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  
  if (!visible) return null;
  
  const getTypeConfig = () => {
    switch (type) {
      case 'success': return { icon: '✅', color: 'green' };
      case 'error': return { icon: '❌', color: 'red' };
      case 'warning': return { icon: '⚠️', color: 'yellow' };
      case 'info': return { icon: 'ℹ️', color: 'cyan' };
    }
  };
  
  const { icon, color } = getTypeConfig();
  
  return (
    <Box
      borderStyle="round"
      borderColor={color as any}
      paddingX={1}
      marginBottom={1}
    >
      <Text>{icon} </Text>
      <Text color={color as any}>{message}</Text>
    </Box>
  );
};