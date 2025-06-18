# GRAPHYN.md - Living Project Memory

## Project Vision
Graphyn Code transforms Claude Code from a tool into an intelligent development partner by orchestrating context-aware AI agents that understand your project deeply.

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

### 2025-01-05: Terminal Integration via Temp Files
**Decision**: Use temporary files for context passing due to Claude Code terminal constraints.
**Rationale**: Claude Code requires exclusive terminal control, cannot be spawned as child.
**Impact**: Graceful fallback pattern established for all CLI operations.

## Technical Learnings

### API Integration Patterns
- GraphynClient handles all API communication
- SSE streams for real-time responses
- Session metadata links related threads
- Standard error handling across all endpoints

### Terminal Constraints (Updated with Ink Migration)
- Both Claude Code and Graphyn CLI now use Ink framework
- Ink requires exclusive raw mode access to stdin
- Cannot have two Ink apps running simultaneously
- Solution: Exit Graphyn Ink app cleanly before launching Claude Code
- Fallback: Save context to temp files, show manual commands

### Multi-Agent Coordination
- Threads created in parallel for performance
- Agents added as participants to threads
- Responses aggregated from multiple SSE streams
- Session ID tracks related operations

## Current State (Updated 2025-01-18 - Ink Migration Focus)

### 🎨 INK FRAMEWORK MIGRATION IN PROGRESS: 3/17 Tasks Complete

### Migration Status
- ✅ **Task 1: Minimal Ink App** - Created and tested with "Hello Graphyn"
- ✅ **Task 2: ESM Build Pipeline** - Configured with "type": "module"
- ✅ **Task 3: Main Menu Component** - Basic MainMenu.tsx implemented
- 🔄 **Task 4: State Management** - Currently implementing Zustand integration
- ⏳ **Tasks 5-17** - Remaining UI components and feature migration

### What's Working (Platform)
- ✅ **Production Backend** - Encore.dev serving real data (localhost:4000)
- ✅ **PostgreSQL Database** - Full schema operational
- ✅ **Authentication System** - Token-based auth working
- ✅ **Thread Management** - WhatsApp-style conversations
- ✅ **Real-Time SSE** - Streaming endpoint ready
- ✅ **Frontend UI** - 95% complete Next.js interface

### What's Working (CLI - Pre-Ink Version)
- ✅ **Live Backend Integration** - GraphynAPIClient connects to real Encore.dev
- ✅ **Real Thread Management** - Create, list, show threads from PostgreSQL
- ✅ **Agent Management System** - List, add, test, remove agents from threads
- ✅ **Authentication with Backend** - Test token generation and validation
- ✅ **Professional CLI Interface** - Beautiful styling, progress indicators
- ✅ **Real Product Features** - No demos, actual developer tools
- ✅ **FIGMA MCP INTEGRATION** - Complete prototype-to-code workflow
- ✅ **Richard's Dream Feature** - `graphyn design <figma-url>` working perfectly

### Ink Migration Challenges
- 🔴 **Terminal Control Conflicts** - Ink requires exclusive TTY access
- 🔴 **ESM Module Resolution** - All imports need .js extensions
- 🔴 **State Management Shift** - Moving from imperative to reactive patterns
- 🔴 **Claude Code Integration** - Must exit Ink cleanly before launching

### Blocked/Waiting
- ⏸️ Direct Claude Code spawning (Ink terminal constraints)
- ⏸️ Reactive state management implementation
- ⏸️ Component migration from Commander.js
- ⏸️ Windows platform testing

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

### CLI Team (Us) - **MISSION ACCOMPLISHED**
- ✅ **Integrated with live backend** - All APIs connected
- ✅ **Built power user interface** - Professional CLI tools
- ✅ **Supported demo completion** - Platform now 95% ready
- ✅ **Real product features** - Agent management, thread operations

### Integration Opportunities
1. **CLI as Testing Interface** - Validate all backend APIs
2. **Multi-Agent Orchestration** - Launch multiple Claude instances
3. **Learning Demo Support** - CLI-driven agent improvement flow
4. **Developer Experience** - Command-line interface to platform

## Integration Points

### With Claude Code
- Context passed via temp files
- Manual fallback instructions
- Future: Plugin/extension system

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

### IMMEDIATE (Current Session) - Continue Ink Migration
1. **Task 4: Zustand State Management** - Create reactive global state
2. **Task 5: Agent Context Component** - Prepare and display agent contexts
3. **Task 6: Loading States** - Beautiful progress indicators
4. **Task 7: Thread Management UI** - Full CRUD interface

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

Last updated: 2025-01-18 - Ink Framework Migration Started (3/17 tasks complete)