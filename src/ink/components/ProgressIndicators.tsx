import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { fuegoColors, colors } from '../theme/colors.js';

interface ProgressPhase {
  id: string;
  name: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  startTime?: number;
  endTime?: number;
  substeps?: string[];
  currentSubstep?: number;
}

interface StreamingStatus {
  isConnected: boolean;
  connectionHealth: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency?: number;
  messagesReceived: number;
  lastMessageTime?: number;
  bufferStatus: 'empty' | 'normal' | 'full';
}

interface ProgressIndicatorsProps {
  phases: ProgressPhase[];
  currentPhaseIndex: number;
  streamingStatus: StreamingStatus;
  overallProgress: number;
  showDetailedProgress?: boolean;
  compactMode?: boolean;
}

export const ProgressIndicators: React.FC<ProgressIndicatorsProps> = ({
  phases,
  currentPhaseIndex,
  streamingStatus,
  overallProgress,
  showDetailedProgress = false,
  compactMode = false
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);

  // Animation for progress bars
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(frame => (frame + 1) % 8);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Get phase status styling
  const getPhaseStatusColor = (status: ProgressPhase['status']) => {
    switch (status) {
      case 'pending':
        return fuegoColors.text.dimmed;
      case 'active':
        return colors.info;
      case 'completed':
        return colors.success;
      case 'error':
        return colors.error;
      default:
        return fuegoColors.text.secondary;
    }
  };

  // Get phase status icon
  const getPhaseStatusIcon = (phase: ProgressPhase, index: number) => {
    const isActive = index === currentPhaseIndex;
    
    switch (phase.status) {
      case 'pending':
        return <Text color={fuegoColors.text.dimmed}>⏳</Text>;
      case 'active':
        return <Text color={colors.info}><Spinner type="dots" /></Text>;
      case 'completed':
        return <Text color={colors.success}>✅</Text>;
      case 'error':
        return <Text color={colors.error}>❌</Text>;
      default:
        return <Text color={fuegoColors.text.dimmed}>•</Text>;
    }
  };

  // Get connection health indicator
  const getConnectionHealthIndicator = () => {
    const { connectionHealth, latency, isConnected } = streamingStatus;
    
    if (!isConnected) {
      return <Text color={colors.error}>🔴 Offline</Text>;
    }

    switch (connectionHealth) {
      case 'excellent':
        return <Text color={colors.success}>🟢 Excellent</Text>;
      case 'good':
        return <Text color={colors.success}>🟡 Good</Text>;
      case 'poor':
        return <Text color={colors.warning}>🟠 Poor</Text>;
      case 'disconnected':
        return <Text color={colors.error}>🔴 Disconnected</Text>;
      default:
        return <Text color={fuegoColors.text.dimmed}>⚪ Unknown</Text>;
    }
  };

  // Format duration
  const formatDuration = (ms?: number) => {
    if (!ms) return '--';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = () => {
    const currentPhase = phases[currentPhaseIndex];
    if (!currentPhase?.startTime) return null;
    
    const elapsed = Date.now() - currentPhase.startTime;
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const totalPhases = phases.length;
    
    if (completedPhases === 0) return null;
    
    const avgPhaseTime = elapsed / completedPhases;
    const remainingPhases = totalPhases - completedPhases;
    const estimatedRemaining = avgPhaseTime * remainingPhases;
    
    return formatDuration(estimatedRemaining);
  };

  // Render progress bar
  const renderProgressBar = (progress: number, width: number = 20) => {
    const filledWidth = Math.floor(progress * width / 100);
    const emptyWidth = width - filledWidth;
    
    return (
      <Box flexDirection="row">
        <Text color={colors.info}>
          {'█'.repeat(filledWidth)}
        </Text>
        <Text color={fuegoColors.text.dimmed}>
          {'░'.repeat(emptyWidth)}
        </Text>
      </Box>
    );
  };

  // Render animated loading indicator
  const renderLoadingAnimation = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧'];
    return <Text color={colors.info}>{frames[animationFrame]}</Text>;
  };

  // Compact mode rendering
  if (compactMode) {
    return (
      <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
        <Box flexDirection="row" gap={1}>
          {renderLoadingAnimation()}
          <Text color={fuegoColors.text.primary}>
            {phases[currentPhaseIndex]?.name || 'Processing...'}
          </Text>
        </Box>
        
        <Box flexDirection="row" gap={2}>
          <Text color={fuegoColors.text.dimmed}>
            {Math.round(overallProgress)}%
          </Text>
          {getConnectionHealthIndicator()}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Overall progress header */}
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.accent} 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color={fuegoColors.text.primary} bold>
              ⚡ Execution Progress
            </Text>
            <Text color={fuegoColors.text.secondary}>
              {Math.round(overallProgress)}% • {getEstimatedTimeRemaining() || 'Calculating...'}
            </Text>
          </Box>
          
          <Box flexDirection="row" alignItems="center" gap={2}>
            {renderProgressBar(overallProgress, 30)}
            <Text color={fuegoColors.text.dimmed} dimColor>
              {phases.filter(p => p.status === 'completed').length}/{phases.length} phases
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Phase progression */}
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={fuegoColors.text.primary} bold>
            📋 Phase Execution
          </Text>
          <Text>{""}</Text>
          
          {phases.map((phase, index) => {
            const isActive = index === currentPhaseIndex;
            const isPast = index < currentPhaseIndex;
            const isFuture = index > currentPhaseIndex;
            
            return (
              <Box key={phase.id} marginBottom={1}>
                <Box flexDirection="row" alignItems="center">
                  {/* Connection line for non-first items */}
                  {index > 0 && (
                    <Box marginRight={1}>
                      <Text color={isPast ? colors.success : fuegoColors.text.dimmed}>
                        {isPast ? '│' : '│'}
                      </Text>
                    </Box>
                  )}
                  
                  {/* Phase status icon */}
                  <Box marginRight={2}>
                    {getPhaseStatusIcon(phase, index)}
                  </Box>
                  
                  {/* Phase name and details */}
                  <Box flexGrow={1}>
                    <Box flexDirection="row" justifyContent="space-between">
                      <Text 
                        color={getPhaseStatusColor(phase.status)} 
                        bold={isActive}
                      >
                        {phase.icon} {phase.name}
                      </Text>
                      
                      {/* Duration/timing info */}
                      {(phase.startTime || phase.duration) && (
                        <Text color={fuegoColors.text.dimmed} dimColor>
                          {phase.endTime && phase.startTime 
                            ? formatDuration(phase.endTime - phase.startTime)
                            : phase.startTime 
                            ? formatDuration(Date.now() - phase.startTime)
                            : formatDuration(phase.duration)
                          }
                        </Text>
                      )}
                    </Box>
                    
                    {/* Substeps for active phase */}
                    {isActive && phase.substeps && showDetailedProgress && (
                      <Box marginTop={1} marginLeft={2}>
                        {phase.substeps.map((substep, substepIndex) => {
                          const isActiveSubstep = substepIndex === phase.currentSubstep;
                          const isCompletedSubstep = substepIndex < (phase.currentSubstep || 0);
                          
                          return (
                            <Box key={substepIndex} flexDirection="row" alignItems="center">
                              <Text color={
                                isCompletedSubstep ? colors.success :
                                isActiveSubstep ? colors.info :
                                fuegoColors.text.dimmed
                              }>
                                {isCompletedSubstep ? '✓' : isActiveSubstep ? '▶' : '•'}
                              </Text>
                              <Text 
                                color={
                                  isActiveSubstep ? colors.info : 
                                  isCompletedSubstep ? fuegoColors.text.secondary :
                                  fuegoColors.text.dimmed
                                }
                              >
                                {" "}
                                {substep}
                              </Text>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Streaming status */}
      <Box 
        borderStyle="round" 
        borderColor={streamingStatus.isConnected ? fuegoColors.border.subtle : colors.error} 
        paddingX={2} 
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text color={fuegoColors.text.primary} bold>
            🌐 Streaming Status
          </Text>
          <Text>{""}</Text>
          
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="column" gap={1}>
              <Box flexDirection="row" alignItems="center" gap={2}>
                <Text color={fuegoColors.text.secondary}>Connection:</Text>
                {getConnectionHealthIndicator()}
              </Box>
              
              {streamingStatus.latency && (
                <Box flexDirection="row" alignItems="center" gap={2}>
                  <Text color={fuegoColors.text.secondary}>Latency:</Text>
                  <Text color={
                    streamingStatus.latency < 50 ? colors.success :
                    streamingStatus.latency < 200 ? colors.warning :
                    colors.error
                  }>
                    {streamingStatus.latency}ms
                  </Text>
                </Box>
              )}
            </Box>
            
            <Box flexDirection="column" alignItems="flex-end">
              <Text color={fuegoColors.text.secondary}>
                Messages: <Text color={colors.info}>{streamingStatus.messagesReceived}</Text>
              </Text>
              
              <Text color={fuegoColors.text.secondary}>
                Buffer: <Text color={
                  streamingStatus.bufferStatus === 'full' ? colors.warning :
                  streamingStatus.bufferStatus === 'normal' ? colors.success :
                  fuegoColors.text.dimmed
                }>
                  {streamingStatus.bufferStatus}
                </Text>
              </Text>
              
              {streamingStatus.lastMessageTime && (
                <Text color={fuegoColors.text.dimmed} dimColor>
                  Last: {formatDuration(Date.now() - streamingStatus.lastMessageTime)} ago
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};