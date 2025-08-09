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
graphyn "task description" # Create AI dev squad (NEW)
graphyn design <url>      # Figma to code
graphyn backend <query>   # Backend agent + Claude
graphyn frontend <query>  # Frontend agent + Claude
graphyn architect <query> # Architecture agent + Claude
```

### Squad Creation Flow (NEW)
```bash
# User types natural language request
graphyn "I need to add user authentication to my Next.js app"

# System:
1. Analyzes repository (stack, patterns, conventions)
2. Sends to code.graphyn.xyz/ask with context
3. Team Builder creates custom squad (3-10 agents)
4. Agents coordinate via MCP protocol
5. Squad delivers working code
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

### Squad System Architecture (NEW)
- **RepositoryAnalyzer** (`src/squad/analyzer.ts`) - Detects stack and patterns
- **SquadBuilder** (`src/squad/builder.ts`) - Dynamic squad composition
- **TeamBuilderClient** (`src/squad/team-builder-client.ts`) - API integration
- **MCPCoordinator** (`src/squad/coordinator.ts`) - Agent task coordination

### API Endpoints (Backend)
```
POST   /api/auth/login         # OAuth flow
GET    /api/auth/status        # Check authentication
POST   /api/threads/create     # Create AI thread
GET    /api/threads/:id        # Get thread + SSE stream
POST   /api/agents/create      # Create custom agent
POST   /api/agents/:id/query   # Query specific agent
GET    /api/figma/extract      # Extract Figma designs
POST   /api/code/ask           # Squad creation (code.graphyn.xyz)
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
2. **Dynamic Squad Creation** - NO FIXED TEMPLATES, every squad is unique
3. **Intelligence Through Agents** - CLI consumes platform agents
4. **Living Documentation** - This map evolves with the code
5. **Direct Claude Integration** - No intermediate files needed

## Quick Start Paths

- **New Users**: Run `graphyn` for interactive mode
- **Squad Creation**: Run `graphyn "your task description"`
- **API Integration**: See `GraphynAPIClient` in `src/api-client.ts`
- **Add New Command**: Edit `src/ink/components/MainMenu.tsx`
- **Customize Agents**: Modify prompts in `prompts/` directory

## Squad System Implementation Status

### ✅ Backend Ready
- Team Builder agent exists at api.graphyn.xyz
- `/api/code/ask` endpoint configured
- Thread-based coordination working

### 🔄 CLI Implementation Needed (12 hours total)
1. **Repository Analyzer** (2h) - Extract patterns and stack
2. **Squad Builder** (3h) - Dynamic agent selection
3. **API Integration** (2h) - Connect to live backend
4. **MCP Coordination** (3h) - Agent task tracking
5. **UI Components** (2h) - Squad status display

### 📝 Key Implementation Files
- `src/squad/analyzer.ts` - TO CREATE
- `src/squad/builder.ts` - TO CREATE
- `src/squad/team-builder-client.ts` - TO CREATE
- `src/squad/coordinator.ts` - TO CREATE
- `src/api-client.ts` - TO UPDATE (add code.graphyn.xyz/ask)

## 📦 Prompts Folder Deprecation Strategy

### Current State
```
/prompts/
├── architect.md    # System architect agent prompt
├── backend.md      # Backend developer agent prompt
├── cli.md          # CLI interaction agent prompt
├── design.md       # Design-to-code agent prompt
└── frontend.md     # Frontend developer agent prompt
```

### Deprecation Timeline

#### Phase 1: Documentation (January 2025)
- Mark prompts folder as "Legacy - Being Deprecated"
- Add deprecation notice to each prompt file
- Document migration path in README

#### Phase 2: Team Builder Migration (February 2025)
- Convert each prompt to Team Builder knowledge base:
  ```typescript
  // Extract key patterns from each prompt
  const backendPatterns = extractPatterns('backend.md');
  const frontendPatterns = extractPatterns('frontend.md');
  
  // Store in Team Builder configuration
  await teamBuilder.addKnowledge({
    domain: 'backend',
    patterns: backendPatterns,
    basePrompt: legacyPrompts.backend
  });
  ```

#### Phase 3: Archive & Remove (March 2025)
- Move prompts to `/archive/legacy-prompts/`
- Update all references in codebase
- Remove from active documentation

### Migration Mapping

| Static Prompt | Team Builder Capability |
|--------------|------------------------|
| architect.md | System design patterns, architecture decisions |
| backend.md   | API patterns, database design, service architecture |
| frontend.md  | UI patterns, component architecture, state management |
| design.md    | Figma extraction, design tokens, accessibility |
| cli.md       | Command patterns, tool integration, automation |

### Code Changes Required

1. **Remove prompt loading in CLI**:
   ```typescript
   // OLD: Load static prompts
   const prompts = loadPrompts('./prompts/');
   
   // NEW: Request from Team Builder
   const squad = await teamBuilder.createSquad(context);
   ```

2. **Update agent creation**:
   ```typescript
   // OLD: Use static prompt
   const agent = createAgent({
     prompt: prompts.backend,
     name: 'Backend Developer'
   });
   
   // NEW: Dynamic configuration
   const agent = await teamBuilder.configureAgent({
     role: 'backend',
     context: projectContext
   });
   ```

3. **Remove prompt references**:
   - `src/agents.ts` - Remove prompt imports
   - `src/commands/*.ts` - Update to use Team Builder
   - `package.json` - Remove prompt copying scripts

### Benefits of Deprecation

1. **Dynamic Adaptation**: Agents configured per project
2. **Continuous Learning**: Improvements automatically applied
3. **Reduced Maintenance**: No manual prompt updates
4. **Better Personalization**: Team-specific agent behavior
5. **Simplified Codebase**: Less static configuration