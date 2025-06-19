import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import fs from 'fs';
import path from 'path';
import { useStore } from '../store.js';
import { detectRepository } from '../utils/repository.js';

interface ProjectStatus {
  hasGraphynMd: boolean;
  graphynPath: string;
  lastModified?: Date;
  size?: number;
  customizations: {
    architectureDecisions: number;
    technicalLearnings: number;
    teamContext: number;
    integrationPoints: number;
  };
  repository?: {
    name: string;
    url: string;
    branch: string;
  };
}

export const Status: React.FC = () => {
  const { reset } = useStore();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    
    try {
      const graphynPath = path.join(process.cwd(), 'GRAPHYN.md');
      const hasGraphynMd = fs.existsSync(graphynPath);
      
      let projectStatus: ProjectStatus = {
        hasGraphynMd,
        graphynPath,
        customizations: {
          architectureDecisions: 0,
          technicalLearnings: 0,
          teamContext: 0,
          integrationPoints: 0
        }
      };

      if (hasGraphynMd) {
        const stats = fs.statSync(graphynPath);
        projectStatus.lastModified = stats.mtime;
        projectStatus.size = stats.size;

        // Count sections
        const content = fs.readFileSync(graphynPath, 'utf-8');
        projectStatus.customizations.architectureDecisions = (content.match(/## Architecture Decisions/g) || []).length;
        projectStatus.customizations.technicalLearnings = (content.match(/## Technical Learnings/g) || []).length;
        projectStatus.customizations.teamContext = (content.match(/## Team Context/g) || []).length;
        projectStatus.customizations.integrationPoints = (content.match(/## Integration Points/g) || []).length;
      }

      // Get repository info
      try {
        const repoInfo = await detectRepository();
        projectStatus.repository = repoInfo;
      } catch {
        // Repository detection failed
      }

      setStatus(projectStatus);
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📊 Project Status</Text>
        <Box marginTop={1}>
          <Text>Checking project status...</Text>
        </Box>
      </Box>
    );
  }

  if (!status) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📊 Project Status</Text>
        <Box marginTop={1}>
          <Text color="red">Failed to check project status</Text>
        </Box>
        <Box marginTop={2}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>📊 Project Status</Text>
      
      <Box marginTop={2} flexDirection="column">
        <Text bold>Repository Information</Text>
        <Box marginLeft={2} flexDirection="column">
          {status.repository ? (
            <>
              <Text>Name: <Text color="cyan">{status.repository.name}</Text></Text>
              <Text>Branch: <Text color="green">{status.repository.branch}</Text></Text>
              <Text>URL: <Text color="gray">{status.repository.url}</Text></Text>
            </>
          ) : (
            <Text color="yellow">Not a git repository</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text bold>GRAPHYN.md Status</Text>
        <Box marginLeft={2} flexDirection="column">
          {status.hasGraphynMd ? (
            <>
              <Text color="green">✅ GRAPHYN.md exists</Text>
              <Text>Size: <Text color="gray">{(status.size! / 1024).toFixed(1)} KB</Text></Text>
              <Text>Last modified: <Text color="gray">{status.lastModified?.toLocaleString()}</Text></Text>
            </>
          ) : (
            <Box flexDirection="column">
              <Text color="yellow">⚠️  GRAPHYN.md not found</Text>
              <Text color="gray">Run "graphyn init" to create it</Text>
            </Box>
          )}
        </Box>
      </Box>

      {status.hasGraphynMd && (
        <Box marginTop={2} flexDirection="column">
          <Text bold>Customizations</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              Architecture Decisions: 
              <Text color={status.customizations.architectureDecisions > 0 ? 'green' : 'gray'}>
                {' '}{status.customizations.architectureDecisions}
              </Text>
            </Text>
            <Text>
              Technical Learnings: 
              <Text color={status.customizations.technicalLearnings > 0 ? 'green' : 'gray'}>
                {' '}{status.customizations.technicalLearnings}
              </Text>
            </Text>
            <Text>
              Team Context: 
              <Text color={status.customizations.teamContext > 0 ? 'green' : 'gray'}>
                {' '}{status.customizations.teamContext}
              </Text>
            </Text>
            <Text>
              Integration Points: 
              <Text color={status.customizations.integrationPoints > 0 ? 'green' : 'gray'}>
                {' '}{status.customizations.integrationPoints}
              </Text>
            </Text>
          </Box>
        </Box>
      )}

      <Box marginTop={2} borderStyle="single" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text>💡 Tips:</Text>
          <Text color="gray">• Keep GRAPHYN.md updated with project decisions</Text>
          <Text color="gray">• Document learnings as you discover them</Text>
          <Text color="gray">• Share context with your team regularly</Text>
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press ESC to go back</Text>
      </Box>
    </Box>
  );
};