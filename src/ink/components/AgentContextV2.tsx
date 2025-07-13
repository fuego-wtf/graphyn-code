import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { useStore } from '../store.js';
import { useClaude } from '../hooks/useClaude.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AgentContextProps {
  agent: string;
  query: string;
}

type LaunchStatus = 'preparing' | 'checking' | 'launching' | 'success' | 'fallback' | 'error';

export const AgentContextV2: React.FC<AgentContextProps> = ({ agent, query }) => {
  const { exit } = useApp();
  const { setLoading, setError } = useStore();
  const { launchClaude, checkClaude } = useClaude();
  
  const [status, setStatus] = useState<LaunchStatus>('preparing');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tempFile, setTempFile] = useState<string | null>(null);
  const [hasLaunched, setHasLaunched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    const launch = async () => {
      if (!cancelled) {
        await prepareAndLaunch();
      }
    };
    
    launch();
    
    return () => {
      cancelled = true;
    };
  }, [agent, query]);

  const prepareAndLaunch = async () => {
    // Prevent multiple launches
    if (hasLaunched) return;
    
    try {
      setHasLaunched(true);
      setLoading(true);
      setError(null);

      // Step 1: Check Claude availability
      setStatus('checking');
      setProgress(20);
      
      const claudeResult = await checkClaude();
      
      if (!claudeResult.found) {
        setStatus('error');
        setErrorMessage('Claude Code not found');
        setLoading(false);
        return;
      }

      // Step 2: Load agent prompt
      setStatus('preparing');
      setProgress(40);
      
      const agentPrompt = await loadAgentPrompt(agent);
      
      // Step 3: Load project context
      setProgress(60);
      
      const projectContext = await loadProjectContext();
      
      // Step 4: Combine context
      setProgress(80);
      
      const fullContext = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent Context

${agentPrompt}

${projectContext ? `# Project Context (from GRAPHYN.md)\n${projectContext}\n\n` : ''}

# User Query
${query}

# Instructions
Please analyze the above query in the context of the ${agent} agent role and provide a comprehensive response.`;

      // Step 5: Launch Claude
      setStatus('launching');
      setProgress(90);
      
      const result = await launchClaude({
        content: fullContext,
        agent,
        projectContext,
        saveToHistory: true
      });

      setProgress(100);
      
      if (result.success) {
        if (result.tempFile) {
          setTempFile(result.tempFile);
          setStatus('fallback');
        } else {
          setStatus('success');
        }
        
        // Exit after showing status briefly
        setTimeout(() => {
          exit();
        }, result.tempFile ? 3000 : 500);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to launch Claude');
      }
      
      setLoading(false);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  };

  const loadAgentPrompt = async (agentName: string): Promise<string> => {
    // Try multiple paths for prompts
    const promptPaths = [
      path.join(__dirname, '..', '..', '..', 'prompts', `${agentName}.md`),
      path.join(__dirname, '..', '..', 'prompts', `${agentName}.md`),
      path.join(__dirname, '..', 'prompts', `${agentName}.md`),
      path.join(__dirname, 'prompts', `${agentName}.md`),
      path.join(process.cwd(), 'prompts', `${agentName}.md`)
    ];
    
    for (const promptPath of promptPaths) {
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf-8');
      }
    }
    
    // Fallback content
    return `# ${agentName.charAt(0).toUpperCase() + agentName.slice(1)} Agent\n\nYou are a helpful ${agentName} development assistant.`;
  };

  const loadProjectContext = async (): Promise<string> => {
    const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
    if (fs.existsSync(graphynPath)) {
      return fs.readFileSync(graphynPath, 'utf-8');
    }
    return '';
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
      case 'checking':
      case 'launching':
        return <Spinner type="dots" />;
      case 'success':
        return '✅';
      case 'fallback':
        return '📄';
      case 'error':
        return '❌';
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing context...';
      case 'checking':
        return 'Checking Claude Code...';
      case 'launching':
        return 'Launching Claude Code...';
      case 'success':
        return 'Claude Code launched!';
      case 'fallback':
        return 'Context saved to file';
      case 'error':
        return errorMessage || 'An error occurred';
      default:
        return '';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {agent.charAt(0).toUpperCase() + agent.slice(1)} Agent
      </Text>
      
      <Box marginTop={1}>
        <Text>
          {getStatusIcon()} {getStatusMessage()}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text>
          [{'█'.repeat(Math.floor(progress / 10)).padEnd(10, '░')}] {progress}%
        </Text>
      </Box>
      
      {status === 'success' && (
        <Box marginTop={1}>
          <Text color="green">✅ Claude Code is now handling your request!</Text>
        </Box>
      )}
      
      {status === 'fallback' && tempFile && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">📄 Large context saved to file</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>To use this context in Claude:</Text>
            <Text color="cyan">1. Run: claude</Text>
            <Text color="cyan">2. Use: /read {tempFile}</Text>
          </Box>
        </Box>
      )}
      
      {status === 'error' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">❌ {errorMessage}</Text>
          {errorMessage?.includes('not found') && (
            <Box marginTop={1} flexDirection="column">
              <Text>To install Claude Code:</Text>
              <Text color="cyan">1. Visit https://claude.ai/code</Text>
              <Text color="cyan">2. Download and install for your platform</Text>
              <Text color="cyan">3. Run "graphyn doctor" to verify</Text>
            </Box>
          )}
        </Box>
      )}
      
      <Box marginTop={2}>
        <Text dimColor>
          {status === 'error' || status === 'fallback' ? 'Press any key to exit' : 'Launching...'}
        </Text>
      </Box>
    </Box>
  );
};