import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { runDoctor, DoctorResult } from '../../utils/doctor.js';
import { installClaudeCode } from '../../setup/claude-installer.js';
import { setupFigmaMCP } from '../../setup/figma-mcp-setup.js';
import { analyzeRepository } from '../../commands/analyze.js';
import { InteractiveSquadBuilder } from './InteractiveSquadBuilder.js';
import { TaskGenerator } from './TaskGenerator.js';
import { colors } from '../theme/colors.js';
import { useAPI } from '../hooks/useAPI.js';
import inquirer from 'inquirer';

type SetupStage = 
  | 'doctor'
  | 'claude-check'
  | 'claude-install'
  | 'figma-check'
  | 'figma-setup'
  | 'repo-analyze'
  | 'squad-builder'
  | 'task-generation'
  | 'complete';

interface AutoSetupProps {
  onComplete: () => void;
}

export const AutoSetup: React.FC<AutoSetupProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<SetupStage>('doctor');
  const [doctorResult, setDoctorResult] = useState<DoctorResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [squad, setSquad] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useAPI();

  useEffect(() => {
    runSetupFlow();
  }, []);

  const runSetupFlow = async () => {
    try {
      // Stage 1: Doctor check
      setLoading(true);
      const doctor = await runDoctor();
      setDoctorResult(doctor);
      setLoading(false);

      // Stage 2: Claude Code check
      if (doctor.needsClaudeCode) {
        setStage('claude-check');
        const { installClaude } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'installClaude',
            message: 'Claude Code is required. Would you like to install it automatically?',
            default: true
          }
        ]);

        if (installClaude) {
          setStage('claude-install');
          const result = await installClaudeCode();
          if (!result.success) {
            throw new Error('Claude Code installation failed');
          }
          
          // Re-run doctor to verify
          const newDoctor = await runDoctor();
          setDoctorResult(newDoctor);
          
          if (newDoctor.needsClaudeCode) {
            throw new Error('Claude Code still not detected after installation');
          }
        } else {
          throw new Error('Claude Code is required to continue');
        }
      }

      // Stage 3: Figma MCP check
      if (doctor.needsFigmaMCP) {
        setStage('figma-check');
        const { setupFigma } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setupFigma',
            message: 'Would you like to set up Figma MCP for design extraction?',
            default: true
          }
        ]);

        if (setupFigma) {
          setStage('figma-setup');
          await setupFigmaMCP();
        }
      }

      // Stage 4: Repository analysis
      setStage('repo-analyze');
      if (doctor.hasRepository) {
        setLoading(true);
        const analysis = await analyzeRepository({ mode: 'detailed', save: true });
        setAnalysisResult(analysis);
        setLoading(false);
      }

      // Continue to squad builder
      setStage('squad-builder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      setLoading(false);
    }
  };

  const handleSquadAccept = (acceptedSquad: any) => {
    setSquad(acceptedSquad);
    setStage('task-generation');
  };

  const handleSquadFeedback = async (feedback: string) => {
    // Send feedback to API and get updated squad
    try {
      // This would call the actual API
      console.log('Squad feedback:', feedback);
      // For now, just show loading
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (err) {
      setError('Failed to update squad');
    }
  };

  const handleTaskAccept = (acceptedTasks: any) => {
    setTasks(acceptedTasks);
    setStage('complete');
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const handleTaskFeedback = async (feedback: string) => {
    // Send feedback to API and get updated tasks
    try {
      console.log('Task feedback:', feedback);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (err) {
      setError('Failed to update tasks');
    }
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>❌ Setup Error</Text>
        <Text color="red">{error}</Text>
        <Box marginTop={1}>
          <Text color={colors.dim}>Please fix the issue and try again.</Text>
        </Box>
      </Box>
    );
  }

  // Doctor stage
  if (stage === 'doctor' && loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Running system diagnostics...</Text>
        </Box>
      </Box>
    );
  }

  // Claude installation
  if (stage === 'claude-install') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">🤖 Installing Claude Code</Text>
        <Text color={colors.dim}>Please follow the installation prompts...</Text>
      </Box>
    );
  }

  // Figma setup
  if (stage === 'figma-setup') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">🎨 Setting up Figma MCP</Text>
        <Text color={colors.dim}>Configuring design extraction capabilities...</Text>
      </Box>
    );
  }

  // Repository analysis
  if (stage === 'repo-analyze' && loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Analyzing repository...</Text>
        </Box>
        <Text color={colors.dim}>Detecting frameworks, patterns, and architecture...</Text>
      </Box>
    );
  }

  // Squad builder
  if (stage === 'squad-builder') {
    if (!analysisResult) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="yellow">⚠️  No Repository Analysis</Text>
          <Text>Would you like to proceed without repository context?</Text>
          <Text color={colors.dim}>Squad recommendations will be less accurate.</Text>
        </Box>
      );
    }

    return (
      <InteractiveSquadBuilder
        threadId="setup-thread"
        initialSquad={squad}
        onAccept={handleSquadAccept}
        onRequestChanges={handleSquadFeedback}
        onBack={() => setStage('repo-analyze')}
      />
    );
  }

  // Task generation
  if (stage === 'task-generation') {
    return (
      <TaskGenerator
        squad={squad}
        onAccept={handleTaskAccept}
        onRequestChanges={handleTaskFeedback}
        onBack={() => setStage('squad-builder')}
      />
    );
  }

  // Complete
  if (stage === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">🎉 Setup Complete!</Text>
        <Box marginTop={1}>
          <Text>Your development squad is ready with {tasks?.tasks?.length || 0} tasks.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>Launching Graphyn Code...</Text>
        </Box>
      </Box>
    );
  }

  return null;
};