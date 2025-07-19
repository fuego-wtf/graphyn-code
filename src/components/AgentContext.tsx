import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fetchAgentPrompt } from '../agents.js';
import { useStore } from '../store.js';

interface AgentContextProps {
  agent: string;
  query: string;
}

export const AgentContext: React.FC<AgentContextProps> = ({ agent, query }) => {
  const { setLoading, setError, setContextPrepared } = useStore();
  const [status, setStatus] = useState('Fetching agent prompt...');
  const [contextPath, setContextPath] = useState('');

  useEffect(() => {
    prepareContext();
  }, [agent, query]);

  const prepareContext = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch agent prompt
      setStatus('Fetching agent prompt...');
      const agentPrompt = await fetchAgentPrompt(agent);
      
      // Read GRAPHYN.md if exists
      setStatus('Reading project context...');
      let graphynContent = '';
      const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
      if (fs.existsSync(graphynPath)) {
        graphynContent = fs.readFileSync(graphynPath, 'utf-8');
      }

      // Prepare full context
      setStatus('Preparing context...');
      const fullContext = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent Context

${agentPrompt}

# Project Context (from GRAPHYN.md)
${graphynContent || 'No GRAPHYN.md found in current directory.'}

# User Query
${query}

# Instructions
Please analyze the above query in the context of the ${agent} agent role and provide a comprehensive response.`;

      // Save to temp file
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `graphyn-${agent}-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, fullContext);
      setContextPath(tmpFile);

      // Schedule cleanup
      setTimeout(() => {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }, 5 * 60 * 1000); // 5 minutes

      setStatus('Context ready!');
      setLoading(false);
      setContextPrepared(true);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text>
        <Spinner type="dots" /> {status}
      </Text>
      {contextPath && (
        <Box marginTop={1}>
          <Text dimColor>Context saved to: {contextPath}</Text>
        </Box>
      )}
    </Box>
  );
};