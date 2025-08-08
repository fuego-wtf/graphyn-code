# Graphyn Code - Repository Map

**Type**: Monorepo (CLI + Frontend + Backend)  
**Primary Package**: `@graphyn/code` - AI-powered CLI  
**Last Updated**: 2025-01-19

## Repository Structure

```
graphyn-code/
├── src/           # CLI source (@graphyn/code npm package)
├── frontend/      # Next.js web dashboard
├── backend/       # Encore.dev API services
├── prompts/       # Agent system prompts
└── .graphyn/      # Repository intelligence
    ├── map.md     # This file
    └── context.md # Living project memory
```

## CLI Commands & Routes

### Primary Commands
```bash
graphyn                    # Interactive mode (Ink UI)
graphyn init              # Initialize with OAuth
graphyn "task description" # Create AI dev team (NEW)
graphyn design <url>      # Figma to code
graphyn backend <query>   # Backend agent + Claude
graphyn frontend <query>  # Frontend agent + Claude
graphyn architect <query> # Architecture agent + Claude
```

### Multi-Agent Creation Flow (NEW)
```bash
# User types natural language request
graphyn "I need to add user authentication to my Next.js app"

# System:
1. Analyzes repository (stack, patterns, conventions)
2. Sends to code.graphyn.xyz/ask with context
3. Team Builder creates custom agent team (3-10 agents)
4. Agents coordinate via MCP protocol
5. Agent team delivers working code
```

### Interactive UI Routes
- `/` → Main Menu
- `/auth` → Authentication flows
- `/design` → Figma extraction
- `/agent` → Agent builder
- `/thread` → Thread management
- `/natural-language` → AI query interface

## Service Architecture

### Core Services
- **GraphynAPIClient** (`src/api-client.ts`) - Unified API communication
- **AuthManager** (`src/auth.ts`) - OAuth and credential management
- **AgentOrchestrator** (`src/agents.ts`) - Multi-agent coordination
- **ClaudeIntegration** (`src/utils/claude-detector.ts`) - Direct Claude Code launching

### Multi-Agent System Architecture (NEW)
- **RepositoryAnalyzer** (`src/squad/analyzer.ts`) - Detects stack and patterns
- **AgentBuilder** (`src/agents/builder.ts`) - Dynamic agent composition
- **TeamBuilderClient** (`src/agents/team-builder-client.ts`) - API integration
- **MCPCoordinator** (`src/agents/coordinator.ts`) - Agent task coordination

### API Endpoints (Backend)
```
POST   /api/auth/login         # OAuth flow
GET    /api/auth/status        # Check authentication
POST   /api/threads/create     # Create AI thread
GET    /api/threads/:id        # Get thread + SSE stream
POST   /api/agents/create      # Create custom agent
POST   /api/agents/:id/query   # Query specific agent
GET    /api/figma/extract      # Extract Figma designs
POST   /api/code/ask           # Multi-agent team creation (code.graphyn.xyz)
```

### Frontend Routes
```
/                  # Landing page
/auth/callback     # OAuth callback
/dashboard         # Main dashboard
/agents            # Agent management
/agents/builder    # Agent creation
/threads           # Thread viewer
/settings          # Organization settings
```

## Key Integrations

### 1. Claude Code Integration
- Direct content passing: `claude "content"`
- MCP server for enhanced context
- Repository-aware prompting

### 2. Figma Integration  
- OAuth token management
- Design system extraction
- Component code generation

### 3. Repository Intelligence
- Framework detection (Next.js, React, Vue, etc.)
- Pattern learning from codebase
- Convention adaptation

## Development Workflows

### CLI Development
```bash
npm run dev        # Run CLI locally
npm run build      # Build for production
npm test:package   # Test package installation
npm publish        # Release to npm
```

### Frontend Development
```bash
cd frontend
npm run dev        # Next.js dev server
npm run build      # Production build
```

### Backend Development
```bash
cd backend
encore run         # Local API server
encore deploy      # Deploy to cloud
```

## Architecture Principles

1. **Zero Configuration** - Works out of the box
2. **Dynamic Multi-Agent Creation** - NO FIXED TEMPLATES, every agent team is unique
3. **Intelligence Through Agents** - CLI consumes platform agents
4. **Living Documentation** - This map evolves with the code
5. **Direct Claude Integration** - No intermediate files needed

## Quick Start Paths

- **New Users**: Run `graphyn` for interactive mode
- **Multi-Agent Team**: Run `graphyn "your task description"`
- **API Integration**: See `GraphynAPIClient` in `src/api-client.ts`
- **Add New Command**: Edit `src/ink/components/MainMenu.tsx`
- **Customize Agents**: Modify prompts in `prompts/` directory

## Multi-Agent System Implementation Status

### ✅ Backend Ready
- Team Builder agent exists at api.graphyn.xyz
- `/api/code/ask` endpoint configured
- Thread-based coordination working

### 🔄 CLI Implementation Needed (12 hours total)
1. **Repository Analyzer** (2h) - Extract patterns and stack
2. **Agent Builder** (3h) - Dynamic agent selection
3. **API Integration** (2h) - Connect to live backend
4. **MCP Coordination** (3h) - Agent task tracking
5. **UI Components** (2h) - Multi-agent status display

### 📝 Key Implementation Files
- `src/agents/analyzer.ts` - TO CREATE
- `src/agents/builder.ts` - TO CREATE
- `src/agents/team-builder-client.ts` - TO CREATE
- `src/agents/coordinator.ts` - TO CREATE
- `src/api-client.ts` - TO UPDATE (add code.graphyn.xyz/ask)