# Graphyn Code Agent Contract

Single agent contract for `code/`; `CLAUDE.md` is a pointer to this file.
This CLI tool follows the **Backbone Plan v1** doctrine for V1 launch readiness.

## Inherited policy (cite, do not restate)

This doc inherits the workspace-root `AGENTS.md`, `docs/CONSTITUTION.md`, and
`docs/CLARITY_CONTRACT.md`. If a local rule conflicts, follow the stricter rule
and report the conflict. The workspace-root `AGENTS.md` is the single authority
for, and this file does not restate:

- `§Constitution Priority (Mandatory)` and `§Clarity Contract (Mandatory)`
- `§Workspace Leveling (mandatory)` (source of truth `docs/FILETREE.md` §1).
  **This repo:** RUNTIME discipline, child of the runtime root.
- `§Execution Reporting Format (Mandatory)` (phase, current step, completed,
  remaining, blockers, pane vs page confirmation)
- `§Completion Claim Rule (Mandatory)`, `§Run Boundary Rule`,
  `§Do Your Own Research (DYOR)`, `§Constraint Handling`
- `§Git Safety` (which routes to `docs/COMMIT_MODE.md`) - the single authority
  for forbidden and destructive git commands
- `§Environment Setup (Mandatory for New Developers)` and its
  `§Adding or changing env keys` five-step procedure
- `§Script-First Build/Dev Process (Mandatory)`

## What this repo is

Graphyn Code is a radically simplified CLI that transforms Claude Code into an
intelligent development partner. Just type `graphyn backend "add auth"` and
Claude launches with full context.

This submodule is part of the graphyn-workspace monorepo and handles:
- Command-line interface for Graphyn platform
- Built-in tool discovery (no external scripts)
- Claude Code integration and configuration bridge
- MCP client for communicating with backend

## Documentation and filetree

Code does not own a local docs tree. Do not recreate a local `docs/` folder.

- `../docs/code/` - durable CLI architecture and integration notes
- `../docs/SITEMAP.md` - workspace user-flow sitemap
- `../docs/receipts/` - durable receipts
- `README.md` - user-facing installation and usage guide
- `tests/` - tests, or beside the command surface they verify

Historical migration guides, old roadmaps, and completed task tracking live in
the workspace `../docs/archive/` tree when they are preserved.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Wiring-First** | No mock success states. Real backend paths only. Fail fast with clear errors. |
| **Source-Anchored Planning** | Plans reference actual files and code. No speculative architecture. Documentation should be alive, not static files. |
| **Consume, don't rebuild, intelligence** | The CLI becomes intelligent by consuming Graphyn agents, not by building its own intelligence. The CLI is the orchestration layer; agents are the intelligence layer. |
| **Everything built in** | No external scripts. Auto-discovery of desktop tools and MCP servers. Single entry point with role-based subcommands. Built-in caching for performance. |

### Consuming agent intelligence

The CLI asks agents "what should the user do next?", sends natural language
straight through ("Test my customer service agent" is interpreted by the
agent), and lets agents hold session context, suggestions, and analytics.

```typescript
// Instead of building intelligence in CLI
// ❌ const suggestion = analyzeUserPattern(history);

// CLI consumes agent intelligence
// ✅ const suggestion = await askAgent('cli-assistant', {
//      query: 'What should the user do next?',
//      context: { currentTask, recentCommands, projectState }
//    });
```

## CLI Architecture

- **Single Command**: `graphyn` with unified interface
- **Built-in Discovery**: Scans for tools/MCP servers without external scripts
- **Doctor Command**: `graphyn doctor` provides diagnostic information
- **Env Command**: `graphyn env` manages registered workspace and compound .env files (setup, check, list)
- **Auto-Configuration**: Zero-config setup for GitHub, Figma, Docker
- **MCP Client**: Communicates with graphyn-mcp server

### Service layers

- **CLI Layer**: Ink UI, direct Claude integration, MCP server
- **API Layer**: Standard REST + SSE, no special endpoints
- **Intelligence Layer**: Strands Python runtime, direct AI providers
- **Storage Layer**: PostgreSQL + pgvector, Redis cache

### v10 Architecture: Claude Code Maxi

