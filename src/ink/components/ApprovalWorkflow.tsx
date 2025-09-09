import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { fuegoColors, colors } from '../theme/colors.js';

type ApprovalAction = 'approve' | 'modify' | 'feedback' | 'cancel';

interface ApprovalOption {
  key: string;
  label: string;
  description: string;
  action: ApprovalAction;
  color: string;
}

interface ApprovalWorkflowProps {
  title: string;
  description?: string;
  context: {
    tasks?: any[];
    changes?: any[];
    summary?: string;
  };
  onApprove: () => void;
  onModify: (modifications: string) => void;
  onFeedback: (feedback: string) => void;
  onCancel: () => void;
  showWorkPreservation?: boolean;
  autoFocusInput?: boolean;
}

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  title,
  description,
  context,
  onApprove,
  onModify,
  onFeedback,
  onCancel,
  showWorkPreservation = false,
  autoFocusInput = false
}) => {
  const { exit } = useApp();
  const [mode, setMode] = useState<'selection' | 'input'>('selection');
  const [inputMode, setInputMode] = useState<'modify' | 'feedback' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Approval options configuration
  const approvalOptions: ApprovalOption[] = [
    {
      key: 'a',
      label: '[A]pprove',
      description: 'Accept and continue execution',
      action: 'approve',
      color: colors.success
    },
    {
      key: 'm', 
      label: '[M]odify',
      description: 'Request specific changes',
      action: 'modify',
      color: colors.warning
    },
    {
      key: 'f',
      label: '[F]eedback',
      description: 'Provide general feedback',
      action: 'feedback',
      color: colors.info
    },
    {
      key: 'c',
      label: '[C]ancel',
      description: 'Cancel current operation',
      action: 'cancel',
      color: colors.error
    }
  ];

  // Auto-focus input if specified
  useEffect(() => {
    if (autoFocusInput) {
      setMode('input');
      setInputMode('feedback');
    }
  }, [autoFocusInput]);

  // Handle keyboard input for selection mode
  useInput((input, key) => {
    if (mode === 'selection' && !showConfirmation) {
      const option = approvalOptions.find(opt => opt.key === input.toLowerCase());
      if (option) {
        handleOptionSelect(option.action);
      } else if (key.upArrow) {
        setSelectedOption(Math.max(0, selectedOption - 1));
      } else if (key.downArrow) {
        setSelectedOption(Math.min(approvalOptions.length - 1, selectedOption + 1));
      } else if (key.return) {
        handleOptionSelect(approvalOptions[selectedOption].action);
      } else if (key.escape) {
        onCancel();
      }
    } else if (showConfirmation) {
      if (input.toLowerCase() === 'y') {
        onCancel();
        exit();
      } else if (input.toLowerCase() === 'n' || key.escape) {
        setShowConfirmation(false);
      }
    }
  }, { isActive: mode === 'selection' || showConfirmation });

  const handleOptionSelect = useCallback((action: ApprovalAction) => {
    switch (action) {
      case 'approve':
        onApprove();
        break;
      case 'modify':
        setMode('input');
        setInputMode('modify');
        break;
      case 'feedback':
        setMode('input');
        setInputMode('feedback');
        break;
      case 'cancel':
        if (showWorkPreservation) {
          setShowConfirmation(true);
        } else {
          onCancel();
        }
        break;
    }
  }, [onApprove, onCancel, showWorkPreservation]);

  const handleInputSubmit = useCallback((value: string) => {
    if (!value.trim()) return;

    if (inputMode === 'modify') {
      onModify(value.trim());
    } else if (inputMode === 'feedback') {
      onFeedback(value.trim());
    }

    // Reset state
    setMode('selection');
    setInputMode(null);
    setInputValue('');
  }, [inputMode, onModify, onFeedback]);

  const handleInputCancel = useCallback(() => {
    setMode('selection');
    setInputMode(null);
    setInputValue('');
  }, []);

  // Render work preservation warning
  const renderWorkPreservation = () => {
    if (!showWorkPreservation) return null;

    return (
      <Box 
        borderStyle="round" 
        borderColor={colors.warning} 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={colors.warning} bold>
            ⚠️  Work Preservation Status
          </Text>
          <Box marginTop={1} marginLeft={2}>
            <Text color={fuegoColors.text.secondary}>
              • Current session state: <Text color={colors.success}>Saved</Text>
            </Text>
            <Text color={fuegoColors.text.secondary}>
              • Progress history: <Text color={colors.success}>Preserved</Text>
            </Text>
            <Text color={fuegoColors.text.secondary}>
              • Generated artifacts: <Text color={colors.success}>Backed up</Text>
            </Text>
          </Box>
        </Box>
      </Box>
    );
  };

  // Render context information
  const renderContext = () => {
    if (!context || Object.keys(context).length === 0) return null;

    return (
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1} 
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={fuegoColors.text.primary} bold>
            📋 Context Summary
          </Text>
          <Box marginTop={1} marginLeft={2}>
            {context.tasks && (
              <Text color={fuegoColors.text.secondary}>
                • Tasks: {context.tasks.length} items planned
              </Text>
            )}
            {context.changes && (
              <Text color={fuegoColors.text.secondary}>
                • Changes: {context.changes.length} modifications
              </Text>
            )}
            {context.summary && (
              <Box marginTop={1}>
                <Text color={fuegoColors.text.secondary} wrap="wrap">
                  {context.summary}
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  // Render confirmation dialog
  if (showConfirmation) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box 
          borderStyle="double" 
          borderColor={colors.error} 
          paddingX={3} 
          paddingY={2}
        >
          <Box flexDirection="column" alignItems="center">
            <Text color={colors.error} bold>
              🚨 Confirm Cancellation
            </Text>
            <Box marginTop={1}>
              <Text color={fuegoColors.text.primary}>
                Are you sure you want to cancel the current operation?
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={fuegoColors.text.secondary}>
                Your work will be preserved and can be resumed later.
              </Text>
            </Box>
            <Box marginTop={2} flexDirection="row" gap={4}>
              <Text color={colors.error} bold>
                [Y]es, cancel
              </Text>
              <Text color={colors.success} bold>
                [N]o, continue
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // Render input mode
  if (mode === 'input') {
    const inputTitle = inputMode === 'modify' ? 'Modifications' : 'Feedback';
    const inputPrompt = inputMode === 'modify' 
      ? 'Describe the specific changes you want...'
      : 'Share your thoughts and feedback...';

    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text color={fuegoColors.text.primary} bold>
            ✏️  {inputTitle}
          </Text>
        </Box>

        {renderContext()}
        {renderWorkPreservation()}

        <Box 
          borderStyle="round" 
          borderColor={fuegoColors.border.accent} 
          paddingX={2} 
          paddingY={1}
        >
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color={fuegoColors.text.secondary}>
                {inputPrompt}
              </Text>
            </Box>
            
            <Box flexDirection="row">
              <Text color={colors.info}>{'> '}</Text>
              <TextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleInputSubmit}
                placeholder={inputPrompt}
                showCursor
              />
            </Box>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color={fuegoColors.text.dimmed} dimColor>
            Press Enter to submit, Esc to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Render selection mode
  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          {title}
        </Text>
      </Box>

      {description && (
        <Box marginBottom={1}>
          <Text color={fuegoColors.text.secondary}>
            {description}
          </Text>
        </Box>
      )}

      {renderContext()}
      {renderWorkPreservation()}

      {/* Action buttons */}
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
              Choose your action:
            </Text>
          </Box>
          
          {approvalOptions.map((option, index) => (
            <Box key={option.key} marginBottom={1}>
              <Box flexDirection="row" alignItems="center">
                <Text color={selectedOption === index ? fuegoColors.text.primary : 'transparent'}>
                  ▶{' '}
                </Text>
                <Text 
                  color={option.color} 
                  bold={selectedOption === index}
                >
                  {option.label}
                </Text>
                <Text color={fuegoColors.text.secondary}>
                  {"  "}
                  {option.description}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Keyboard shortcuts */}
      <Box>
        <Text color={fuegoColors.text.dimmed} dimColor>
          Use A/M/F/C keys for quick action, ↑↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};