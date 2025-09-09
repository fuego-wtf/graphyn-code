# Graphyn Code - CLI Tool

## MCP Development Guidelines

This submodule is part of the graphyn-workspace monorepo and handles:
- Command-line interface for Graphyn platform
- Built-in tool discovery (no external scripts)
- Claude Code integration and configuration bridge
- MCP client for communicating with backend

## File Deletion Safety Rule
- **MANDATORY**: Consult user before ANY `rm` command unless explicitly requested
- **Process**: Show what will be deleted, ask for confirmation, wait for approval
- **Exception**: Only skip when user explicitly states "remove X" or "delete Y"
- **NEVER use `rm -rf` without explicit user request** - Destructive file operations

## GitHub-Native Issue Management (Claude Code Orchestrator)

Since @graphyn/code is a Claude Code orchestrator, it leverages GitHub's native features fully:

### Issue Creation Protocol
```bash
# 1. Check existing issues before creating
gh issue list --repo fuego-wtf/graphyn-code --search "KEYWORD"
gh issue list --repo fuego-wtf/graphyn-workspace --search "KEYWORD"

# 2. Create with structured REV format
gh issue create --repo fuego-wtf/graphyn-code --title "REV-{number}: CLI - Feature description"

# 3. Use dependency keywords in issue body
# "This issue blocks #25"
# "This issue depends on fuego-wtf/graphyn-backyard#23"
```

### GitHub Native Dependencies
```bash
# Create issue relationships
gh issue comment {issue_number} --body "This issue is blocked by fuego-wtf/graphyn-backyard#{backend_issue}"
gh issue comment {issue_number} --body "This issue blocks fuego-wtf/graphyn-desktop#{desktop_issue}"

# Transfer between repos when needed
gh issue transfer {number} fuego-wtf/graphyn-code --repo fuego-wtf/graphyn-workspace
```

### Project Board Integration
- All CLI issues start in **No Status** for weekly planning
- **Backlog** → **In Progress** → **In Review** → **Done**
- Use labels: `priority:critical`, `phase:1-cli`, `component:mcp`

## Claude Code Orchestrator Features

Since this CLI is designed to work with Claude Code, it leverages GitHub's native capabilities:

### GitHub Integration (Built-in)
```bash
# CLI automatically detects GitHub context
graphyn init    # Scans repo, creates .claude/agents/, sets up MCP

# Native GitHub workflow support
graphyn issue create "Add authentication"     # Creates REV-formatted issue
graphyn branch "auth-45-jwt-validation"      # Creates issue-based branch
graphyn pr create                             # Links PR to issue automatically

# Project board integration
graphyn planning                              # Shows current sprint items
graphyn status                                # Shows current work progress
```

### Claude Code Session Coordination
- **Multi-Agent Squads**: CLI coordinates multiple Claude Code sessions
- **Context Sharing**: Shared repository context across sessions
- **Issue Tracking**: Each session tied to specific GitHub issues  
- **Dependency Management**: Respects GitHub issue relationships
- **Progress Tracking**: Updates project board automatically

### MCP Server Integration
- **Auto-Discovery**: Scans for available MCP servers
- **Context Bridge**: Shares repository context with Claude sessions
- **Tool Registration**: Exposes GitHub tools to Claude Code
- **Configuration Management**: Manages .claude/ directory structure

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
**Breakthrough**: Claude Code accepts content as direct argument with `-p` flag!
```bash
# Working solution with repository context
claude -p "Your content with full repo context"
```

### Mission Control Interface (NEW)
**Latest Achievement**: Full Mission Control flight cockpit UI implemented!
- **Real-time Claude streaming**: Direct `spawn('claude', ['-p', context])` integration
- **Flight cockpit UI**: Status panels, system logs, and live output streaming
- **Repository context**: Automatic package.json, README, and directory structure inclusion
- **Natural language routing**: Enhanced detection for queries like "help me understand this repo"
- **Session management**: Persistent queries with history tracking
- **Keyboard input**: Foundation for continuous interaction (raw mode fixes pending)

### Ink Framework Success
- Complete migration from Commander.js to Ink (React for terminals)
- Beautiful interactive UI with real-time updates
- Seamless integration with Claude Code
- Mission Control flight cockpit interface with React components
- No terminal conflicts when launching properly

### Repository Context Detection
- Automatic framework detection (Next.js, React, Vue, etc.)
- Pattern recognition for coding conventions
- Git history analysis
- Package.json parsing and project details extraction
- Directory structure mapping for Claude context
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
- GitHub API calls: < 300ms
- Issue creation: < 500ms
- Project board updates: < 200ms
- MCP server discovery: < 1s

## Security & Privacy
- OAuth tokens in system keychain
- API keys encrypted at rest
- All logs stored locally only
- No external data transmission
- User controls all data

## Current Development Status (Latest Session)

### Completed Features ✅
1. **Mission Control Interface**: Flight cockpit UI with real-time Claude streaming
2. **Natural Language Processing**: Enhanced detection routing queries to squad mode
3. **Authentication Removal**: Complete cleanup - no auth barriers for natural language queries
4. **Repository Context**: Comprehensive context building for Claude with package.json, structure
5. **GitHub Integration**: Created REV-071 through REV-074 issues for remaining UX work

