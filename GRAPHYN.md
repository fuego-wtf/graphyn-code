# GRAPHYN.md - Living Project Memory

## Project Vision
Graphyn Code transforms Claude Code from a tool into an intelligent development partner by orchestrating context-aware AI agents that understand your project deeply.

## Core Platform Features

### Persistent AI Memory
**The Game Changer**: Unlike traditional AI assistants that forget everything between sessions, Graphyn agents maintain persistent memory through our Thread API.

```typescript
// Each thread maintains context across sessions
const thread = await client.threads.create({
  metadata: { customerId: '12345', role: 'financial_advisor' }
});

// Day 1: Customer asks about portfolio
await client.threads.sendMessage(thread.id, {
  content: "My risk tolerance is moderate, focusing on tech stocks"
});

// Day 30: AI remembers everything
await client.threads.sendMessage(thread.id, {
  content: "Should I rebalance?"
});
// Response: "Based on your moderate risk tolerance and tech focus..."
```

This enables:
- **Customer Support AI** that remembers entire conversation history
- **Development Agents** that learn your codebase patterns over time
- **Design Systems** that evolve with your component library
- **Team Knowledge** that persists across projects

### Repository Context Detection
The CLI automatically understands your project:
- Detects frameworks (Next.js, React, Vue, etc.)
- Identifies patterns (custom hooks, component structure)
- Learns conventions (naming, file organization)
- Adapts generated code to match your style

## Architecture Decisions

### 2025-01-07: CLI Intelligence Through Agent Consumption
**Decision**: CLI becomes intelligent by consuming Graphyn agents, not building its own intelligence.
**Rationale**: Agents are the intelligence layer; CLI should orchestrate them seamlessly.
**Impact**: CLI focuses on being the best interface to agent capabilities.

### 2025-01-07: CLI as Standard API Client
**Decision**: Graphyn CLI uses the same APIs as any other client - no special endpoints.
**Rationale**: Simplifies architecture, maintains consistency, reduces API surface area.
**Impact**: Focus shifts to orchestration intelligence rather than API complexity.

### 2025-01-06: Multi-Thread Orchestration Pattern
**Decision**: Each agent gets its own thread, linked by session metadata.
**Rationale**: Enables parallel agent execution and coordinated responses.
**Impact**: Better performance, cleaner separation of concerns.

### 2025-01-18: Ink Framework Migration Started
**Decision**: Migrate from Commander.js to Ink (React for terminals) for modern reactive UI.
**Rationale**: Better user experience, real-time updates, component reusability.
**Impact**: Complete rewrite of CLI interface, ESM modules, new architecture patterns.

### 2025-01-05: Terminal Integration via Temp Files (UPDATED 2025-01-18)
**Original Decision**: Use temporary files for context passing due to Claude Code terminal constraints.
**Update**: Direct integration discovered! Claude accepts content as command argument.
**New Approach**: `claude "content"` works without terminal conflicts.
**Impact**: Seamless integration achieved - no temp files or manual steps needed!

## Technical Learnings

### API Integration Patterns
- GraphynClient handles all API communication
- SSE streams for real-time responses
- Session metadata links related threads
- Standard error handling across all endpoints

### Terminal Constraints (RESOLVED - Direct Integration Works!)
- Both Claude Code and Graphyn CLI use Ink framework
- Previous assumption: Cannot have two Ink apps running simultaneously
- **BREAKTHROUGH**: Claude Code accepts content as direct argument!
- **Solution**: Pass content directly: `claude "content"` - no terminal conflicts!
- No temp files needed - direct integration achieved!

### Multi-Agent Coordination
- Threads created in parallel for performance
- Agents added as participants to threads
- Responses aggregated from multiple SSE streams
- Session ID tracks related operations

## Current State (Updated 2025-01-19 - Ink Migration COMPLETE! 🎉)

### ✅ INK FRAMEWORK MIGRATION COMPLETE: 17/17 Tasks Done (100%)

