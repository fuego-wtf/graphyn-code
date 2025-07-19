import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { findClaude } from '../../utils/claude-detector.js';
import { ConfigManager } from '../../config-manager.js';
import { GraphynAPIClient } from '../../api-client.js';
import { config as appConfig } from '../../config.js';

interface Check {
  name: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning';
  message?: string;
}

export const Doctor: React.FC = () => {
  const [checks, setChecks] = useState<Check[]>([
    { name: 'Node.js Version', status: 'pending' },
    { name: 'Claude Code Installation', status: 'pending' },
    { name: 'Authentication Status', status: 'pending' },
    { name: 'API Connection', status: 'pending' },
    { name: 'Git Installation', status: 'pending' },
    { name: 'Project Structure', status: 'pending' },
    { name: 'Network Connectivity', status: 'pending' },
    { name: 'Configuration Files', status: 'pending' }
  ]);
  const [currentCheck, setCurrentCheck] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    runChecks();
  }, []);

  const updateCheck = (index: number, status: Check['status'], message?: string) => {
    setChecks(prev => {
      const newChecks = [...prev];
      newChecks[index] = { ...newChecks[index], status, message };
      return newChecks;
    });
  };

  const runChecks = async () => {
    // Check 1: Node.js Version
    setCurrentCheck(0);
    updateCheck(0, 'checking');
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
      
      if (majorVersion >= 16) {
        updateCheck(0, 'pass', `Node.js ${nodeVersion} ✓`);
      } else {
        updateCheck(0, 'fail', `Node.js ${nodeVersion} (requires >= 16.0.0)`);
      }
    } catch (error) {
      updateCheck(0, 'fail', 'Could not determine Node.js version');
    }

    // Check 2: Claude Code Installation
    setCurrentCheck(1);
    updateCheck(1, 'checking');
    try {
      const claudeResult = await findClaude();
      
      if (claudeResult.found && claudeResult.path) {
        updateCheck(1, 'pass', `Found at: ${claudeResult.path}`);
      } else {
        updateCheck(1, 'fail', 'Claude Code not found. Install from https://claude.ai/code');
      }
    } catch (error) {
      updateCheck(1, 'fail', 'Error checking Claude Code installation');
    }

    // Check 3: Authentication Status
    setCurrentCheck(2);
    updateCheck(2, 'checking');
    try {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      
      if (token) {
        updateCheck(2, 'pass', 'Authenticated');
      } else {
        updateCheck(2, 'warning', 'Not authenticated. Run "graphyn auth"');
      }
    } catch (error) {
      updateCheck(2, 'fail', 'Error checking authentication');
    }

    // Check 4: API Connection
    setCurrentCheck(3);
    updateCheck(3, 'checking');
    try {
      const apiClient = new GraphynAPIClient();
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      
      if (token) {
        apiClient.setToken(token);
      }
      
      await apiClient.ping();
      updateCheck(3, 'pass', `Connected to ${appConfig.apiBaseUrl}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        updateCheck(3, 'warning', 'Backend not available - some features limited');
      } else {
        updateCheck(3, 'fail', 'Cannot connect to API');
      }
    }

    // Check 5: Git Installation
    setCurrentCheck(4);
    updateCheck(4, 'checking');
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
      updateCheck(4, 'pass', gitVersion);
    } catch (error) {
      updateCheck(4, 'warning', 'Git not found - repository features disabled');
    }

    // Check 6: Project Structure
    setCurrentCheck(5);
    updateCheck(5, 'checking');
    try {
      const isGitRepo = existsSync(path.join(process.cwd(), '.git'));
      const hasPackageJson = existsSync(path.join(process.cwd(), 'package.json'));
      const hasGraphynMd = existsSync(path.join(process.cwd(), 'GRAPHYN.md'));
      
      if (isGitRepo && hasPackageJson) {
        updateCheck(5, 'pass', `Valid project${hasGraphynMd ? ' with GRAPHYN.md' : ''}`);
      } else if (!isGitRepo) {
        updateCheck(5, 'warning', 'Not a git repository');
      } else {
        updateCheck(5, 'warning', 'No package.json found');
      }
    } catch (error) {
      updateCheck(5, 'fail', 'Error checking project structure');
    }

    // Check 7: Network Connectivity
    setCurrentCheck(6);
    updateCheck(6, 'checking');
    try {
      // Try to resolve a common DNS name
      execSync('ping -c 1 -t 2 github.com > /dev/null 2>&1', { encoding: 'utf-8' });
      updateCheck(6, 'pass', 'Internet connection available');
    } catch (error) {
      updateCheck(6, 'warning', 'Limited network connectivity');
    }

    // Check 8: Configuration Files
    setCurrentCheck(7);
    updateCheck(7, 'checking');
    try {
      const graphynDir = path.join(os.homedir(), '.graphyn');
      const hasConfig = existsSync(path.join(graphynDir, 'config.json'));
      const hasAuth = existsSync(path.join(graphynDir, 'auth.json'));
      
      if (hasConfig || hasAuth) {
        updateCheck(7, 'pass', 'Configuration files found');
      } else {
        updateCheck(7, 'pass', 'No configuration files (fresh install)');
      }
    } catch (error) {
      updateCheck(7, 'fail', 'Error checking configuration');
    }

    setComplete(true);
  };

  const getStatusIcon = (status: Check['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'checking': return '🔄';
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
    }
  };

  const getStatusColor = (status: Check['status']) => {
    switch (status) {
      case 'pass': return 'green';
      case 'fail': return 'red';
      case 'warning': return 'yellow';
      default: return 'gray';
    }
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🩺 System Check</Text>
      
      <Box marginTop={1} flexDirection="column">
        {checks.map((check, index) => (
          <Box key={check.name} marginBottom={0}>
            <Box width={30}>
              <Text>
                {getStatusIcon(check.status)} {check.name}
                {check.status === 'checking' && (
                  <Text color="cyan">
                    {' '}<Spinner type="dots" />
                  </Text>
                )}
              </Text>
            </Box>
            {check.message && (
              <Text color={getStatusColor(check.status)} dimColor>
                {check.message}
              </Text>
            )}
          </Box>
        ))}
      </Box>
      
      {complete && (
        <>
          <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Box>
              <Text>Summary: </Text>
              <Text color="green">{passCount} passed</Text>
              {failCount > 0 && (
                <>
                  <Text>, </Text>
                  <Text color="red">{failCount} failed</Text>
                </>
              )}
              {warningCount > 0 && (
                <>
                  <Text>, </Text>
                  <Text color="yellow">{warningCount} warnings</Text>
                </>
              )}
            </Box>
          </Box>
          
          {failCount > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold color="red">⚠️  Some checks failed</Text>
              <Text dimColor>Please address the issues above for optimal functionality.</Text>
            </Box>
          )}
          
          {failCount === 0 && warningCount === 0 && (
            <Box marginTop={1}>
              <Text color="green" bold>🎉 All systems operational!</Text>
            </Box>
          )}
          
          <Box marginTop={2}>
            <Text dimColor>Press ESC to return to menu</Text>
          </Box>
        </>
      )}
    </Box>
  );
};