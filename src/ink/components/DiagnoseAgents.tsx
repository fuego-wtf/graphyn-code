import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Loading } from './Loading.js';
import { useAPI } from '../hooks/useAPI.js';

export const DiagnoseAgents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { client } = useAPI();

  useEffect(() => {
    runDiagnosis();
  }, []);

  const runDiagnosis = async () => {
    if (!client) {
      setError('Not authenticated. Please run "graphyn auth" first.');
      setLoading(false);
      return;
    }

    try {
      const results: any = {
        apiEndpoints: {},
        agentData: {},
        lettaIntegration: {}
      };

      // Check available agents endpoint
      try {
        const availableAgents = await client.get<any>('/api/agents/available');
        results.apiEndpoints.available = {
          status: 'success',
          count: availableAgents.agents?.length || 0,
          agents: availableAgents.agents?.map((a: any) => ({
            id: a.id,
            name: a.name,
            hasPrompt: !!a.configuration?.prompt,
            hasTools: !!(a.configuration?.tools?.length > 0),
            created_by: a.created_by
          }))
        };
      } catch (err) {
        results.apiEndpoints.available = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed'
        };
      }

      // Check regular agents endpoint
      try {
        const agents = await client.get<any>('/api/agents');
        results.apiEndpoints.list = {
          status: 'success',
          count: agents.agents?.length || 0
        };
      } catch (err) {
        results.apiEndpoints.list = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed'
        };
      }

      // Check Letta agents endpoint
      try {
        const lettaAgents = await client.get<any>('/api/letta/agents');
        results.lettaIntegration = {
          status: 'success',
          count: lettaAgents.agents?.length || 0,
          hasRealAgents: lettaAgents.agents?.length > 0,
          agents: lettaAgents.agents?.slice(0, 3).map((a: any) => ({
            id: a.id,
            name: a.name,
            model: a.model,
            hasMemory: !!a.memory
          }))
        };
      } catch (err) {
        results.lettaIntegration = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed'
        };
      }

      // Analyze results
      const availableAgents = results.apiEndpoints.available?.agents || [];
      const hasRealPrompts = availableAgents.some((a: any) => a.hasPrompt);
      const hasRealTools = availableAgents.some((a: any) => a.hasTools);
      const allSystemCreated = availableAgents.every((a: any) => a.created_by === 'system');

      results.diagnosis = {
        usingMockData: !hasRealPrompts && !hasRealTools && allSystemCreated,
        hasLettaIntegration: results.lettaIntegration.hasRealAgents,
        recommendations: []
      };

      if (results.diagnosis.usingMockData) {
        results.diagnosis.recommendations.push(
          'Agents appear to be using fallback/mock data',
          'No real prompts or tools configured',
          'Backend may need to implement real agent storage'
        );
      }

      if (!results.lettaIntegration.hasRealAgents) {
        results.diagnosis.recommendations.push(
          'No Letta agents found',
          'Letta integration may not be configured'
        );
      }

      setDiagnosis(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Diagnosing agent system..." />;
  }

  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (!diagnosis) return null;

  const { usingMockData, hasLettaIntegration } = diagnosis.diagnosis;

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">🔍 Agent System Diagnosis</Text>
      <Text> </Text>
      
      <Text bold>API Endpoints:</Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>
          /api/agents/available: {diagnosis.apiEndpoints.available.status === 'success' 
            ? `✅ ${diagnosis.apiEndpoints.available.count} agents` 
            : `❌ ${diagnosis.apiEndpoints.available.error}`}
        </Text>
        <Text>
          /api/agents: {diagnosis.apiEndpoints.list.status === 'success'
            ? `✅ ${diagnosis.apiEndpoints.list.count} agents`
            : `❌ ${diagnosis.apiEndpoints.list.error}`}
        </Text>
        <Text>
          /api/letta/agents: {diagnosis.lettaIntegration.status === 'success'
            ? `✅ ${diagnosis.lettaIntegration.count} agents`
            : `❌ ${diagnosis.lettaIntegration.error}`}
        </Text>
      </Box>

      <Text> </Text>
      <Text bold>Available Agents Analysis:</Text>
      {diagnosis.apiEndpoints.available.agents?.map((agent: any, i: number) => (
        <Box key={i} flexDirection="column" marginLeft={2}>
          <Text>
            • {agent.name} ({agent.id})
            {agent.hasPrompt ? ' ✅ Has prompt' : ' ❌ No prompt'}
            {agent.hasTools ? ' ✅ Has tools' : ' ❌ No tools'}
          </Text>
        </Box>
      ))}

      <Text> </Text>
      <Text bold color={usingMockData ? 'yellow' : 'green'}>
        Status: {usingMockData ? '⚠️  Using Mock/Fallback Agents' : '✅ Using Real Agents'}
      </Text>
      
      {diagnosis.diagnosis.recommendations.length > 0 && (
        <>
          <Text> </Text>
          <Text bold>Recommendations:</Text>
          {diagnosis.diagnosis.recommendations.map((rec: string, i: number) => (
            <Box key={i} marginLeft={2}>
              <Text>• {rec}</Text>
            </Box>
          ))}
        </>
      )}

      <Text> </Text>
      <Text dimColor>
        💡 For real agent functionality, ensure:
        {'\n'}   - Backend has implemented agent storage
        {'\n'}   - Letta is properly integrated
        {'\n'}   - Agent configurations include prompts and tools
      </Text>
    </Box>
  );
};