### Migration Status
- ✅ **Task 1: Minimal Ink App** - Created and tested with "Hello Graphyn"
- ✅ **Task 2: ESM Build Pipeline** - Configured with "type": "module"
- ✅ **Task 3: Main Menu Component** - Beautiful interactive menu with gradient banner
- ✅ **Task 4: State Management** - Zustand store fully integrated
- ✅ **Task 5: Agent Context Component** - Direct Claude Code launch working!
- ✅ **Task 6: Loading States** - Spinner component implemented
- ✅ **Task 7: Thread Management UI** - Full CRUD with API integration
- ✅ **Task 8: Authentication UI** - Complete OAuth flow + API key auth
- ✅ **Task 9: Error Handling/Doctor** - System health checks implemented
- ✅ **Task 10: Keyboard Navigation** - Enhanced navigation hooks + helpers
- ✅ **Task 11: Full API Integration** - Centralized API context & hooks
- ✅ **Task 12: Claude Launch Integration** - Enhanced launch with history
- ✅ **Task 13: Command Migration** - All Commander.js commands ported
- ✅ **Task 14: SSE Streaming** - Real-time updates implemented
- ✅ **Task 15: Testing/Error Boundaries** - Error handling & test infrastructure
- ✅ **Task 16: Documentation Update** - Comprehensive guides created
- ✅ **Task 17: Release Preparation** - Package built, tested, and ready for v0.1.50-stable!

### What's Working (Platform)
- ✅ **Production Backend** - Encore.dev serving real data at api.graphyn.xyz
- ✅ **PostgreSQL Database** - Full schema operational with pgvector
- ✅ **Authentication System** - Token-based auth working
- ✅ **Thread Management** - WhatsApp-style conversations with persistent memory
- ✅ **Real-Time SSE** - Streaming endpoint ready
- ✅ **Frontend UI** - Next.js interface ready for launch
- ✅ **Persistent AI Memory** - Threads remember context across sessions
- ✅ **Repository Context Detection** - CLI understands your codebase patterns

### What's Working (CLI - Ink Version)
- ✅ **Live Backend Integration** - GraphynAPIClient connects to real Encore.dev
- ✅ **Real Thread Management** - Create, list, show threads from PostgreSQL
- ✅ **Agent Management System** - List, add, test, remove agents from threads
- ✅ **Authentication with Backend** - Test token generation and validation
- ✅ **Professional CLI Interface** - Beautiful styling, progress indicators
- ✅ **Real Product Features** - No demos, actual developer tools
- ✅ **FIGMA MCP INTEGRATION** - Complete prototype-to-code workflow
- ✅ **Richard's Dream Feature** - `graphyn design <figma-url>` working perfectly

### Ink Migration Challenges
- ✅ **Terminal Control Conflicts** - SOLVED! Direct argument passing works
- ✅ **ESM Module Resolution** - All imports have .js extensions
- ✅ **State Management Shift** - Zustand reactive patterns working
- ✅ **Claude Code Integration** - Direct launch with content argument works!
- ✅ **Thread Management** - Full API integration with CRUD operations

### Release Status
- ✅ **Ink Migration Complete** - All 17 tasks finished
- ✅ **Tests Passing** - Package validation successful
- ✅ **Build Pipeline** - ESM modules working perfectly
- ✅ **Version 0.1.50-stable** - Ready for npm publish

## Team Context (Updated 2025-01-07)

### Platform Status: 95% Demo-Ready! 🚀

### Frontend Team
- ✅ Thread UI components working
- ✅ WhatsApp-style conversation flow
- 🔄 Testing SSE real-time streaming
- 🔄 Adding agent selector modal

### Backend Team  
- ✅ **Thread system fully operational**
- ✅ **All APIs serving real data**
- ✅ **SSE streaming endpoint live**
- ✅ **Authentication working**
- 🔄 Adding simplified learning tables

### CLI Team (Us) - **LAUNCH READY**
- ✅ **Integrated with live backend** - All APIs connected
- ✅ **Built power user interface** - Professional CLI tools with Ink
- ✅ **Real product features** - Agent management, thread operations
- ✅ **Repository Context Detection** - Automatically understands your codebase
- ✅ **Persistent Memory Integration** - Threads maintain context across sessions
- 🚀 **v0.1.51 Ready** - Prepared for npm publish

