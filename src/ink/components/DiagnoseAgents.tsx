import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { figmaApi } from '../services/figmaApi.js';
import { figmaAuth } from '../services/figmaAuth.js';

interface DiagnosticResult {
  check: string;
  status: 'pending' | 'success' | 'error';
  details?: string;
}

export const DiagnoseAgents: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult[]>([
    { check: 'Checking OAuth tokens...', status: 'pending' },
    { check: 'Testing Figma API connection...', status: 'pending' },
    { check: 'Fetching user profile...', status: 'pending' }
  ]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const updateResult = (index: number, update: Partial<DiagnosticResult>) => {
    setResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...update };
      return newResults;
    });
  };

  const runDiagnostics = async () => {
    // Check 1: OAuth tokens
    try {
      const tokens = figmaAuth.getTokens();
      if (tokens) {
        updateResult(0, {
          status: 'success',
          details: `Access token: ${tokens.access_token.substring(0, 20)}... (expires: ${new Date(tokens.expires_at).toLocaleString()})`
        });
      } else {
        updateResult(0, {
          status: 'error',
          details: 'No tokens found in storage'
        });
        return;
      }
    } catch (error) {
      updateResult(0, {
        status: 'error',
        details: `Error checking tokens: ${error instanceof Error ? error.message : String(error)}`
      });
      return;
    }

    // Check 2: Test API connection
    try {
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaAuth.getTokens()?.access_token}`
        }
      });
      
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        updateResult(1, {
          status: 'success',
          details: `API connection successful (${response.status})`
        });
      } else {
        updateResult(1, {
          status: 'error',
          details: `API error (${response.status}): ${JSON.stringify(responseData, null, 2)}`
        });
        return;
      }
    } catch (error) {
      updateResult(1, {
        status: 'error',
        details: `Network error: ${error instanceof Error ? error.message : String(error)}`
      });
      return;
    }

    // Check 3: Get user profile
    try {
      const user = await figmaApi.getUser();
      updateResult(2, {
        status: 'success',
        details: `User: ${user.email} (${user.handle})`
      });
    } catch (error) {
      updateResult(2, {
        status: 'error',
        details: `Failed to get user: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  };

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🔍 Figma Agent Diagnostics</Text>
      </Box>
      
      {results.map((result, index) => (
        <Box key={index} marginBottom={1}>
          <Box width={30}>
            <Text>{result.check}</Text>
          </Box>
          <Box marginLeft={2}>
            {result.status === 'pending' && (
              <Text color="yellow">
                <Spinner type="dots" /> Checking...
              </Text>
            )}
            {result.status === 'success' && (
              <Text color="green">✓ Success</Text>
            )}
            {result.status === 'error' && (
              <Text color="red">✗ Failed</Text>
            )}
          </Box>
        </Box>
      ))}
      
      {results.some(r => r.details) && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
          <Text bold>Details:</Text>
          {results.map((result, index) => 
            result.details && (
              <Box key={index} marginTop={1}>
                <Text dimColor>{result.check}:</Text>
                <Box marginLeft={2}>
                  <Text color={result.status === 'error' ? 'red' : 'gray'}>
                    {result.details}
                  </Text>
                </Box>
              </Box>
            )
          )}
        </Box>
      )}
    </Box>
  );
};