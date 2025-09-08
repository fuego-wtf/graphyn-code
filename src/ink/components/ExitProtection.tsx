import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { fuegoColors, colors } from '../theme/colors.js';

interface WorkState {
  sessionId: string;
  tasksInProgress: number;
  tasksCompleted: number;
  unsavedChanges: boolean;
  artifacts: string[];
  lastSaved: Date;
  preservationPath?: string;
}

interface ExitProtectionProps {
  workState: WorkState;
  onConfirmExit: () => void;
  onCancelExit: () => void;
  onPreserveWork?: () => Promise<string>;
  autoPreserve?: boolean;
}

export const ExitProtection: React.FC<ExitProtectionProps> = ({
  workState,
  onConfirmExit,
  onCancelExit,
  onPreserveWork,
  autoPreserve = true
}) => {
  const { exit } = useApp();
  const [step, setStep] = useState<'warning' | 'preserving' | 'confirmation'>('warning');
  const [preservationStatus, setPreservationStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [preservationPath, setPreservationPath] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-preserve work if enabled
  useEffect(() => {
    if (autoPreserve && step === 'warning' && onPreserveWork) {
      handlePreserveWork();
    }
  }, [autoPreserve, step, onPreserveWork]);

  // Countdown timer for auto-exit
  useEffect(() => {
    if (step === 'confirmation' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (step === 'confirmation' && countdown === 0) {
      onConfirmExit();
    }
  }, [step, countdown, onConfirmExit]);

  const handlePreserveWork = useCallback(async () => {
    if (!onPreserveWork) return;

    setStep('preserving');
    setPreservationStatus('saving');

    try {
      const path = await onPreserveWork();
      setPreservationPath(path);
      setPreservationStatus('success');
      setStep('confirmation');
    } catch (error) {
      setPreservationStatus('error');
      // Stay in preserving step to show error and options
    }
  }, [onPreserveWork]);

  // Handle keyboard input
  useInput((input, key) => {
    if (step === 'warning') {
      if (input === 'y' || input === 'Y') {
        if (onPreserveWork && !autoPreserve) {
          handlePreserveWork();
        } else {
          onConfirmExit();
        }
      } else if (input === 'n' || input === 'N' || key.escape) {
        onCancelExit();
      } else if (input === 's' || input === 'S') {
        if (onPreserveWork) {
          handlePreserveWork();
        }
      } else if (input === 'd' || input === 'D') {
        setShowDetails(!showDetails);
      } else if (key.upArrow) {
        setSelectedOption(Math.max(0, selectedOption - 1));
      } else if (key.downArrow) {
        setSelectedOption(Math.min(2, selectedOption + 1));
      } else if (key.return) {
        if (selectedOption === 0) {
          onCancelExit();
        } else if (selectedOption === 1) {
          if (onPreserveWork) {
            handlePreserveWork();
          } else {
            onConfirmExit();
          }
        } else if (selectedOption === 2) {
          onConfirmExit();
        }
      }
    } else if (step === 'preserving' && preservationStatus === 'error') {
      if (input === 'r' || input === 'R') {
        handlePreserveWork();
      } else if (input === 'f' || input === 'F') {
        onConfirmExit();
      } else if (key.escape) {
        onCancelExit();
      }
    } else if (step === 'confirmation') {
      if (input === 'y' || input === 'Y' || key.return) {
        onConfirmExit();
      } else if (input === 'n' || input === 'N' || key.escape) {
        onCancelExit();
      }
    }
  });

  // Render work state details
  const renderWorkDetails = () => {
    if (!showDetails) return null;

    return (
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1} 
        marginTop={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={fuegoColors.text.primary} bold>
            📊 Detailed Work State
          </Text>
          <Box marginTop={1} marginLeft={2}>
            <Text color={fuegoColors.text.secondary}>
              • Session ID: <Text color={colors.info}>{workState.sessionId.substring(0, 8)}...</Text>
            </Text>
            <Text color={fuegoColors.text.secondary}>
              • Last saved: <Text color={fuegoColors.text.dimmed}>
                {workState.lastSaved.toLocaleTimeString()}
              </Text>
            </Text>
            <Text color={fuegoColors.text.secondary}>
              • Artifacts created: <Text color={colors.success}>{workState.artifacts.length}</Text>
            </Text>
            {workState.artifacts.length > 0 && (
              <Box marginTop={1} marginLeft={2}>
                {workState.artifacts.slice(0, 3).map((artifact, index) => (
                  <Text key={index} color={fuegoColors.text.dimmed} dimColor>
                    - {artifact}
                  </Text>
                ))}
                {workState.artifacts.length > 3 && (
                  <Text color={fuegoColors.text.dimmed} dimColor>
                    + {workState.artifacts.length - 3} more...
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  // Render preservation status
  const renderPreservationStatus = () => {
    switch (preservationStatus) {
      case 'saving':
        return (
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text color={colors.info}>
              <Spinner type="dots" />
            </Text>
            <Text color={colors.info}>Preserving work state...</Text>
          </Box>
        );
      case 'success':
        return (
          <Box flexDirection="column">
            <Text color={colors.success}>
              ✅ Work successfully preserved!
            </Text>
            {preservationPath && (
              <Text color={fuegoColors.text.dimmed} dimColor>
                📁 Saved to: {preservationPath}
              </Text>
            )}
          </Box>
        );
      case 'error':
        return (
          <Box flexDirection="column">
            <Text color={colors.error}>
              ❌ Failed to preserve work state
            </Text>
            <Text color={fuegoColors.text.dimmed} dimColor>
              Your work may be lost if you continue
            </Text>
          </Box>
        );
      default:
        return null;
    }
  };

  // Warning step
  if (step === 'warning') {
    const options = [
      { key: 'N', label: 'Continue working', color: colors.success },
      { key: 'S', label: 'Save & Exit', color: colors.warning, available: !!onPreserveWork },
      { key: 'Y', label: 'Force Exit', color: colors.error }
    ].filter(opt => opt.available !== false);

    return (
      <Box flexDirection="column" paddingY={1}>
        {/* Header */}
        <Box 
          borderStyle="double" 
          borderColor={colors.warning} 
          paddingX={3} 
          paddingY={1}
          marginBottom={1}
        >
          <Box flexDirection="column" alignItems="center">
            <Text color={colors.warning} bold>
              ⚠️  EXIT PROTECTION ACTIVATED
            </Text>
            <Text color={fuegoColors.text.secondary} marginTop={1}>
              You have active work in progress
            </Text>
          </Box>
        </Box>

        {/* Work state summary */}
        <Box 
          borderStyle="round" 
          borderColor={workState.unsavedChanges ? colors.warning : fuegoColors.border.subtle} 
          paddingX={2} 
          paddingY={1} 
          marginBottom={1}
        >
          <Box flexDirection="column">
            <Text color={fuegoColors.text.primary} bold>
              🔍 Current Work State
            </Text>
            <Box marginTop={1} marginLeft={2}>
              <Text color={fuegoColors.text.secondary}>
                • Tasks in progress: <Text color={colors.info}>{workState.tasksInProgress}</Text>
              </Text>
              <Text color={fuegoColors.text.secondary}>
                • Tasks completed: <Text color={colors.success}>{workState.tasksCompleted}</Text>
              </Text>
              <Text color={fuegoColors.text.secondary}>
                • Unsaved changes: <Text color={workState.unsavedChanges ? colors.warning : colors.success}>
                  {workState.unsavedChanges ? 'Yes' : 'No'}
                </Text>
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={fuegoColors.text.dimmed} dimColor>
                Press 'D' to see detailed information
              </Text>
            </Box>
          </Box>
        </Box>

        {renderWorkDetails()}

        {/* Action options */}
        <Box 
          borderStyle="round" 
          borderColor={fuegoColors.border.accent} 
          paddingX={2} 
          paddingY={1} 
          marginBottom={1}
        >
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color={fuegoColors.text.primary} bold>
                What would you like to do?
              </Text>
            </Box>
            
            {options.map((option, index) => (
              <Box key={option.key} marginBottom={1}>
                <Box flexDirection="row" alignItems="center">
                  <Text color={selectedOption === index ? fuegoColors.text.primary : 'transparent'}>
                    ▶{' '}
                  </Text>
                  <Text color={option.color} bold={selectedOption === index}>
                    [{option.key}] {option.label}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Shortcuts */}
        <Box>
          <Text color={fuegoColors.text.dimmed} dimColor>
            ↑↓ Navigate • Enter: Select • D: Details • Esc: Continue working
          </Text>
        </Box>
      </Box>
    );
  }

  // Preserving step
  if (step === 'preserving') {
    return (
      <Box flexDirection="column" paddingY={1} alignItems="center">
        <Box 
          borderStyle="round" 
          borderColor={preservationStatus === 'error' ? colors.error : colors.info} 
          paddingX={3} 
          paddingY={2}
        >
          <Box flexDirection="column" alignItems="center">
            <Box marginBottom={2}>
              <Text color={fuegoColors.text.primary} bold>
                💾 Work Preservation
              </Text>
            </Box>
            
            {renderPreservationStatus()}

            {preservationStatus === 'error' && (
              <Box marginTop={2} flexDirection="column" alignItems="center">
                <Box marginBottom={1}>
                  <Text color={fuegoColors.text.secondary}>
                    Choose how to proceed:
                  </Text>
                </Box>
                <Box flexDirection="row" gap={4}>
                  <Text color={colors.warning} bold>
                    [R]etry save
                  </Text>
                  <Text color={colors.error} bold>
                    [F]orce exit anyway
                  </Text>
                  <Text color={colors.success} bold>
                    [Esc] Cancel
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // Confirmation step
  if (step === 'confirmation') {
    return (
      <Box flexDirection="column" paddingY={1} alignItems="center">
        <Box 
          borderStyle="double" 
          borderColor={colors.success} 
          paddingX={3} 
          paddingY={2}
        >
          <Box flexDirection="column" alignItems="center">
            <Text color={colors.success} bold>
              ✅ Work Successfully Preserved
            </Text>
            
            {preservationPath && (
              <Box marginTop={1} alignItems="center">
                <Text color={fuegoColors.text.secondary}>
                  Saved to: <Text color={colors.info}>{preservationPath}</Text>
                </Text>
              </Box>
            )}

            <Box marginTop={2}>
              <Text color={fuegoColors.text.primary}>
                Exit in {countdown} seconds...
              </Text>
            </Box>

            <Box marginTop={2} flexDirection="row" gap={4}>
              <Text color={colors.success} bold>
                [Y]es, exit now
              </Text>
              <Text color={colors.warning} bold>
                [N]o, keep working
              </Text>
            </Box>

            <Box marginTop={1}>
              <Text color={fuegoColors.text.dimmed} dimColor>
                You can resume your work later by loading the saved session
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
};