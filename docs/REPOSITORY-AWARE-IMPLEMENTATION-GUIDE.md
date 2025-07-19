# Repository-Aware Agent Implementation Guide

## Executive Summary

Based on your vision "Every Codebase Deserves Its Own Development Team", this guide details how we transform Graphyn Code from a static CLI into a dynamic, repository-aware platform where AI agents become dedicated team members for each codebase.

## Core Problems We're Solving

### 1. **The Shorthand Problem**
**Current**: `graphyn architect` works, but `graphyn A` doesn't
**Solution**: Context-aware shortcuts that change based on directory

```bash
# In project root
graphyn A  → General Architect

# In backend/
graphyn A  → Backend Architect (knows your DB schema, API patterns)

# In frontend/
graphyn A  → Frontend Architect (knows your component library, state management)
```

### 2. **The Static Agent Problem**
**Current**: Same 5 agents for every project
**Solution**: Repository-specific agent ecosystem

```yaml
# Your Node.js project's agents
agents:
  - test-runner: "npm test with Jest"
  - deploy: "Vercel deployment flow"
  - db-migration: "Prisma specialist"

# Your Python project's agents  
agents:
  - test-runner: "pytest with coverage"
  - deploy: "AWS Lambda + CDK"
  - db-migration: "Alembic expert"
```

### 3. **The UI Alignment Problem**
**Current**: Centered logo, left-aligned menu (inconsistent)
**Solution**: Theme-based coherent design

```typescript
// User's ~/.graphyn/config.yaml
theme: "lean"  // Your preference!

// Lean theme: Everything left-aligned, minimal colors
// Colorful theme: Centered, gradients (current)
// Minimal theme: No boxes, pure text
// Custom theme: Your own design
```

### 4. **The Context Loss Problem**
**Current**: Every interaction starts fresh
**Solution**: Thread-based memory system

```
First interaction:
You: "Set up our standard auth flow"
Agent: "I'll create JWT-based auth with refresh tokens..." 
      [Implements your team's specific pattern]

Months later:
You: "Why did we choose JWT over sessions?"
Agent: [Recalls exact conversation and reasoning]
```

## Architecture Overview

### Agent Hierarchy & Discovery

```
1. Global Level (~/.graphyn/agents/)
   └── Your personal agents available everywhere

2. Organization Level  
   └── Shared team agents (from Graphyn platform)

3. Repository Level (.graphyn/agents/)
   └── Project-specific agents

4. Directory Level (backend/.graphyn/agents/)
   └── Mono-repo subset agents
```

### How Agents Are Resolved

```typescript
// When you type: graphyn A "design auth"

1. Where are you?
   cwd: /project/backend/src/auth

2. Find repository root
   root: /project (has .git)

3. Check shortcuts in order:
   /project/backend/.graphyn/agents.yaml  → A: "backend-auth-architect"
   /project/.graphyn/agents.yaml         → A: "backend-architect"
   ~/.graphyn/agents.yaml                → A: "architect"

4. Load most specific agent
   → Backend Auth Architect (knows YOUR auth patterns)
```

### Agent Configuration Examples

#### Simple Repository Configuration
```yaml
# .graphyn/agents.yaml
version: 1
shortcuts:
  A: "architect"
  B: "backend"
  F: "frontend"
  T: "tester"
  D: "deployer"

agents:
  tester:
    prompt: |
      You run tests using our setup:
      - npm test (runs Jest)
      - npm run test:e2e (Playwright)
      - Coverage must exceed 80%
```

#### Mono-repo Configuration
```yaml
# Root .graphyn/agents.yaml
version: 1
repository:
  type: "monorepo"
  
shortcuts:
  A: 
    "backend/": "backend-architect"
    "frontend/": "frontend-architect"
    "shared/": "shared-architect"
    "*": "architect"  # fallback

# Backend-specific: backend/.graphyn/agents.yaml
agents:
  backend-architect:
    extends: "architect"
    context:
      - "ARCHITECTURE.md"
      - "database/schema.sql"
    knowledge:
      - "We use Express + TypeScript"
      - "PostgreSQL with Prisma ORM"
      - "Jest for testing"
```

### Thread Persistence

Each agent maintains conversation threads:

```
.graphyn/threads/
├── backend-architect/
│   ├── 2024-01-15-auth-design.thread
│   ├── 2024-01-20-performance-fix.thread
│   └── current.thread
└── frontend-architect/
    └── 2024-01-18-component-lib.thread
```

Threads capture:
- Full conversation history
- Code changes made
- Decisions and reasoning
- File context at time of conversation

## Implementation Roadmap

