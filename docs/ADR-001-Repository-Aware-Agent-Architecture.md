# ADR-001: Repository-Aware Agent Architecture

## Status: Proposed

## Context

Graphyn Code must evolve from a static CLI with hardcoded agents to a dynamic, repository-aware platform where agents are digital team members that understand each codebase deeply. The user story emphasizes:

- Repository-specific agents that understand local context
- Context-aware shortcuts (e.g., "Graphyn A" means different things in different directories)
- Thread-based conversations that preserve knowledge
- Multi-tenant isolation for different organizations/projects
- Agents that learn and evolve with the codebase

Current limitations:
- Static agent definitions in `prompts/` directory
- No repository context awareness
- No shorthand parsing ("Graphyn A" doesn't work)
- UI alignment issues (centered logo, left-aligned content)
- Fixed colorful theme without user preference

## Decision

Implement a hierarchical, repository-aware agent system with the following architecture:

### 1. Agent Discovery & Loading Hierarchy

```
~/.graphyn/
├── config.yaml                    # User preferences (theme, defaults)
├── agents/                        # User's global custom agents
│   └── personal-assistant.yaml
└── orgs/
    └── {org-id}/
        └── agents/                # Organization-shared agents

{repository}/
├── .graphyn/
│   ├── config.yaml                # Repository configuration
│   ├── agents.yaml                # Agent registry & shortcuts
│   └── agents/                    # Repository-specific agents
│       ├── backend-architect.yaml
│       └── frontend-architect.md
├── backend/
│   └── .graphyn/
│       └── agents.yaml            # Backend-specific agent overrides
└── frontend/
    └── .graphyn/
        └── agents.yaml            # Frontend-specific agent overrides
```

### 2. Agent Configuration Schema

```yaml
# .graphyn/agents.yaml
version: 1
repository:
  name: "my-awesome-project"
  type: "monorepo"

# Shorthand mappings - context aware
shortcuts:
  "A": 
    "*": "architect"           # Default
    "backend/": "backend-architect"
    "frontend/": "frontend-architect"
  "B": "backend"
  "F": "frontend"
  "T": "test-runner"

# Agent definitions
agents:
  backend-architect:
    extends: "architect"       # Inherit from global architect
    prompt: "./agents/backend-architect.md"
    context:
      - "backend/README.md"
      - "backend/ARCHITECTURE.md"
    tools:
      - "docker"
      - "postgres"
    memory: "threads/backend-architect/"
    
  frontend-architect:
    extends: "architect"
    inline_prompt: |
      You are the Frontend Architect for our React + TypeScript application.
      Key patterns:
      - Component-first architecture
      - Tailwind for styling
      - Tanstack Query for data fetching
```

### 3. Thread Persistence Architecture

```typescript
interface AgentThread {
  id: string;
  agent_id: string;
  repository: string;
  directory: string;  // Relative path in repo
  messages: Message[];
  context_snapshot: {
    files: string[];
    decisions: Decision[];
    patterns: Pattern[];
  };
  created_at: Date;
  last_active: Date;
}

// Threads stored in:
// - Local: {repo}/.graphyn/threads/
// - Remote: Graphyn API (for team sharing)
```

### 4. Context-Aware Agent Resolution

```typescript
class AgentResolver {
  async resolveAgent(shorthand: string, cwd: string): Promise<Agent> {
    // 1. Determine repository root and relative path
    const repoRoot = await findRepositoryRoot(cwd);
    const relativePath = path.relative(repoRoot, cwd);
    
    // 2. Load agent configurations in hierarchy
    const configs = await loadAgentConfigs([
      `${repoRoot}/.graphyn/agents.yaml`,
      `${cwd}/.graphyn/agents.yaml`,
      `${os.homedir()}/.graphyn/agents.yaml`
    ]);
    
    // 3. Resolve shorthand based on current directory
    const agentId = resolveShorthand(shorthand, relativePath, configs);
    
    // 4. Load agent with inherited properties
    return loadAgentWithInheritance(agentId, configs);
  }
}
```

### 5. UI/UX Alignment Solution

```typescript
// Theme-based alignment strategy
interface Theme {
  name: 'lean' | 'colorful' | 'minimal' | 'custom';
  alignment: 'center' | 'left' | 'justified';
  colors: ColorScheme;
  ascii_art: boolean;
  box_style: 'none' | 'single' | 'double' | 'round';
}

// Lean theme example (addressing user feedback)
const leanTheme: Theme = {
  name: 'lean',
  alignment: 'left',      // Everything left-aligned
  colors: {
    primary: 'white',
    accent: 'gray',
    gradient: false
  },
  ascii_art: false,       // Simple text logo
  box_style: 'none'       // No decorative boxes
};
```

### 6. Multi-Tenant Isolation

```typescript
// Agent isolation by organization/repository
interface AgentContext {
  organization_id: string;    // From auth token
  repository_id: string;      // From git remote
  workspace_path: string;     // Current directory
  
  // Agents can only access:
  // - Their repository's files
  // - Their organization's shared knowledge
  // - Public global agents
}
```

## Consequences

### Positive
- **Context-Aware Development**: "Graphyn A" means the right architect for your current directory
- **Repository-Specific Knowledge**: Agents understand YOUR patterns, not generic ones
- **Team Knowledge Sharing**: Thread persistence enables onboarding through conversation history
- **Flexible Customization**: Users control their themes and agent configurations
- **Scalable Architecture**: Supports everything from single repos to complex mono-repos

### Negative
- **Migration Complexity**: Existing users need to migrate from static to dynamic agents
- **Storage Requirements**: Thread persistence requires local/remote storage management
- **Configuration Learning Curve**: Users must understand agent hierarchy and configuration

### Mitigation Strategies
1. **Automatic Migration**: Tool to convert existing prompts to new agent format
2. **Smart Defaults**: Pre-configured agents for common frameworks and patterns
3. **Interactive Setup**: First-run wizard to configure repository agents
4. **Progressive Disclosure**: Start simple, reveal advanced features as needed

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- Agent configuration schema and parser
- Repository context detection
- Shorthand resolution system
- Basic theme support

### Phase 2: Dynamic Loading (Week 2)
- Agent inheritance system
- Context-aware resolution
- Configuration validation
- Migration tooling

### Phase 3: Thread Persistence (Week 3)
- Local thread storage
- Conversation replay
- Context snapshots
- Memory management

### Phase 4: UI/UX Improvements (Week 4)
- Theme system implementation
- Alignment fixes
- User preference storage
- Interactive configuration

## Technical Decisions

1. **Configuration Format**: YAML for human readability and easy editing
2. **Storage Backend**: Local SQLite for threads, with API sync for sharing
3. **Agent Prompts**: Support both external .md files and inline YAML
4. **Context Loading**: Lazy load based on current directory to minimize overhead
5. **Theme Engine**: CSS-in-JS style theme objects for Ink components