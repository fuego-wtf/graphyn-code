import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { colors, fuegoColors } from '../theme/colors.js';
import { GlassBox, AnimatedStatusIcon } from './SquadExecutorUI.js';
import type { TaskStatus } from './SquadExecutorV3.js';

const exec = promisify(execCallback);

interface WorktreeInfo {
  taskId: string;
  agentName: string;
  worktreePath: string;
  branchName: string;
  changes?: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    files: string[];
  };
  hasChanges: boolean;
}

interface WorktreeCommitFlowProps {
  taskStatuses: Map<string, TaskStatus>;
  onComplete: () => void;
  onCommit: (taskId: string, commitMessage: string) => void;
}

const WorktreeItem: React.FC<{
  worktree: WorktreeInfo;
  isSelected: boolean;
  onToggle: () => void;
  isChecked: boolean;
}> = ({ worktree, isSelected, onToggle, isChecked }) => {
  return (
    <Box paddingLeft={1}>
      <Text color={isSelected ? fuegoColors.accent.cyan : 'white'}>
        {isSelected ? '▶' : ' '}
      </Text>
      <Text> </Text>
      <Text color={isChecked ? 'green' : 'gray'}>
        [{isChecked ? '✓' : ' '}]
      </Text>
      <Text> </Text>
      <Text color={worktree.hasChanges ? 'white' : 'gray'}>
        {worktree.agentName}
      </Text>
      <Text color="gray"> - </Text>
      <Text color="cyan">{worktree.branchName}</Text>
      {worktree.changes && worktree.hasChanges && (
        <>
          <Text color="gray"> (</Text>
          <Text color="green">+{worktree.changes.insertions}</Text>
          <Text color="gray">/</Text>
          <Text color="red">-{worktree.changes.deletions}</Text>
          <Text color="gray"> in {worktree.changes.filesChanged} files)</Text>
        </>
      )}
      {!worktree.hasChanges && (
        <Text color="gray"> (no changes)</Text>
      )}
    </Box>
  );
};

