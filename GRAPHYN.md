# GRAPHYN.md - Living Project Memory

## Project Vision

Graphyn Code transforms Claude Code from a tool into an intelligent development partner by orchestrating context-aware AI agents that understand your project deeply.

**v10 Architecture**: CLI-first development with MCP integration and local SLM prioritization

## Architecture Documentation

For comprehensive technical documentation:
- **CLI Commands & UI**: See `/docs/sitemap.md` - Complete command reference
- **User Flows**: See `/docs/temp/USER_FLOW.md` - Detailed interaction patterns and entry points
- **Service Architecture**: See `/docs/servicemap.md` - Technical architecture and integration patterns

## v10 Architecture: Claude Code Maxi

### Core Philosophy
**Maximize developer productivity** through intelligent agent orchestration, local model optimization, and seamless Claude Code integration via MCP.

### Key Components

#### 1. CLI-First Development
- **@graphyn/code** as the primary interface
- Repository-aware agents that understand entire codebases
- Automatic pattern detection and learning
- Zero-configuration for most projects

#### 2. MCP (Model Context Protocol) Integration
- Enhanced Claude Code experience
- Repository context injection
- Agent knowledge sharing
- Tool augmentation for specialized tasks

#### 3. Local SLM Optimization
- **fuego-mini**: Lightning-fast code analysis (< 50ms)
- **fuego-toy**: Interactive development assistant
- **fuego-mid**: Complex reasoning tasks
- **fuego-doodle**: Creative UI/UX generation
- 576GB RAM optimization for concurrent streams

#### 4. Enterprise Reinforcement Learning
- Continuous improvement from usage
- Pattern recognition across projects
- Team knowledge aggregation
- Automated prompt refinement

## Core Platform Features

### Persistent AI Memory
Unlike traditional AI assistants that forget everything between sessions, Graphyn agents maintain persistent memory through our Thread API.

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

### Repository Context Detection
The CLI automatically understands your project:
- Detects frameworks (Next.js, React, Vue, etc.)
- Identifies patterns (custom hooks, component structure)
- Learns conventions (naming, file organization)
- Adapts generated code to match your style

## Technical Architecture

### Service Layers
```
1. CLI Layer (@graphyn/code)
   - Ink UI for beautiful interactions
   - Direct Claude Code integration
   - MCP server for enhanced context

2. API Layer (GraphynAPIClient)
   - Standard REST + SSE
   - No special CLI endpoints
   - Unified authentication

3. Intelligence Layer (Strands)
   - Python-based agent runtime
   - Direct AI provider integration
   - Auto-scaling infrastructure

4. Storage Layer
   - PostgreSQL with pgvector
   - Redis cache (5-10 min TTL)
   - Thread-based memory
```

### v10 Implementation Plan

#### Phase 1: Backend Foundation (Complete by Day 3)
- **Strands Integration**: Replace Letta with Python agent runtime
- **Redis Caching**: 5-10 minute TTL for agent responses
- **Learning Extraction**: Capture patterns from test sessions
- **Update Agent Service**: Direct Strands calls, same API interface

#### Phase 2: Frontend Fixes (Complete by Day 4)
- **Fix 404s**: Change `/api/*` to `/admin/*` throughout
- **SSE Auth**: Add Bearer tokens to EventSource
- **Settings Pages**: Wire up organization AI keys
- **GraphynStore**: Complete implementation with error handling

#### Phase 3: CLI MCP Integration (Complete by Day 5)
- **MCP Server**: Bundle for Claude Code enhancement
- **Repository Analyzer**: Pattern detection and caching
- **Local Model Stubs**: Interface preparation for fuego models
- **OAuth Updates**: Add MCP permission scope

#### Phase 4: Docker Swarm Deployment (Complete by Day 5)
- **Strands Service**: 4 replicas with 4GB memory each
- **Redis Cluster**: Primary + replica configuration
- **Traefik Routing**: Add mcp.graphyn.xyz
- **Monitoring**: Prometheus + Grafana dashboards

#### Integration Pattern
```typescript
// CLI uses local models for instant analysis
const analysis = await localModel.analyze(repository);

// Enhanced context for Claude
const context = {
  repository: analysis,
  patterns: await learning.getPatterns(),
  team: await knowledge.getTeamInsights()
};

// MCP provides to Claude Code
await mcp.provideContext(context);
```

## Current State

### CLI Status: SIMPLIFIED & PRODUCTION READY ✅
- **Zero-Config Intelligence** - Just type `graphyn backend "add auth"`
- **Direct Claude Integration** - Instant launch with full context (see `/docs/temp/USER_FLOW.md`)
- **Automatic Repository Detection** - No manual setup needed
- **Invisible Authentication** - Prompts only when needed
- **Pure Agent Focus** - No complex workflows, just intelligent coding
- **Dynamic Terminal UI** - Random colors, animated icons, clean ASCII art

### Platform Progress: 91% Complete
- **Backend**: 94% complete (Strands integration next)
- **Frontend**: 76% complete (SSE auth needed)
- **Infrastructure**: Ready for staging deployment

## Living Documentation Notes

This file evolves with the project. Update it when:
- Making architecture decisions
- Learning technical constraints
- Discovering integration patterns
- Implementing v10 features

Last updated: 2025-01-19 - v10 Architecture Documentation

## Success Metrics

- CLI startup time < 500ms
- Local model inference < 50ms
- Claude launch time < 1s
- Repository analysis < 5s
- Zero manual configuration

## Documentation Cleanup Complete ✅

Streamlined to **TOP DOCUMENTS ONLY** - everything else archived to maintain laser focus on essential references.

## Documentation Structure - Top Documents Only

Clean structure with only the essential top documents for development and reference.

### 🏆 TOP DOCUMENTS:

**Root:**
```
├── README.md              # Basic usage guide
├── GRAPHYN.md            # Living project memory (this file)
├── CLAUDE.md             # Development context for Claude Code
└── package.json + src/    # Code implementation
```

**docs/ Directory:**
```
├── servicemap.md          # Backend services architecture
├── sitemap.md            # Command structure & UI flows  
└── temp/
    ├── LEARNINGS.md       # Technical insights (Ink/Claude integration)
    ├── NEXT_SESSION_START.md   # MCP Figma setup guide
    ├── npm-package-best-practices-report.md   # CLI package guidance
    ├── V10_IMPLEMENTATION_PLAN.md    # v10 architecture implementation
    ├── FIGMA_MCP_SETUP.md            # Figma MCP integration setup
    ├── REPOSITORY-AWARE-IMPLEMENTATION-GUIDE.md   # Repository-aware agents
    └── USER_FLOW.md       # Detailed user flows and interaction patterns
```

### 🗑️ Binary Decision Applied
**Binary Rule**: Referenced by GRAPHYN.md → Keep in temp/ | Not Referenced → Delete

**Kept in temp/ (7 files - all referenced):**
- `LEARNINGS.md` - Supports "Ink Migration Complete"
- `NEXT_SESSION_START.md` - Supports "MCP Integration" 
- `npm-package-best-practices-report.md` - Supports v10 CLI package
- `V10_IMPLEMENTATION_PLAN.md` - Supports "v10 Architecture"
- `FIGMA_MCP_SETUP.md` - Supports "Figma Extraction" 
- `REPOSITORY-AWARE-IMPLEMENTATION-GUIDE.md` - Supports "Repository-aware agents"
- `USER_FLOW.md` - Supports "CLI Commands & UI" and "Direct Claude Integration"

**Deleted completely (11+ files):**
- All marketing, historical, and setup files not referenced by GRAPHYN.md
- No archive folder - clean binary decisions only