### GitHub Issues Created 📋
- **REV-071**: Live Execution Mode with split-screen layout and inline text input
- **REV-072**: Exit protection with two-step confirmation process
- **REV-073**: Task decomposition display with agent assignments and approval workflow  
- **REV-074**: Fix Ink raw mode input handling issues

### Next Development Phase 🚀
**Phase 1**: Interactive Planning Mode with task approval
- Task decomposition display with @backend, @frontend, @architect assignments
- Approval workflow: [A]pprove [M]odify [F]eedback [C]ancel options
- Integration with existing Mission Control interface

**Phase 2**: Live Execution with continuous interaction
- Split-screen layout: Claude output top, inline text input bottom
- Real-time input handling during agent execution
- Persistent session state and input history

**Phase 3**: Exit protection and session management
- Two-step confirmation process to prevent accidental closure
- Session state preservation warnings
- Graceful Claude process termination

### Technical Learnings 🧠
1. **Direct Claude Execution**: `spawn('claude', ['-p', contextPrompt])` works perfectly
2. **Ink Raw Mode Issues**: `useInput` hook has terminal compatibility issues - needs alternative approach
3. **Natural Language Detection**: Regex enhancement successfully catches phrases like "help", "what", "how"
4. **Repository Context Building**: Automatic package.json parsing and directory structure inclusion
5. **Simplified Architecture**: Direct Claude execution more reliable than complex GraphNeuralSystem

## Future Enhancements
1. **Local Model Integration** - Run fuego models locally
2. **Advanced Learning** - Pattern database across projects
3. **Team Collaboration** - Shared agent knowledge
4. **Plugin System** - Custom tool integration

## Ultimate Orchestration Platform (v10.0.0) 🚀

### Multi-Agent Professional Team Coordination
- **8 Parallel Claude Sessions**: Spawn and coordinate multiple Claude Code sessions as professional team
- **Professional Personas**: @architect, @backend, @frontend, @tester, @devops, @security, @researcher, @assistant
- **DAG-Based Task Decomposition**: Automatic analysis of complex queries into parallelizable agent tasks
- **Git Worktree Isolation**: Each agent works in isolated worktree to prevent conflicts
- **Real-Time Coordination**: Cross-agent communication through shared context and progress tracking

### Split-Screen Interface Excellence
- **70/20/10 Layout**: Streaming output (70%), approval workflow (20%), persistent input (10%)
- **60fps Performance**: <16ms UI redraw maintaining professional terminal interface
- **Keyboard Shortcuts**: [A]pprove [M]odify [F]eedback [C]ancel workflow controls
- **Continuous Input**: Always-accessible input during execution for real-time feedback
- **Exit Protection**: Two-step confirmation preventing accidental session termination

### Revolutionary Performance Targets
- **<30s Complex Features**: Multi-file feature implementation in under 30 seconds
- **<3s Repository Analysis**: Instant context building with caching optimization
- **<150MB Memory Usage**: Efficient resource management during 8-agent peak execution
- **Enterprise-Grade Reliability**: 99% task completion rate with graceful failure recovery

### Revenue Integration Strategy
- **Desktop Synchronization**: OAuth PKCE integration with @graphyn/desktop for $20/m subscriptions
- **Premium Orchestration**: Advanced multi-agent features for paid tiers
- **Voice Integration**: whisper.cpp implementation for voice-to-code workflows (premium)
- **Cross-Platform State**: Session backup and restoration across CLI and desktop platforms

## Workspace Branching Rules

### IMPORTANT: Workspace vs Submodule Branching
- **graphyn-workspace**: WORKSPACE BRANCH - work directly on main, no feature branches
- **@code/ (this submodule)**: Can create feature branches for CLI development when needed
- **Coordination**: Cross-submodule specs and coordination happen in workspace main branch

### Correct Branching Pattern for @code/
```bash
# ✅ CORRECT: Feature branches in this submodule
git checkout -b feature-branch    # OK for CLI features
git commit -m "feat: CLI feature"
git push origin feature-branch

# ❌ WRONG: Don't create branches in workspace root
cd /Users/resatugurulu/Developer/graphyn-workspace/
git checkout -b feature-branch   # DON'T DO THIS
```

## Git Safety Rules

### FORBIDDEN Git Commands
- **NEVER use `git reset --hard HEAD`** - This command is strictly prohibited
- **NEVER use `git reset --hard [commit]`** - Can destroy work and history
- **NEVER use `git push --force`** - Can overwrite remote history
- **NEVER use `rm -rf` without explicit user request** - Destructive file operations

### Safe Git Practices
- Use `git stash` to temporarily save changes
- Use `git checkout -- <file>` to discard specific file changes
- Use `git restore <file>` for safer file restoration
- Always check `git status` before any destructive operations
- Create branches before experimental work: `git checkout -b feature-branch`
- Use interactive rebase carefully: `git rebase -i` with proper commit selection

### When User Requests Destructive Operations
1. **Always confirm the specific action** before executing
2. **Explain the consequences** of the command
3. **Offer safer alternatives** when possible
4. **Never assume** what the user wants destroyed

---

Last updated: 2025-08-31 - Mission Control Interface Implemented - Ready for Phase 1 Task Approval