export const WorktreeCommitFlow: React.FC<WorktreeCommitFlowProps> = ({
  taskStatuses,
  onComplete,
  onCommit
}) => {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedWorktrees, setCheckedWorktrees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'review' | 'commit'>('select');
  const [commitMessages, setCommitMessages] = useState<Map<string, string>>(new Map());
  
  // Load worktree information
  useEffect(() => {
    const loadWorktrees = async () => {
      setLoading(true);
      const worktreeList: WorktreeInfo[] = [];
      
      for (const [taskId, status] of taskStatuses) {
        if (status.worktreePath && status.branchName) {
          try {
            // Check if there are changes in the worktree
            const statusResult = await exec('git status --porcelain', { 
              cwd: status.worktreePath 
            });
            
            const hasChanges = statusResult.stdout.trim().length > 0;
            
            let changes;
            if (hasChanges) {
              // Get diff stats
              const diffResult = await exec('git diff --stat', { 
                cwd: status.worktreePath 
              });
              
              // Parse the stats
              const lines = diffResult.stdout.trim().split('\n');
              const files = lines.slice(0, -1).map(line => line.split('|')[0].trim());
              const summary = lines[lines.length - 1];
              
              const filesChanged = files.length;
              const insertionsMatch = summary.match(/(\d+) insertions?\(\+\)/);
              const deletionsMatch = summary.match(/(\d+) deletions?\(-\)/);
              
              changes = {
                filesChanged,
                insertions: insertionsMatch ? parseInt(insertionsMatch[1]) : 0,
                deletions: deletionsMatch ? parseInt(deletionsMatch[1]) : 0,
                files
              };
            }
            
            worktreeList.push({
              taskId,
              agentName: status.agentName,
              worktreePath: status.worktreePath,
              branchName: status.branchName,
              changes,
              hasChanges
            });
            
            // Auto-check worktrees with changes
            if (hasChanges) {
              setCheckedWorktrees(prev => new Set(prev).add(taskId));
            }
          } catch (error) {
            console.error(`Failed to check worktree status for ${status.agentName}:`, error);
          }
        }
      }
      
      setWorktrees(worktreeList);
      setLoading(false);
    };
    
    loadWorktrees();
  }, [taskStatuses]);
  
  // Handle keyboard input
  useInput((input, key) => {
    if (mode === 'select') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex(Math.min(worktrees.length - 1, selectedIndex + 1));
      } else if (input === ' ' || key.return) {
        const worktree = worktrees[selectedIndex];
        if (worktree.hasChanges) {
          setCheckedWorktrees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(worktree.taskId)) {
              newSet.delete(worktree.taskId);
            } else {
              newSet.add(worktree.taskId);
            }
            return newSet;
          });
        }
      } else if (input === 'a') {
        // Select all with changes
        const allWithChanges = worktrees
          .filter(w => w.hasChanges)
          .map(w => w.taskId);
        setCheckedWorktrees(new Set(allWithChanges));
      } else if (input === 'n') {
        // Deselect all
        setCheckedWorktrees(new Set());
      } else if (input === 'r' && checkedWorktrees.size > 0) {
        setMode('review');
      } else if (input === 'c' && checkedWorktrees.size > 0) {
        commitSelectedWorktrees();
      } else if (input === 's') {
        // Skip commit and complete
        onComplete();
      } else if (key.escape || input === 'q') {
        onComplete();
      }
    } else if (mode === 'review') {
      if (key.escape || input === 'b') {
        setMode('select');
      }
    }
  });
  
  const commitSelectedWorktrees = async () => {
    setMode('commit');
    
    for (const taskId of checkedWorktrees) {
      const worktree = worktrees.find(w => w.taskId === taskId);
      if (!worktree) continue;
      
      try {
        // Stage all changes
        await exec('git add -A', { cwd: worktree.worktreePath });
        
        // Create commit message
        const task = Array.from(taskStatuses.values()).find(t => t.taskId === taskId);
        const defaultMessage = `feat: ${task?.agentName} completed task\n\nImplemented by ${worktree.agentName} agent in worktree`;
        
        // Commit
        await exec(`git commit -m "${defaultMessage}"`, { cwd: worktree.worktreePath });
        
        // Store commit message
        setCommitMessages(prev => new Map(prev).set(taskId, defaultMessage));
        
        onCommit(taskId, defaultMessage);
      } catch (error) {
        console.error(`Failed to commit worktree ${worktree.agentName}:`, error);
      }
    }
    
    // Show success message
    setTimeout(() => {
      onComplete();
    }, 2000);
  };
  
  if (loading) {
    return (
      <GlassBox borderColor="cyan">
        <Box padding={1}>
          <Text color="cyan">Loading worktree information...</Text>
        </Box>
      </GlassBox>
    );
  }
  
  if (error) {
    return (
      <GlassBox borderColor="red">
        <Box padding={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      </GlassBox>
    );
  }
  
  if (mode === 'commit') {
    return (
      <GlassBox borderColor="green">
        <Box padding={1} flexDirection="column">
          <Text color="green" bold>✅ Committing changes...</Text>
          <Box marginTop={1} flexDirection="column">
            {Array.from(checkedWorktrees).map(taskId => {
              const worktree = worktrees.find(w => w.taskId === taskId);
              const message = commitMessages.get(taskId);
              return (
                <Box key={taskId}>
                  <AnimatedStatusIcon status="completed" />
                  <Text> {worktree?.agentName}: </Text>
                  <Text color="gray">{message ? 'Committed' : 'Processing...'}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </GlassBox>
    );
  }
  
  if (mode === 'review') {
    return (
      <GlassBox borderColor="cyan">
        <Box padding={1} flexDirection="column">
          <Text bold color="cyan">📋 Review Changes</Text>
          <Box marginTop={1} flexDirection="column">
            {Array.from(checkedWorktrees).map(taskId => {
              const worktree = worktrees.find(w => w.taskId === taskId);
              if (!worktree || !worktree.changes) return null;
              
              return (
                <Box key={taskId} flexDirection="column" marginBottom={1}>
                  <Text color="yellow">{worktree.agentName} ({worktree.branchName}):</Text>
                  {worktree.changes.files.slice(0, 5).map((file, i) => (
                    <Text key={i} color="gray">  • {file}</Text>
                  ))}
                  {worktree.changes.files.length > 5 && (
                    <Text color="gray">  ... and {worktree.changes.files.length - 5} more files</Text>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">[b] Back • [c] Commit</Text>
          </Box>
        </Box>
      </GlassBox>
    );
  }
  
  return (
    <GlassBox borderColor="cyan">
      <Box padding={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">🌳 Git Worktree Commit Flow</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color="gray">
            Each agent worked in their own git worktree. Select which changes to commit:
          </Text>
        </Box>
        
        <Box flexDirection="column" marginBottom={1}>
          {worktrees.map((worktree, index) => (
            <WorktreeItem
              key={worktree.taskId}
              worktree={worktree}
              isSelected={index === selectedIndex}
              onToggle={() => {}}
              isChecked={checkedWorktrees.has(worktree.taskId)}
            />
          ))}
        </Box>
        
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
          <Text dimColor>
            <Text bold>[Space]</Text> Toggle • 
            <Text bold>[a]</Text> All • 
            <Text bold>[n]</Text> None • 
            <Text bold>[r]</Text> Review • 
            <Text bold>[c]</Text> Commit • 
            <Text bold>[s]</Text> Skip
          </Text>
        </Box>
      </Box>
    </GlassBox>
  );
};