### Integration Opportunities
1. **CLI as Testing Interface** - Validate all backend APIs
2. **Multi-Agent Orchestration** - Launch multiple Claude instances
3. **Learning Demo Support** - CLI-driven agent improvement flow
4. **Developer Experience** - Command-line interface to platform

## Integration Points

### With Claude Code
- **DIRECT INTEGRATION**: Content passed as argument to Claude
- Working approach: `claude "${content}"` with proper escaping
- No temp files or manual steps required
- Seamless launch from CLI with full context

### With Graphyn API
- Standard GraphynClient usage
- Thread-based communication
- Agent configuration fetching

### With Development Workflow
- Seamless agent selection
- Context-aware prompts
- Multi-agent coordination

## Next Steps (UPDATED PRIORITIES - 2025-01-18 Ink Migration)

### COMPLETED INK TASKS ✅
1. ✅ **Task 1: Minimal Ink App** - Basic "Hello Graphyn" app working
2. ✅ **Task 2: ESM Build Pipeline** - TypeScript compiles to working ESM
3. ✅ **Task 3: Main Menu Component** - Interactive menu with gradient banner

### COMPLETED INK TASKS (Session Update) ✅
1. ✅ **Task 4: Zustand State Management** - Reactive global state working
2. ✅ **Task 5: Agent Context Component** - Claude launch with progress UI
3. ✅ **Task 6: Loading States** - Spinner indicators implemented
4. ✅ **Task 7: Thread Management UI** - Full CRUD with participants
5. ✅ **Task 8: Authentication UI** - OAuth flow, API keys, status display
6. ✅ **Task 9: Doctor Component** - System health checks with diagnostics
7. ✅ **Task 10: Keyboard Navigation** - Custom hooks, enhanced select, status bar
8. ✅ **Task 11: Full API Integration** - APIContext provider, useAPI hooks, centralized client
9. ✅ **Task 12: Claude Launch Integration** - useClaude hook, history saving, fallback handling
10. ✅ **Task 13: Command Migration** - Share, History, Status, Sync commands all working
11. ✅ **Task 14: SSE Streaming** - ThreadStream, AgentCollaboration, Monitor components
12. ✅ **Task 15: Testing/Error Boundaries** - ErrorBoundary, ErrorFallback, test infrastructure, vitest setup
13. ✅ **Task 16: Documentation Update** - Migration guide, usage guide, test script, README updates

### SHORT-TERM (This Week) - Complete Core Migration
1. **Tasks 8-10: Auth, Error Handling, Keyboard Nav** - Essential UI components
2. **Tasks 11-12: API Integration & Claude Launch** - Connect to backend
3. **Tasks 13-14: Command Migration & SSE** - Port all existing features
4. **Tasks 15-17: Testing, Docs, Release** - Polish and ship

### SHORT-TERM (This Week) - Enhanced Agent Orchestration
1. **Multi-agent conversations** - CLI facilitates agent-to-agent communication
2. **Agent-driven analytics** - Let agents analyze usage patterns
3. **Learning through agents** - Agents improve based on interactions
4. **Conversational testing** - Agents validate each other's work

### MEDIUM-TERM (Next Sprint) - Advanced Intelligence
1. **Agent memory system** - Agents remember project context
2. **Proactive agent monitoring** - Agents watch for issues
3. **Agent-based debugging** - Agents help debug problems
4. **Cross-agent learning** - Agents teach each other

### ACHIEVEMENT UNLOCKED 🏆
**Platform demo readiness: 80% → 95%**
- ✅ CLI as power user interface to live platform
- ✅ Real thread and agent management
- ✅ Professional developer tools
- ✅ Foundation for advanced orchestration

## Success Metrics

- CLI startup time < 500ms
- Zero custom API endpoints needed
- Seamless multi-agent coordination
- Clear error messages with solutions
- Works offline with cached prompts

## Living Documentation Notes

This file evolves with the project. Update it when:
- Making architecture decisions
- Learning technical constraints
- Discovering integration patterns
- Changing team workflows

Last updated: 2025-01-19 - Ink Framework Migration COMPLETE! (17/17 tasks)