# CLAUDE.md - Graphyn Code Project Context

## Project Overview
Graphyn Code is a CLI tool that enhances Claude Code with specialized AI agents for backend, frontend, and architecture development. It provides context-aware prompts and manages agent interactions.

## Core Intelligence Strategy (Updated January 2025)

**Key Principle**: The CLI becomes intelligent by **consuming Graphyn agents**, not by building its own intelligence.

### What This Means
- CLI asks agents: "What should the user do next?"
- CLI sends natural language to agents: "Test my customer service agent" → Agent interprets
- Agents maintain context about user's work session
- Agents provide suggestions, analytics, and insights
- CLI is the orchestration layer, agents are the intelligence layer

### Implementation Approach
```typescript
// Instead of building intelligence in CLI
// ❌ const suggestion = analyzeUserPattern(history);

// CLI consumes agent intelligence
// ✅ const suggestion = await askAgent('cli-assistant', {
//      query: 'What should the user do next?',
//      context: { currentTask, recentCommands, projectState }
//    });
```

## Key Learnings

### Claude Code Terminal Integration Issues (January 2025)

**Problem**: Claude Code uses Ink (React for terminals) which requires exclusive raw mode access to stdin. This creates fundamental conflicts when trying to launch Claude from another process.

**Failed Approaches**:
1. ❌ Direct spawning with `stdio: 'inherit'` → Terminal conflicts
2. ❌ Piping content via stdin → "Raw mode not supported" error  
3. ❌ Detached processes → Claude still can't initialize properly
4. ❌ Terminal cleanup before spawn → Conflicts persist
5. ❌ New terminal window with piping → Same raw mode issues

**Root Cause**: Claude Code must be the primary process with full terminal control. It cannot function as a child process or with piped input.

**Current Solution**:
- Save agent context to temp file
- Try direct launch: `claude "content"` (may work in future)
- Fallback: Show user commands to run manually
- Support `/read` command after Claude launches

## Architecture Decisions

### Agent Management
- Each agent (backend, frontend, architect) has its own prompt file
- Contexts are combined with user queries dynamically
- Temp files used for context passing to avoid argument length limits

### UI/UX Design
- Beautiful ASCII banner with gradient colors
- Interactive menu for agent selection
- Clear visual feedback with styled boxes
- Graceful fallbacks when automation fails

### Error Handling
- Always provide multiple options to users
- Clear error messages explaining why something failed
- Save context to files as backup
- Show manual commands when automation fails

## Technical Constraints

### Terminal Limitations
- Cannot spawn Claude Code reliably from Node.js
- Interactive menus (inquirer) conflict with Claude's terminal needs
- Must work around Ink framework requirements

### Platform Differences
- macOS: Can try osascript for new terminal windows
- Linux: Limited automation options
- Windows: Not yet tested

## Logging & Analytics (Added January 2025)

### What We Log
- Every agent interaction (query, timestamp, agent type)
- Full context files saved to `~/.graphyn/contexts/{agent}/`
- Daily log files in `~/.graphyn/logs/`
- Metadata for each interaction (JSON format)

### Why We Log
1. **Debug Issues**: Track what contexts were sent to Claude
2. **Usage Patterns**: Understand how users interact with agents
3. **Context History**: Users can retrieve previous contexts
4. **Analytics**: Build better agents based on real usage

### Commands
- `graphyn history` - View recent interactions
- `graphyn history -n 20` - View last 20 interactions

### Privacy Note
- All logs are stored locally in user's home directory
- No data is sent to external servers
- Users can delete logs anytime from `~/.graphyn/`

## Interactive Mode Behavior (Updated January 2025)

### Auto-Exit Feature
- Interactive mode now auto-exits after preparing Claude context
- No more "Would you like to do something else?" prompt
- Shows "Exiting graphyn. Happy coding!" message
- Gives 1 second for instructions to display clearly

## API Architecture (Updated January 2025)

### BREAKTHROUGH: Live Backend Integration Available!

**Platform Status**: Backend APIs are 100% operational with real PostgreSQL database!

### Core Principle: Standard API Client
Graphyn CLI connects to the working Encore.dev backend using the same APIs as the web frontend.

```typescript
// REAL API integration (not mock!)
const graphyn = new GraphynClient({ 
  apiKey: process.env.GRAPHYN_API_KEY,
  baseURL: 'https://your-encore-app.com' // Live backend!
});

// Real database operations
const threads = await graphyn.get('/api/threads'); // Actual PostgreSQL data
const agents = await graphyn.get('/api/agents');   // Real agent configs
const stream = graphyn.sse('/api/threads/123/stream'); // Live SSE!
```

### CLI's New Role: Power User Interface
With live APIs, CLI becomes the **developer interface** to the platform:

1. **Testing Interface** - Validate all backend functionality
2. **Multi-Claude Orchestration** - Launch multiple instances for learning demo
3. **Bulk Operations** - Mass management of threads/agents
4. **Real-Time Monitoring** - SSE streaming for live updates

### Demo Support Strategy
**Target**: Help platform reach 100% demo readiness

```typescript
// Demo workflow: CLI-driven agent learning
await graphyn.post('/api/threads', { type: 'testing' });
await graphyn.post('/api/threads/123/participants', { type: 'agent', id: 'agent-1' });
// Launch Claude with agent context
// Capture learning insights
await graphyn.delete('/api/threads/123/participants/agent-1'); // Trigger learning
```

### Implementation Priority
1. **Replace mock APIs** - Connect to live Encore.dev backend
2. **Real authentication** - Use actual token system
3. **SSE integration** - Real-time updates in terminal
4. **Multi-instance coordination** - Support learning demonstrations

## Future Improvements
1. Monitor Claude Code for stdin support updates
2. Implement advanced orchestration patterns
3. Build plugin system for custom agents
4. Analyze logged interactions to improve agent prompts

## Development Guidelines
- Always test both interactive and command line modes
- Use standard API client, no special endpoints
- Focus on orchestration and user experience
- Document terminal-related issues thoroughly
- Keep UI consistent and beautiful