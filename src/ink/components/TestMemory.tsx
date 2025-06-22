import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Loading } from './Loading.js';
import { useAPI } from '../hooks/useAPI.js';
import { useStore } from '../store.js';

interface PersistenceTest {
  threadId: string;
  key: string;
  value: string;
  timestamp: string;
}

export const TestMemory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { client } = useAPI();

  useEffect(() => {
    runPersistenceTest();
  }, []);

  const runPersistenceTest = async () => {
    if (!client) {
      setError('Not authenticated. Please run "graphyn auth" first.');
      return;
    }

    try {
      setLoading(true);
      const results: any = {
        tests: [],
        passed: 0,
        failed: 0
      };

      // Test 1: Create a thread with test data
      const testThread = await client.post<any>('/api/threads', {
        name: 'Persistence Test Thread',
        type: 'testing'
      });
      
      const threadId = testThread.id;
      results.threadId = threadId;

      // Test 2: Store test data
      const testData = {
        key: `test_${Date.now()}`,
        value: `Memory test at ${new Date().toISOString()}`,
        metadata: {
          cli_version: '0.1.51',
          test_type: 'persistence'
        }
      };

      await client.post(`/api/threads/${threadId}/persistence-test`, testData);
      
      results.tests.push({
        name: 'Store test data',
        status: 'passed',
        data: testData
      });
      results.passed++;

      // Test 3: Verify persistence
      const persistenceCheck = await client.get<any>(`/api/threads/${threadId}/persistence`);
      
      if (persistenceCheck.persisted) {
        results.tests.push({
          name: 'Verify persistence',
          status: 'passed',
          details: persistenceCheck
        });
        results.passed++;
      } else {
        results.tests.push({
          name: 'Verify persistence',
          status: 'failed',
          error: 'Thread not persisted'
        });
        results.failed++;
      }

      // Test 4: Simulate restart
      await client.post(`/api/threads/${threadId}/simulate-restart`, {});
      
      results.tests.push({
        name: 'Simulate server restart',
        status: 'passed'
      });
      results.passed++;

      // Test 5: Verify data after restart
      const afterRestart = await client.get<any>(`/api/threads/${threadId}/persistence`);
      
      if (afterRestart.persisted && afterRestart.test_data?.[testData.key] === testData.value) {
        results.tests.push({
          name: 'Data survives restart',
          status: 'passed',
          retrieved: afterRestart.test_data[testData.key]
        });
        results.passed++;
      } else {
        results.tests.push({
          name: 'Data survives restart',
          status: 'failed',
          error: 'Data lost after restart'
        });
        results.failed++;
      }

      // Test 6: Organization-wide health check
      const healthCheck = await client.get<any>('/api/threads/persistence-health');
      results.organizationHealth = healthCheck;

      setTestResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run persistence test');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Running persistence tests..." />;
  }

  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (!testResults) {
    return null;
  }

  const allPassed = testResults.failed === 0;

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={allPassed ? 'green' : 'yellow'}>
        🧪 Thread Memory Persistence Test
      </Text>
      <Text> </Text>
      
      <Box flexDirection="column" marginLeft={2}>
        <Text>Thread ID: {testResults.threadId}</Text>
        <Text> </Text>
        
        {testResults.tests.map((test: any, index: number) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text>
              {test.status === 'passed' ? '✅' : '❌'} {test.name}
            </Text>
            {test.data && (
              <Box marginLeft={2}>
                <Text dimColor>Key: {test.data.key}</Text>
                <Text dimColor>Value: {test.data.value}</Text>
              </Box>
            )}
            {test.error && (
              <Box marginLeft={2}>
                <Text color="red">Error: {test.error}</Text>
              </Box>
            )}
          </Box>
        ))}
        
        <Text> </Text>
        <Text bold>
          Summary: {testResults.passed} passed, {testResults.failed} failed
        </Text>
        
        {testResults.organizationHealth && (
          <>
            <Text> </Text>
            <Text bold>Organization Health:</Text>
            <Box marginLeft={2}>
              <Text>Total Threads: {testResults.organizationHealth.total_threads}</Text>
              <Text>Persisted: {testResults.organizationHealth.persisted_threads}</Text>
              <Text color={testResults.organizationHealth.health_status === 'healthy' ? 'green' : 'red'}>
                Status: {testResults.organizationHealth.health_status}
              </Text>
            </Box>
          </>
        )}
      </Box>
      
      <Text> </Text>
      <Text dimColor>
        💡 {allPassed 
          ? 'All persistence tests passed! Your threads will remember everything.' 
          : 'Some tests failed. Check your backend persistence configuration.'}
      </Text>
    </Box>
  );
};