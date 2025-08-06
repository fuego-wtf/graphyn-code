import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { colors } from '../theme/colors.js';
import type { TaskStatus } from './SquadExecutorV3.js';
import type { Task } from '../../services/claude-task-generator.js';
import type { AgentConfig } from '../../services/squad-storage.js';

const exec = promisify(execCallback);

interface AgentChangesViewProps {
  taskStatus: TaskStatus;
  task: Task;
  agent: AgentConfig;
  workDir: string;
  onAccept: () => void;
  onReject: () => void;
  onBack: () => void;
}

interface GitChange {
  file: string;
  additions: number;
  deletions: number;
  status: 'A' | 'M' | 'D' | 'R'; // Added, Modified, Deleted, Renamed
}

export const AgentChangesView: React.FC<AgentChangesViewProps> = ({
  taskStatus,
  task,
  agent,
  workDir,
  onAccept,
  onReject,
  onBack
}) => {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [diffContent, setDiffContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showingDiff, setShowingDiff] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  useEffect(() => {
    loadChanges();
  }, []);

  const loadChanges = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the worktree path for this agent
      const worktreePath = taskStatus.worktreePath || workDir;
      
      // Get the list of changed files
      const { stdout: statusOutput } = await exec('git status --porcelain', { cwd: worktreePath });
      const { stdout: diffStatOutput } = await exec('git diff --stat', { cwd: worktreePath });
      
      // Parse git status output
      const fileChanges: GitChange[] = [];
      const statusLines = statusOutput.trim().split('\n').filter(line => line);
      
      for (const line of statusLines) {
        const status = line.substring(0, 2).trim() as GitChange['status'];
        const file = line.substring(3);
        
        // Get additions/deletions for this file
        try {
          const { stdout: numstat } = await exec(`git diff --numstat -- "${file}"`, { cwd: worktreePath });
          const [additions = '0', deletions = '0'] = numstat.trim().split('\t');
          
          fileChanges.push({
            file,
            status: status as GitChange['status'],
            additions: parseInt(additions) || 0,
            deletions: parseInt(deletions) || 0
          });
        } catch {
          // File might be new/deleted, use defaults
          fileChanges.push({
            file,
            status: status as GitChange['status'],
            additions: 0,
            deletions: 0
          });
        }
      }
      
      setChanges(fileChanges);
      
      // Load full diff
      const { stdout: fullDiff } = await exec('git diff', { cwd: worktreePath });
      setDiffContent(fullDiff);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changes');
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    if (showingDiff) {
      if (key.escape || input === 'q' || input === 'h') {
        setShowingDiff(false);
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedFileIndex(Math.max(0, selectedFileIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedFileIndex(Math.min(changes.length - 1, selectedFileIndex + 1));
    } else if (key.return || input === 'l') {
      if (changes.length > 0) {
        setShowingDiff(true);
      }
    } else if (input === 'a' || input === 'A') {
      onAccept();
    } else if (input === 'r' || input === 'R') {
      onReject();
    } else if (key.escape || input === 'q') {
      onBack();
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="cyan">Loading changes...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">❌ Error loading changes: {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press q to go back</Text>
        </Box>
      </Box>
    );
  }

  if (showingDiff) {
    return (
      <Box padding={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">{agent.emoji} {agent.name} - Full Diff</Text>
        </Box>
        
        <Box borderStyle="single" borderColor="gray" padding={1} flexDirection="column">
          <Text>{diffContent || 'No changes to display'}</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>ESC/q/h Back to file list</Text>
        </Box>
      </Box>
    );
  }

  const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);

  return (
    <Box padding={1} flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">{agent.emoji} {agent.name} - Task Completion Review</Text>
        <Text color="gray">Task: {task.title}</Text>
        {taskStatus.branchName && (
          <Text color="gray">Branch: {taskStatus.branchName}</Text>
        )}
      </Box>

      <Box marginBottom={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text>
          Status: <Text color="green">✓ Completed</Text> | 
          Files: <Text color="yellow">{changes.length}</Text> | 
          <Text color="green">+{totalAdditions}</Text> <Text color="red">-{totalDeletions}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Changed Files:</Text>
        {changes.length === 0 ? (
          <Text color="gray">No changes detected</Text>
        ) : (
          changes.map((change, idx) => (
            <Box key={change.file} marginLeft={1}>
              <Text color={idx === selectedFileIndex ? 'cyan' : 'white'}>
                {idx === selectedFileIndex ? '▶' : ' '} 
                <Text color={
                  change.status === 'A' ? 'green' : 
                  change.status === 'D' ? 'red' : 
                  change.status === 'M' ? 'yellow' : 'blue'
                }>
                  [{change.status}]
                </Text> {change.file} 
                <Text color="gray"> (+{change.additions}/-{change.deletions})</Text>
              </Text>
            </Box>
          ))
        )}
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
        <Text bold color="yellow">Review Actions:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="green">A Accept - Merge changes to main branch</Text>
          <Text color="red">R Reject - Agent will redo the task</Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        <Text dimColor>↑↓/jk Navigate • ↵/l View diff • A Accept • R Reject • ESC/q Back</Text>
      </Box>
    </Box>
  );
};