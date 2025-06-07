# GRAPHYN.md - Living Project Memory

## Project Vision
Graphyn Code transforms Claude Code from a tool into an intelligent development partner by orchestrating context-aware AI agents that understand your project deeply.

## Architecture Decisions

### 2025-01-07: CLI as Standard API Client
**Decision**: Graphyn CLI uses the same APIs as any other client - no special endpoints.
**Rationale**: Simplifies architecture, maintains consistency, reduces API surface area.
**Impact**: Focus shifts to orchestration intelligence rather than API complexity.

### 2025-01-06: Multi-Thread Orchestration Pattern
**Decision**: Each agent gets its own thread, linked by session metadata.
**Rationale**: Enables parallel agent execution and coordinated responses.
**Impact**: Better performance, cleaner separation of concerns.

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

### Terminal Constraints
- Claude Code uses Ink framework (React for terminals)
- Requires exclusive raw mode access to stdin
- Cannot function as child process
- Solution: Save context to temp files, show manual commands

### Multi-Agent Coordination
- Threads created in parallel for performance
- Agents added as participants to threads
- Responses aggregated from multiple SSE streams
- Session ID tracks related operations

## Current State (Updated 2025-01-07)

### MAJOR PLATFORM UPDATE: Backend APIs are LIVE! 🚀

### What's Working (Platform)
- ✅ **Production Backend** - Encore.dev serving real data
- ✅ **PostgreSQL Database** - Full schema operational
- ✅ **Authentication System** - Token-based auth working
- ✅ **Thread Management** - WhatsApp-style conversations
- ✅ **Real-Time SSE** - Streaming endpoint ready
- ✅ **Frontend UI** - 95% complete Next.js interface

### What's Working (CLI)
- ✅ Basic CLI structure and commands
- ✅ Agent prompt management
- ✅ Context file generation
- ✅ Local authentication flow
- ✅ Logging and history

### Critical Path: CLI → Platform Integration
- 🔄 **Connect to live backend** - Replace mock APIs with real endpoints
- 🔄 **Real thread management** - Use actual database threads
- 🔄 **Live agent integration** - Connect to working agent system
- 🔄 **SSE streaming support** - Real-time updates in CLI

### Blocked/Waiting
- ⏸️ Direct Claude Code spawning (terminal constraints)
- ⏸️ Windows platform testing
- ✅ **GraphynClient SDK** - Can now build against live APIs!

## Team Context (Updated 2025-01-07)

### Platform Status: 80% Demo-Ready!

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

### CLI Team (Us) - **NEW PRIORITY**
- 🚀 **Integrate with live backend immediately**
- 🚀 **Become the power user interface**
- 🚀 **Support demo completion (80% → 100%)**
- 🚀 **Multi-instance Claude orchestration for learning demo**

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

## Next Steps (UPDATED PRIORITIES - 2025-01-07)

### IMMEDIATE (Next 2-3 Hours) - Demo Support
1. **Connect CLI to live backend** - Replace all mock APIs
2. **Test thread management** - Verify CLI can create/list real threads
3. **Multi-Claude orchestration** - Support the learning demo scenario
4. **SSE streaming integration** - Real-time updates in CLI

### SHORT-TERM (This Week) - Power User Features  
1. **Agent testing interface** - CLI-driven agent improvement
2. **Bulk operations** - Mass thread/agent management
3. **Analytics interface** - Usage tracking and insights
4. **Developer tools** - Schema introspection, API testing

### MEDIUM-TERM (Next Sprint) - Advanced Features
1. **Plugin system** - Custom agent types
2. **Team orchestration** - Multi-agent coordination
3. **CI/CD integration** - Automated testing workflows
4. **Performance optimization** - Caching, parallel processing

### DEMO CONTRIBUTION TARGET
**Help platform reach 100% demo readiness by providing:**
- Multi-instance Claude Code launcher
- Agent learning workflow automation  
- Real-time learning insights display
- Command-line driven testing scenarios

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

Last updated: 2025-01-07