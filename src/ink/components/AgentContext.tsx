import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { useStore } from '../store.js';
import { findClaude } from '../../utils/claude-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AgentContextProps {
  agent: string;
  query: string;
}

export const AgentContext: React.FC<AgentContextProps> = ({ agent, query }) => {
  const { exit } = useApp();
  const { setLoading, setError, setContextPath, setMode, setClaudeSessionActive } = useStore();
  const [status, setStatus] = useState('Preparing context...');
  const [progress, setProgress] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    prepareContext();
  }, [agent, query]);

  const prepareContext = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Read agent prompt
      setStatus('Loading agent prompt...');
      setProgress(25);
      
      // Try multiple paths for prompts
      const promptPaths = [
        path.join(__dirname, '..', '..', 'prompts', `${agent}.md`),
        path.join(__dirname, '..', 'prompts', `${agent}.md`), 
        path.join(__dirname, 'prompts', `${agent}.md`),
        path.join(process.cwd(), 'prompts', `${agent}.md`)
      ];
      
      let agentPrompt = '';
      let promptFound = false;
      
      for (const promptPath of promptPaths) {
        if (fs.existsSync(promptPath)) {
          agentPrompt = fs.readFileSync(promptPath, 'utf-8');
          promptFound = true;
          break;
        }
      }
      
      if (!promptFound) {
        // Fallback content
        agentPrompt = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent\n\nYou are a helpful ${agent} development assistant.`;
      }

      // Step 2: Read project context
      setStatus('Reading project context...');
      setProgress(50);
      
      let projectContext = '';
      const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
      if (fs.existsSync(graphynPath)) {
        projectContext = fs.readFileSync(graphynPath, 'utf-8');
      }

      // Step 3: Combine context
      setStatus('Preparing final context...');
      setProgress(75);
      
      const fullContext = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent Context

${agentPrompt}

${projectContext ? `# Project Context (from GRAPHYN.md)\n${projectContext}\n\n` : ''}

# User Query
${query}

# Instructions
Please analyze the above query in the context of the ${agent} agent role and provide a comprehensive response.`;

      // Step 4: Save to temp file
      setStatus('Saving context...');
      setProgress(90);
      
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `graphyn-${agent}-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, fullContext);
      setContextPath(tmpFile);

      // Cleanup after 5 minutes
      setTimeout(() => {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }, 5 * 60 * 1000);

      setProgress(100);
      setStatus('Context ready!');
      setLoading(false);

      // Launch Claude Code directly
      setTimeout(async () => {
        const claudeResult = await findClaude();
        
        if (claudeResult.found && claudeResult.path) {
          console.log('\n✅ Agent context prepared!\n');
          console.log('🚀 Launching Claude Code with ' + agent + ' agent context...\n');
          
          // Exit Ink first to release terminal
          exit();
          
          // Then launch Claude after a brief delay
          setTimeout(() => {
            try {
              // Use the proven direct launch approach
              const escapedContent = fullContext
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/`/g, '\\`')
                .replace(/\$/g, '\\$');
              
              execSync(`"${claudeResult.path}" "${escapedContent}"`, { 
                stdio: 'inherit'
              });
            } catch (error) {
              // Claude exited - this is normal
            }
          }, 100);
        } else {
          // Claude not found
          console.log('\n⚠️  Claude Code not found.');
          console.log('\nTo install Claude Code:');
          console.log('1. Visit https://claude.ai/code');
          console.log('2. Download and install for your platform');
          console.log('3. Run "graphyn doctor" to verify installation\n');
          console.log('\nContext saved to:');
          console.log(tmpFile);
          
          // Exit after showing error
          setTimeout(() => {
            exit();
          }, 2000);
        }
      }, 300);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  };

  // Show monitoring UI if Claude is running
  if (isMonitoring) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">✅ Claude Code Launched!</Text>
        
        <Box marginTop={1} flexDirection="column">
          <Text>👀 Monitoring active session in new terminal...</Text>
          
          <Box marginTop={1}>
            <Text dimColor>Agent: {agent.charAt(0).toUpperCase() + agent.slice(1)}</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text dimColor>Query: {query}</Text>
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Press Ctrl+C to exit when done</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Show progress UI while preparing
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {agent.charAt(0).toUpperCase() + agent.slice(1)} Agent
      </Text>
      
      <Box marginTop={1}>
        <Text>
          <Spinner type="dots" /> {status}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text>
          [{'█'.repeat(Math.floor(progress / 10)).padEnd(10, '░')}] {progress}%
        </Text>
      </Box>
      
      {progress === 100 && status === 'Claude Code running in new terminal' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">✅ Claude Code launched!</Text>
          <Box marginTop={1}>
            <Text>👀 Monitoring active session...</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Ctrl+C to exit when done</Text>
          </Box>
        </Box>
      )}
      
      {progress === 100 && status === 'Ready - Manual launch required' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">⚠️  Manual launch required</Text>
          <Box marginTop={1}>
            <Text dimColor>Check the instructions above</Text>
          </Box>
        </Box>
      )}
      
      {progress === 100 && status === 'Claude Code not found' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">❌ Claude Code not installed</Text>
          <Box marginTop={1}>
            <Text dimColor>See installation instructions above</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};