1. **CLI-First Development** - @graphyn/code as primary interface
2. **MCP Integration** - Enhanced Claude experience with repository context
3. **Local SLM Models** - fuego-mini/toy/mid/doodle for instant analysis
4. **Enterprise RLHF** - Continuous improvement from usage patterns

## Environment Variable Management

This CLI includes an `env` command for managing registered workspace and compound `.env` files. There is no global install. Run from the workspace root:

```bash
# Build the CLI first
cd code && bun install && bun run build && cd ..

# Available commands
bun code/bin/graphyn.js env setup    # Copy .env.example → .env for registered env targets
bun code/bin/graphyn.js env check    # Audit .env files for placeholder values
bun code/bin/graphyn.js env list     # Show which services have env files configured
bun code/bin/graphyn.js env help     # Full usage guide
```

After `env setup`, decrypt real secrets from `.skills/fuegolabs-onboarding/secrets/*.env.enc` using the team passphrase (saved as "envault" in Bitwarden). The agent handles decryption automatically.

Implementation: `src/commands/env.ts`. It reads the `envTargets` registry in
`scripts/graphyn.config.json` at runtime; do not hardcode targets there. When
adding or changing any env key, follow the workspace-root
`AGENTS.md §Adding or changing env keys` five-step procedure in the same change.
Never commit real secret values or claim onboarding is complete if encryption
skipped the relevant env file.

## Development Guidelines

### Code Standards

- Use ESM imports with .js extensions in all TypeScript files
- Test Ink components in isolation before integration
- Handle terminal cleanup properly when exiting
- Always run `bun run test:package` before releasing

### Testing and release

```bash
# Test package installation
bun run test:package

# Build and test locally
bun run build
node dist/ink/cli.js

# Full release process
bun pm version patch
bun publish  # auto-runs tests
```

### Error Handling

- Always provide multiple options to users
- Clear error messages explaining failures
- Graceful fallbacks for all operations
- Context preservation in case of errors

## Performance Targets

- CLI startup: < 500ms
- Menu navigation: 60fps
- API response: < 200ms
- Claude launch: < 1s
- GitHub API calls: < 300ms
- Issue creation: < 500ms
- Project board updates: < 200ms
- MCP server discovery: < 1s

## Security and Privacy

- OAuth tokens in system keychain
- API keys encrypted at rest
- All logs stored locally only
- No external data transmission
- User controls all data

## Platform Integration

### API Connection

