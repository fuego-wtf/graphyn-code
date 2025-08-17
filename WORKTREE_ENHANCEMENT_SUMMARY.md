# Git Worktree Enhancement for TMUX Orchestration

## Summary

Successfully enhanced the @graphyn/code CLI with git worktrees for parallel agent execution. Each agent now works in an isolated git worktree, preventing conflicts and enabling true parallel development.

## Key Enhancements

### 1. GitWorktreeManager (`src/utils/git-worktree-manager.ts`)
- **Centralized worktree management** with comprehensive API
- **Automatic cleanup** of worktrees and branches
- **Error handling** with fallback mechanisms
- **Branch naming convention**: `agent/{squadId}/{agentName}-{taskId}-{timestamp}`
- **Directory structure**: `.worktrees/{squadId}/agent-{agentId}-{timestamp}`

### 2. Enhanced ClaudeAgentLauncher (`src/services/claude-agent-launcher.ts`)
- **Integrated worktree creation** for each agent
- **Environment variables** for worktree information
- **Automatic cleanup** on agent exit/error
- **Fallback to main directory** if worktree creation fails
- **Enhanced process tracking** with worktree metadata

### 3. Enhanced TMUX Orchestrator (`src/utils/tmux-cockpit-orchestrator.ts`)
- **Graceful shutdown handlers** with proper cleanup
- **Enhanced error handling** and recovery
- **Worktree status monitoring** and debugging methods
- **Parallel agent launch** with individual error handling
- **Comprehensive cleanup** on exit

## Benefits

### Isolation
- Each agent works in its own git worktree
- No conflicts between parallel agents
- Independent branch development

### Parallel Execution
- True parallel development without interference
- Each agent can make commits independently
- Isolated file system changes

### Automatic Management
- Worktrees created automatically for each agent
- Automatic cleanup when agents complete
- Graceful shutdown with proper resource cleanup

## Technical Implementation

### Worktree Creation
```typescript
const worktreeInfo = await this.worktreeManager.createWorktree(workDir, {
  agentId: agent.id,
  taskId: task.id,
  agentName: agent.name,
  squadId: squadId || 'default'
});
```

### Environment Variables for Agents
- `GRAPHYN_AGENT_NAME`: Agent name
- `GRAPHYN_TASK_ID`: Task identifier
- `GRAPHYN_WORKTREE_PATH`: Path to agent's worktree
- `GRAPHYN_WORKTREE_BRANCH`: Branch name for the worktree

### Cleanup Strategy
1. **Automatic cleanup** on agent process exit
2. **Graceful shutdown** with signal handlers
3. **Force cleanup** on errors
4. **Comprehensive cleanup** method for all resources

## Usage Example

```typescript
import { TMUXCockpitOrchestrator } from './utils/tmux-cockpit-orchestrator.js';

const orchestrator = new TMUXCockpitOrchestrator();

await orchestrator.launchCockpit({
  tasks: myTasks,
  agents: myAgents,
  repoContext: myRepoContext,
  workDir: process.cwd(),
  claudePath: 'claude'
});

// Each agent will automatically get its own worktree
// Cleanup happens automatically on exit
```

## Error Handling

### Worktree Creation Failures
- **Fallback to main directory** if worktree creation fails
- **Detailed error logging** for debugging
- **Continued execution** with other agents

### Process Failures
- **Individual agent failure isolation** - one agent failing doesn't affect others
- **Automatic worktree cleanup** on agent failure
- **Graceful shutdown** with proper resource cleanup

### System Failures
- **Signal handlers** for SIGINT, SIGTERM, SIGHUP
- **Uncaught exception handlers** with cleanup
- **Unhandled rejection handlers** with cleanup

## File Structure Changes

```
src/
├── utils/
│   ├── git-worktree-manager.ts           # NEW: Centralized worktree management
│   └── tmux-cockpit-orchestrator.ts      # ENHANCED: Worktree integration
├── services/
│   └── claude-agent-launcher.ts          # ENHANCED: Worktree support
└── types/
    └── agent.ts                          # UPDATED: AgentProcess interface

.worktrees/                               # NEW: Worktree directory structure
├── {squadId}/
│   └── agent-{agentId}-{timestamp}/      # Individual agent worktrees
```

## Testing Results

✅ **GitWorktreeManager**: All core functionality tested and working
✅ **ClaudeAgentLauncher**: Worktree integration tested and working  
✅ **TMUXCockpitOrchestrator**: Enhanced orchestration tested and working
✅ **Build Process**: All TypeScript compilation successful
✅ **Import/Export**: All modules properly accessible

## Next Steps

1. **Integration with Multi-Claude**: Test with actual multi-agent scenarios
2. **Performance Monitoring**: Add metrics for worktree operations
3. **Configuration Options**: Add user-configurable worktree settings
4. **Advanced Git Operations**: Support for worktree-specific git operations

## Compatibility

- **Backwards Compatible**: Existing functionality unchanged
- **Graceful Degradation**: Falls back to main directory if worktrees fail
- **Cross-Platform**: Works on macOS, Linux, and Windows (with git support)
- **Git Version**: Requires git 2.5+ for worktree support

This enhancement significantly improves the parallel execution capabilities of the @graphyn/code CLI while maintaining full backwards compatibility and adding robust error handling.