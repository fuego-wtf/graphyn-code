# Graphyn Code - CLI Tool

## MCP Development Guidelines

This submodule is part of the graphyn-workspace monorepo and handles:
- Command-line interface for Graphyn platform
- Built-in tool discovery (no external scripts)
- Claude Code integration and configuration bridge
- MCP client for communicating with backend

## Issue Management

- Issues should be created in this repository: `fuego-wtf/graphyn-code`
- Use `gh issue create --repo fuego-wtf/graphyn-code`
- Transfer issues from parent: `gh issue transfer [number] fuego-wtf/graphyn-code --repo fuego-wtf/graphyn-workspace`
- Check existing issues: `gh issue list --repo fuego-wtf/graphyn-code --search "KEYWORD"`

## Claude Code Subagent Context

- This module participates in agent squad coordination
- Enables Claude Code sessions to register as subagents
- Auto-discovers tools and MCP servers
- Integrates with Claude's existing MCP configuration

## CLI Architecture

- **Single Command**: `graphyn` with unified interface
- **Built-in Discovery**: Scans for tools/MCP servers without external scripts
- **Doctor Command**: `graphyn doctor` provides diagnostic information
- **Auto-Configuration**: Zero-config setup for GitHub, Figma, Docker
- **MCP Client**: Communicates with graphyn-mcp server

## Development Rules

- Everything built into CLI - no external scripts
- Auto-discovery of desktop tools and MCP servers
- Claude Code integration via configuration bridge
- Single entry point with role-based subcommands
- Built-in caching for performance

---

# CLAUDE.md - Graphyn Code Project Context

## Project Overview
Graphyn Code is a radically simplified CLI that transforms Claude Code into an intelligent development partner. Just type `graphyn backend "add auth"` and Claude launches with full context.

**Current Status**: SIMPLIFIED & PRODUCTION READY - Zero config, pure intelligence.

## Documentation Structure

**Active Documentation**:
- `/docs/sitemap.md` - Complete CLI command reference and UI architecture
- `/docs/servicemap.md` - Technical service architecture and integration patterns
- `/GRAPHYN.md` - Living project memory and v10 architecture vision
- `/README.md` - User-facing installation and usage guide

**Archived Documentation**:
- Files in `/docs/temp/` - Historical migration guides, old roadmaps, and completed task tracking
- These are preserved for reference but not actively maintained

## Core Intelligence Strategy

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

## Key Technical Achievements

### Direct Claude Integration (SOLVED)
**Breakthrough**: Claude Code accepts content as direct argument!
```bash
# Working solution - no temp files needed!
claude "Your content here"
```

### Ink Framework Success
- Complete migration from Commander.js to Ink (React for terminals)
- Beautiful interactive UI with real-time updates
- Seamless integration with Claude Code
- No terminal conflicts when launching properly

### Repository Context Detection
- Automatic framework detection (Next.js, React, Vue, etc.)
- Pattern recognition for coding conventions
- Git history analysis
- Intelligent code generation matching project style

## Architecture Decisions

### v10 Architecture: Claude Code Maxi
1. **CLI-First Development** - @graphyn/code as primary interface
2. **MCP Integration** - Enhanced Claude experience with repository context
3. **Local SLM Models** - fuego-mini/toy/mid/doodle for instant analysis
4. **Enterprise RLHF** - Continuous improvement from usage patterns

### Service Architecture
- **CLI Layer**: Ink UI, direct Claude integration, MCP server
- **API Layer**: Standard REST + SSE, no special endpoints
- **Intelligence Layer**: Strands Python runtime, direct AI providers
- **Storage Layer**: PostgreSQL + pgvector, Redis cache

## Development Guidelines

### Code Standards
- Use ESM imports with .js extensions in all TypeScript files
- Test Ink components in isolation before integration
- Handle terminal cleanup properly when exiting
- Always run `npm run test:package` before releasing

### Testing Strategy
```bash
# Test package installation
npm run test:package

# Build and test locally
npm run build
node dist/ink/cli.js

# Full release process
npm version patch
npm publish  # auto-runs tests
```

### Error Handling
- Always provide multiple options to users
- Clear error messages explaining failures
- Graceful fallbacks for all operations
- Context preservation in case of errors

## Platform Integration

### API Connection
```typescript
const graphyn = new GraphynClient({ 
  apiKey: process.env.GRAPHYN_API_KEY,
  baseURL: 'https://api.graphyn.xyz'
});

// Standard API operations
const threads = await graphyn.threads.list();
const agent = await graphyn.agents.create(config);
const stream = graphyn.threads.stream(threadId);
```

### Multi-Agent Orchestration
- Create threads for each agent
- Link threads via session metadata
- Aggregate responses from multiple streams
- Present unified output to user

## Performance Targets
- CLI startup: < 500ms
- Menu navigation: 60fps
- API response: < 200ms
- Claude launch: < 1s
- Design extraction: < 5s

## Security & Privacy
- OAuth tokens in system keychain
- API keys encrypted at rest
- All logs stored locally only
- No external data transmission
- User controls all data

## Future Enhancements
1. **Local Model Integration** - Run fuego models locally
2. **Advanced Learning** - Pattern database across projects
3. **Team Collaboration** - Shared agent knowledge
4. **Plugin System** - Custom tool integration

---

Last updated: 2025-01-19 - Production Ready with v10 Architecture