### Quick Wins (This Week)

1. **Shorthand Support**
   - Parse "A", "B", "F" etc.
   - Map to full agent names
   - Show available shortcuts in help

2. **UI Alignment Fix**
   - Add `alignment` config option
   - Apply consistently to logo + menu
   - Default to "left" for lean experience

3. **Basic Agent Loading**
   - Check for .graphyn/agents.yaml
   - Load custom agents from repository
   - Merge with built-in agents

### Core Features (Next Sprint)

1. **Full Agent Resolution**
   - Directory-aware shortcuts
   - Agent inheritance system
   - Context file loading

2. **Thread System**
   - Save conversations locally
   - Thread replay functionality
   - Context restoration

3. **Theme Engine**
   - Multiple built-in themes
   - User preference storage
   - Custom theme support

### Advanced Features (Following Sprint)

1. **Learning System**
   - Agents improve from usage
   - Pattern recognition
   - Suggestion generation

2. **Team Sharing**
   - Sync threads to platform
   - Organization agent library
   - Collaborative learning

## Migration Strategy

### For Existing Users
```bash
# Automatic migration command
graphyn migrate

# Creates .graphyn/agents.yaml from current usage
# Preserves existing workflows
# Suggests optimizations
```

### For New Users
```bash
# Interactive setup
graphyn init

# Asks about:
# - Project type (frontend/backend/fullstack)
# - Preferred theme (lean/colorful/minimal)
# - Team size (solo/team)
# Generates optimal agent configuration
```

## Technical Implementation Details

### Key Components to Modify

1. **Agent Resolution (New)**
   ```typescript
   src/agent-resolver.ts
   - findRepositoryRoot()
   - loadAgentHierarchy()
   - resolveShorthand()
   ```

2. **CLI Parser Update**
   ```typescript
   src/ink/cli.tsx
   - Handle single-letter commands
   - Support dynamic agent list
   ```

3. **Theme System**
   ```typescript
   src/theme-engine.ts
   - Theme definitions
   - Preference storage
   - Component styling
   ```

4. **Thread Manager (New)**
   ```typescript
   src/thread-manager.ts
   - Save/load conversations
   - Thread indexing
   - Context restoration
   ```

### Configuration Schema

```typescript
interface GraphynConfig {
  version: number;
  repository?: {
    name: string;
    type: 'single' | 'monorepo';
  };
  shortcuts: Record<string, string | DirectoryMap>;
  agents: Record<string, AgentDefinition>;
  theme?: ThemeName;
}

interface AgentDefinition {
  extends?: string;
  prompt?: string;
  inline_prompt?: string;
  context?: string[];
  tools?: string[];
  knowledge?: string[];
  memory?: string;
}

type DirectoryMap = Record<string, string> & { '*': string };
```

## User Experience Flows

### First Run Experience
```
$ graphyn A "set up project"
! No agent configuration found

Would you like to:
1. Set up repository-specific agents (recommended)
2. Use default agents
3. Learn more

> 1

Great! I'll help you set up agents for this repository.
What type of project is this?
1. Full-stack web application
2. Backend API
3. Frontend application
4. Library/Package
5. Other

[Interactive setup continues...]
```

### Daily Usage
```
$ cd backend
$ graphyn A "add user authentication"
[Backend Architect] I'll implement auth using our standard JWT pattern with refresh tokens...

$ cd ../frontend  
$ graphyn A "create login form"
[Frontend Architect] I'll create a login form using our component library and Formik...
```

### Team Onboarding
```
$ graphyn threads --replay onboarding
[Shows all architect conversations that shaped the codebase]

$ graphyn learn "How does our auth work?"
[Searches through thread history for auth-related decisions]
```

## Success Metrics

1. **Context Switching Reduction**
   - Measure: Time to find right command/pattern
   - Target: 80% reduction

2. **Onboarding Acceleration**
   - Measure: Time for new dev productivity
   - Target: Days → Hours

3. **Knowledge Retention**
   - Measure: Questions answered from threads
   - Target: 90% historical accuracy

4. **User Satisfaction**
   - Measure: Theme preference adoption
   - Target: 100% users customize theme

## Next Steps

1. **Validate Architecture**: Review ADR-001 for technical details
2. **Prioritize Features**: Which improvements matter most?
3. **Begin Implementation**: Start with shorthand + alignment fixes
4. **Gather Feedback**: Test with power users early

The vision is clear: Transform every repository into a living ecosystem with its own intelligent development team. Agents that understand YOUR code, YOUR patterns, YOUR decisions. Not generic tools, but dedicated team members that grow with your project.

Ready to build this future?