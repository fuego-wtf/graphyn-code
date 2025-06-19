# MVP 1.0 Architecture - Graphyn Ultra ($39/month)

## The Magic Moment Vision

Sarah discovers Graphyn, runs `graphyn init`, connects her GitHub and Figma, and within minutes is generating pixel-perfect React components from Figma designs. Her team sees this and immediately subscribes.

## Core Architecture Components

### 1. CLI Foundation (Immediate Value)

```typescript
// graphyn init flow
interface InitFlow {
  steps: [
    "Auto-detect repository context",
    "Open browser for GitHub/Figma OAuth", 
    "Validate MCP installation",
    "Create first agent via builder thread",
    "Generate first component from Figma"
  ];
  timeToValue: "< 5 minutes";
}
```

### 2. Authentication & Access Layer

```typescript
// Seamless OAuth for tools developers already use
interface AuthFlow {
  github: {
    scopes: ["repo:read", "user:email"],
    purpose: "Repository context & commit history"
  };
  figma: {
    scopes: ["file:read"],
    purpose: "Pixel-perfect design extraction"
  };
  storage: "Secure token in system keychain";
}
```

### 3. MCP Integration (Claude Code Enhancement)

```typescript
// MCP server bundled with CLI
interface GraphynMCP {
  trigger: "When Claude Code needs context",
  provides: [
    "Repository-specific agent prompts",
    "Figma design context",
    "Team patterns and conventions"
  ],
  installation: "Automatic via graphyn init"
}
```

### 4. Pixel-Perfect Design Agent

```typescript
interface DesignAgent {
  // Extract exact design specs
  extractFromFigma(url: string): {
    layout: { width, height, padding, gap };
    colors: { exact hex values };
    typography: { size, weight, lineHeight };
    shadows: { exact CSS values };
    spacing: { pixel-perfect margins };
  };
  
  // Generate framework-specific code
  generateCode(specs: DesignSpecs): {
    react: "Tailwind classes with exact values",
    vue: "Scoped styles matching exactly",
    svelte: "Component with precise styling"
  };
}
```

### 5. Agent Sharing & Team Collaboration

```typescript
interface TeamCollaboration {
  agentSharing: {
    command: "graphyn share agent",
    result: "Team members instantly access",
    learning: "Agent improves from team usage"
  };
  designDiscussion: {
    command: "graphyn discuss figma.com/xyz",
    participants: ["@sarah", "@tom", "@designAgent"],
    outcome: "Collaborative design decisions"
  };
}
```

## Technical Architecture

### Backend Services

```
/backend
├── auth/
│   ├── github-oauth.ts      # Repository access
│   ├── figma-oauth.ts       # Design file access
│   └── token-manager.ts     # Secure storage
├── agents/
│   ├── design-agent.ts      # Pixel-perfect engine
│   ├── builder-agent.ts     # Agent creation
│   └── agent-sharing.ts     # Team collaboration
├── billing/
│   ├── stripe-webhook.ts    # Subscription handling
│   └── org-limits.ts        # Ultra features
└── mcp/
    ├── server.ts            # MCP protocol handler
    └── context-provider.ts  # Agent context injection
```

### CLI Architecture

```
/src
├── commands/
│   ├── init.ts             # Onboarding flow
│   ├── design.ts           # Figma-to-code
│   ├── share.ts            # Agent sharing
│   └── discuss.ts          # Team collaboration
├── auth/
│   ├── oauth-flow.ts       # Browser-based auth
│   └── token-storage.ts    # Keychain integration
├── mcp/
│   ├── client.ts           # MCP communication
│   └── bundle.ts           # Server bundling
└── figma/
    ├── extractor.ts        # Design spec extraction
    └── code-generator.ts   # Perfect code generation
```

### Frontend Pages

```
/frontend/app
├── (auth)/
│   ├── connect/           # OAuth connection status
│   └── callback/          # OAuth callbacks
├── (marketing)/
│   ├── pricing/           # $39/month value prop
│   └── demo/              # Live Figma-to-code demo
└── (app)/
    ├── agents/            # Agent management
    └── team/              # Collaboration features
```

## Data Flow for Key Features

### 1. Pixel-Perfect Design Generation

```
User: graphyn design figma.com/file/xyz/LoginCard
         ↓
CLI: Extract Figma URL, validate auth
         ↓
Backend: Figma API call with OAuth token
         ↓
Design Agent: Extract exact specifications
         ↓
Code Generator: Create pixel-perfect component
         ↓
CLI: Save component, show preview
         ↓
User: "Wow! Exactly like the design!"
```

### 2. Agent Learning from Team

```
Sarah: Creates "ACME Backend Architect"
         ↓
Backend: Store agent with team context
         ↓
Tom: Uses agent for API question
         ↓
Agent: Responds with Sarah's patterns
         ↓
Backend: Records interaction
         ↓
Agent: Improves from usage pattern
         ↓
Lisa: Gets even better response
```

### 3. MCP Enhancement Flow

```
User: Opens Claude Code
         ↓
Claude: "I need more context..."
         ↓
MCP Server: Intercepts request
         ↓
Graphyn: Provides agent + repo context
         ↓
Claude: "I understand your codebase!"
         ↓
User: Gets contextual assistance
```

## Scaling Considerations for MVP

### Connection Management
- Start with 100 concurrent users
- Use Encore's built-in scaling
- Add Redis when reaching 50+ concurrent

### Caching Strategy
- Cache Figma extractions (1 hour)
- Cache agent responses (5 minutes)
- Local CLI cache for offline mode

### Rate Limiting
- Free trial: 10 Figma extractions
- Ultra: Unlimited with fair use
- Team sharing: No limits

## Success Metrics

### Day 1 Launch
- [ ] CLI with `graphyn init` ships
- [ ] First Figma component generated
- [ ] First $39 subscription

### Week 1 Goals
- [ ] 100 developers subscribed
- [ ] 500 perfect components generated
- [ ] 50 teams sharing agents

### Month 1 Targets
- [ ] $10K MRR (250+ subscribers)
- [ ] 90% create multiple orgs
- [ ] 80% share agents with team

## MVP Development Timeline

### Hours 1-4: Foundation
- CLI core with init command
- GitHub/Figma OAuth flow
- Basic agent creation

### Hours 5-8: Core Value
- Pixel-perfect design agent
- MCP server integration
- Agent sharing system

### Hours 9-12: Monetization
- Stripe subscription
- Pricing page
- Ultra features

### Hours 13-14: Intelligence
- Git history integration
- Usage analytics
- Team learning

## Why Developers Pay $39/month

1. **Time Saved**: 10+ hours/month on UI implementation
2. **Pixel Perfect**: No more "close enough" components
3. **Team Knowledge**: Shared agents = shared patterns
4. **Always Current**: Agents learn and improve
5. **Zero Config**: Works out of the box

## Technical Decisions

1. **Bundle MCP**: Ship server with CLI for zero config
2. **OAuth Flow**: Use system browser for familiarity
3. **Exact Values**: Never approximate design specs
4. **Local First**: Cache everything for offline work
5. **Team Context**: Agents know your patterns

This MVP focuses on immediate, tangible value that justifies the subscription. The pixel-perfect design agent alone saves hours of development time, and team collaboration makes it viral within organizations.