```typescript
const graphyn = new GraphynClient({ 
  apiKey: process.env.GRAPHYN_API_KEY,
  baseURL: 'https://api.graphyn.ai'
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

## Claude Code Orchestrator Features

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

### Repository Context Detection

- Automatic framework detection (Next.js, React, Vue, etc.)
- Pattern recognition for coding conventions
- Git history analysis
- Package.json parsing and project details extraction
- Directory structure mapping for Claude context
- Intelligent code generation matching project style

## Multi-Agent Orchestration Platform (v10.0.0)

### Professional team coordination

- **8 Parallel Claude Sessions**: Spawn and coordinate multiple Claude Code sessions as a professional team
- **Professional Personas**: @architect, @backend, @frontend, @tester, @devops, @security, @researcher, @assistant
- **DAG-Based Task Decomposition**: Automatic analysis of complex queries into parallelizable agent tasks
- **Git Worktree Isolation**: Each agent works in an isolated worktree to prevent conflicts
- **Real-Time Coordination**: Cross-agent communication through shared context and progress tracking

### Split-screen interface

- **70/20/10 Layout**: Streaming output (70%), approval workflow (20%), persistent input (10%)
- **60fps Performance**: <16ms UI redraw maintaining professional terminal interface
- **Keyboard Shortcuts**: [A]pprove [M]odify [F]eedback [C]ancel workflow controls
- **Continuous Input**: Always-accessible input during execution for real-time feedback
- **Exit Protection**: Two-step confirmation preventing accidental session termination

### Orchestration performance targets

- **<30s Complex Features**: Multi-file feature implementation in under 30 seconds
- **<3s Repository Analysis**: Instant context building with caching optimization
- **<150MB Memory Usage**: Efficient resource management during 8-agent peak execution
- **Enterprise-Grade Reliability**: 99% task completion rate with graceful failure recovery

### Revenue integration

- **Desktop Synchronization**: OAuth PKCE integration with @graphyn/desktop for $20/m subscriptions
- **Premium Orchestration**: Advanced multi-agent features for paid tiers
- **Voice Integration**: whisper.cpp implementation for voice-to-code workflows (premium)
- **Cross-Platform State**: Session backup and restoration across CLI and desktop platforms

## GitHub-Native Issue Management

Since @graphyn/code is a Claude Code orchestrator, it leverages GitHub's native features fully.

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
- **Backlog** to **In Progress** to **In Review** to **Done**
- Use labels: `priority:critical`, `phase:1-cli`, `component:mcp`

## Known technical constraints

1. **Direct Claude Execution**: Claude Code accepts content as a direct argument
   with the `-p` flag. `spawn('claude', ['-p', contextPrompt])` works; direct
   Claude execution proved more reliable than the complex GraphNeuralSystem.
   Repository context (package.json, README, directory structure) is included
   in the prompt.
2. **Ink Raw Mode Issues**: the `useInput` hook has terminal compatibility
   issues and needs an alternative approach. Tracked as REV-074.
3. **Natural Language Detection**: regex enhancement successfully catches
   phrases like "help", "what", "how" and routes them to squad mode.
4. **Ink Framework**: the CLI migrated fully from Commander.js to Ink (React
   for terminals). No terminal conflicts when launched properly.

## Open CLI issues

- **REV-071**: Live Execution Mode with split-screen layout and inline text input
- **REV-072**: Exit protection with two-step confirmation process
- **REV-073**: Task decomposition display with agent assignments and approval workflow
- **REV-074**: Fix Ink raw mode input handling issues

## Roadmap

**Phase 1** - Interactive Planning Mode with task approval: task decomposition
display with @backend, @frontend, @architect assignments; approval workflow with
[A]pprove [M]odify [F]eedback [C]ancel; integration with the existing Mission
Control interface.

**Phase 2** - Live Execution with continuous interaction: split-screen layout
(Claude output top, inline text input bottom), real-time input handling during
agent execution, persistent session state and input history.

**Phase 3** - Exit protection and session management: two-step confirmation to
prevent accidental closure, session state preservation warnings, graceful Claude
process termination.

**Later**: local model integration (run fuego models locally), advanced learning
(pattern database across projects), team collaboration (shared agent knowledge),
plugin system (custom tool integration).

## Workspace Branching Rules

- **graphyn-workspace**: WORKSPACE BRANCH - work directly on main, no feature branches
- **`code/` (this submodule)**: Can create feature branches for CLI development when needed
- **Coordination**: Cross-submodule specs and coordination happen in workspace main branch

```bash
# ✅ CORRECT: Feature branches in this submodule
git checkout -b feature-branch    # OK for CLI features
git commit -m "feat: CLI feature"
git push origin feature-branch

# ❌ WRONG: Don't create branches in workspace root
cd /Users/resatugurulu/Developer/graphyn-workspace/
git checkout -b feature-branch   # DON'T DO THIS
```

### Git rules

Destructive git commands are governed by the workspace-root
`AGENTS.md §Git Safety`, which routes to `docs/COMMIT_MODE.md` for `git reset`
(forbidden in every form), `git restore`, `git checkout -- <path>`,
`git revert`, and amends. Three rules from this repo are NOT covered there and
still apply here:

- **NEVER use `git push --force`** - can overwrite remote history.
- Use `git stash` to temporarily save changes, and always check `git status`
  before any destructive operation.
- Use interactive rebase carefully: `git rebase -i` with proper commit selection.

When a user requests a destructive operation: confirm the specific action,
explain the consequences, offer safer alternatives, and never assume what the
user wants destroyed.

## File Deletion Safety Rule

- **MANDATORY**: Consult user before ANY `rm` command unless explicitly requested
- **Process**: Show what will be deleted, ask for confirmation, wait for approval
- **Exception**: Only skip when user explicitly states "remove X" or "delete Y"
- **NEVER use `rm -rf` without explicit user request** - Destructive file operations

## Reference

- **Source**: `docs/desktop/backbone-plan-v1.md`
- **Status**: Frozen baseline - changes require explicit approval
