# MVP 1.0 Team Dependencies - $39/month Graphyn Ultra

## 🚨 Critical Dependencies for CLI/SDK Team

This document outlines what we need from Backend and Frontend teams to complete the MVP and launch the $39/month Graphyn Ultra subscription.

---

## 🔴 BACKEND TEAM - Critical APIs Needed

### 1. OAuth Endpoints (BLOCKER - Day 1)
```typescript
// GitHub OAuth
POST /api/v1/auth/github/authorize
GET  /api/v1/auth/github/callback
POST /api/v1/auth/github/token

// Figma OAuth  
POST /api/v1/auth/figma/authorize
GET  /api/v1/auth/figma/callback
POST /api/v1/auth/figma/token

// Response format needed:
{
  "access_token": "gph_xxxx",
  "user": {
    "id": "user_123",
    "email": "sarah@acme.com",
    "teams": ["acme-devs"]
  }
}
```

### 2. Figma API Integration (BLOCKER - Design Agent)
```typescript
// Extract design specifications from Figma
POST /api/v1/figma/extract
{
  "figma_url": "https://figma.com/file/xyz/ButtonComponent",
  "access_token": "figma_token"
}

// Response needed:
{
  "component": {
    "name": "ButtonComponent",
    "type": "button",
    "dimensions": { "width": 120, "height": 40 },
    "colors": {
      "background": "#3267F5",
      "text": "#FFFFFF"
    },
    "typography": {
      "fontSize": 16,
      "fontWeight": 600,
      "lineHeight": 1.5
    },
    "spacing": {
      "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 }
    },
    "shadows": "0px 4px 8px rgba(0, 0, 0, 0.1)",
    "borderRadius": 4
  }
}
```

### 3. Agent Builder API (BLOCKER - Init Flow)
```typescript
// Create agent via builder thread
POST /api/v1/agents/create
{
  "team_id": "acme-devs",
  "type": "design",
  "name": "Design Perfectionist",
  "repository": "github.com/acme/frontend"
}

// Quick agent creation for init flow
POST /api/v1/agents/quick-create
{
  "type": "design",
  "repository_context": {
    "url": "github.com/acme/frontend",
    "framework": "react",
    "language": "typescript"
  }
}
```

### 4. Subscription/Billing API (BLOCKER - Revenue)
```typescript
// Create Stripe checkout session
POST /api/v1/billing/checkout
{
  "plan": "ultra_monthly", // or "ultra_annual"
  "user_id": "user_123"
}

// Check subscription status
GET /api/v1/billing/subscription
// Returns:
{
  "status": "active",
  "plan": "ultra_annual",
  "features": {
    "unlimited_orgs": true,
    "figma_extraction": true,
    "team_sharing": true
  }
}
```

### 5. Agent Sharing API (Day 2 Feature)
```typescript
// Share agent with team
POST /api/v1/agents/{agent_id}/share
{
  "team_id": "acme-devs"
}

// Get team's shared agents
GET /api/v1/teams/{team_id}/agents
```

### 6. MCP Server Registry (Day 2 Feature)
```typescript
// Register CLI's MCP server
POST /api/v1/mcp/register
{
  "client_id": "cli_instance_123",
  "capabilities": ["context_injection", "agent_routing"]
}

// Validate MCP compatibility
GET /api/v1/mcp/validate?client=claude-code
```

---

## 🟡 FRONTEND TEAM - Web App Requirements

### 1. OAuth Connection Pages (BLOCKER)
```
/auth/github - GitHub OAuth flow UI
/auth/figma  - Figma OAuth flow UI  
/auth/callback - Handle OAuth callbacks
```

### 2. Subscription Page (BLOCKER - Revenue)
```
/subscribe - Pricing page highlighting:
  - $50/month or $39/month annual
  - Pixel-perfect Figma extraction
  - Unlimited organizations
  - Team agent sharing
```

### 3. Agent Builder Interface (Day 1)
```
/agents/new?type=design&repo=github.com/acme/frontend
  - Quick agent creation for CLI init flow
  - Pre-filled with repository context
  - One-click agent creation
```

### 4. Team Dashboard (Day 2)
```
/team/agents - View and manage shared agents
/team/usage  - See Figma extractions, API calls
```

---

## 📊 Priority Order for MVP Launch

### 🚨 Day 1 BLOCKERS (Must have for launch)
1. **OAuth endpoints** - Users can't connect without this
2. **Figma extraction API** - Core value prop of $39/month
3. **Subscription API** - Can't collect revenue without this
4. **OAuth web pages** - Users need UI for auth flow

### 🟡 Day 2 Features (Can launch without, but needed soon)
1. Agent sharing API
2. Team dashboard
3. MCP registry
4. Usage analytics

### 🟢 Day 3+ Enhancements
1. Advanced Figma features (variants, auto-layout)
2. Component library detection
3. Team learning system
4. Multi-agent coordination

---

## 🔄 Current CLI Status & What We're Blocked On

### ✅ What's Ready on CLI Side:
- `graphyn init` command with full flow
- OAuth handling (waiting for endpoints)
- Repository detection and context
- Package validated and tested
- UI/UX for onboarding flow

### 🚫 What We Can't Do Without Backend:
- **Can't authenticate users** - Need OAuth endpoints
- **Can't extract Figma designs** - Need Figma API integration  
- **Can't create agents** - Need builder API
- **Can't enable subscriptions** - Need Stripe integration

### 🚫 What We Can't Do Without Frontend:
- **Can't complete OAuth flow** - Need web callback pages
- **Can't convert users to paid** - Need subscription page
- **Can't create agents** - Need builder UI (even minimal)

---

## 💰 Revenue Impact of Delays

Every day without these APIs delays revenue:
- Target: 100 developers @ $39/month = $3,900 MRR
- Week 1 goal: 250 developers = $9,750 MRR  
- Month 1 goal: 1000 developers = $39,000 MRR

**Each day of delay = ~$130-$300 in lost MRR**

---

## 🤝 How CLI Team Can Help

1. **API Design Review** - We can review/suggest API contracts
2. **Integration Testing** - Ready to test as soon as endpoints exist
3. **Documentation** - Can write API docs as we integrate
4. **Demo Support** - CLI can be the impressive demo for investors

---

## 📱 Contact for Coordination

CLI Team is ready to integrate immediately as APIs become available. We can work in parallel - as soon as an endpoint is ready, we'll integrate it.

**Our Promise**: Give us the APIs, and we'll have the CLI integration done within 2 hours.

Let's ship this MVP and start generating revenue! 🚀