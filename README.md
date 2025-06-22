# Graphyn Code

> **Your AI development team, one command away.**

[![npm version](https://img.shields.io/npm/v/@graphyn/code.svg)](https://www.npmjs.com/package/@graphyn/code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🎨 **NEW**: Beautiful interactive CLI with real-time updates, powered by React!

## Why Graphyn?

We believe AI assistants should understand your project deeply—not just respond to prompts. Graphyn gives Claude Code specialized agents that know your stack, follow your standards, and evolve with your codebase.

**One command. Full context. Real development.**

## Install

```bash
npm install -g @graphyn/code
```

That's it! Graphyn will guide you through setup on first run.

## Platform Support

- ✅ **macOS** - Fully supported
- ✅ **Linux** - Fully supported  
- ⚠️ **Windows** - Experimental (WSL recommended)

Check your setup: `graphyn doctor`

## Quick Start

```bash
# Initialize Graphyn with OAuth authentication
graphyn init

# Launch beautiful interactive mode
graphyn

# Or use specialized AI agents directly
graphyn backend "design a REST API for user auth"
graphyn frontend "create a dashboard with charts" 
graphyn architect "review my database schema"
graphyn design <figma-url>  # Convert Figma to pixel-perfect code

# Check your setup anytime
graphyn doctor
```

## 🔧 API Integration

Graphyn provides a powerful REST API for building custom integrations:

### Get Your API Key

```bash
# Sign up and get your API key
graphyn signup
# Your API key will be displayed at app.graphyn.xyz/settings/keys
```

### API Examples

```bash
# Extract Figma design via API
curl -X POST https://api.graphyn.xyz/v1/design/extract \
  -H "Authorization: Bearer gph_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"figma_url": "https://figma.com/file/xyz/Component"}'

# Create custom agent
curl -X POST https://api.graphyn.xyz/v1/agents \
  -H "Authorization: Bearer gph_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FinTech UI Agent",
    "description": "Specialized for financial dashboards",
    "configuration": {
      "prompt": "You specialize in secure financial UIs..."
    }
  }'

# Chat with agent
curl -X POST https://api.graphyn.xyz/v1/agents/agent_123/chat \
  -H "Authorization: Bearer gph_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a secure transaction form"}'
```

### CI/CD Integration

```yaml
# GitHub Action example
- name: Extract Figma Design
  run: |
    curl -X POST https://api.graphyn.xyz/v1/design/extract \
      -H "Authorization: Bearer ${{ secrets.GRAPHYN_API_KEY }}" \
      -d '{"figma_url": "${{ github.event.inputs.figma_url }}"}'
```

### JavaScript SDK

```javascript
import { GraphynClient } from '@graphyn/sdk';

const graphyn = new GraphynClient({
  apiKey: process.env.GRAPHYN_API_KEY
});

// Extract Figma design
const component = await graphyn.design.extract({
  figmaUrl: 'https://figma.com/file/xyz/Component'
});

// Chat with agent
const response = await graphyn.agents.chat('agent_123', {
  message: 'Build a payment form with Stripe'
});
```

### Rate Limits

- **Free Tier**: 3 design extractions per day
- **Ultra ($39/month)**: Unlimited API calls
- Check `X-RateLimit-Remaining` header for current limits

Full API documentation: [app.graphyn.xyz/docs](https://app.graphyn.xyz/docs)

### 🚀 New in v0.1.51: Production Ready

Graphyn now connects to the production backend at api.graphyn.xyz:

```bash
# OAuth authentication (port 8989)
graphyn init
# → Opens browser for GitHub/Figma OAuth
# → Stores secure Better Auth tokens
# → Creates organization context

# Build agents through conversation
graphyn thread
# → Start agent builder conversation
# → Natural language agent creation
# → Test in WhatsApp-style interface

# Deploy agents as APIs
graphyn agent deploy abc123
# → Get API endpoint: https://api.graphyn.xyz/api/v1/agents/abc123/invoke
# → Receive API key for external access
# → Usage tracking and rate limiting included
```

## The Philosophy

**Documentation should be alive.** Not static files that rot in repos, but living knowledge that grows with your project. Every interaction teaches Graphyn about your codebase. Every decision gets remembered. Every pattern gets recognized.

This is the future of development: AI that truly understands your project.

## Your AI Development Team

### 🔧 Backend Agent
Expert in APIs, databases, and server architecture. Knows Encore.ts, Node.js, and cloud patterns.

### 🎨 Frontend Agent  
Master of UI/UX, React, and modern web. Builds components that users love.

### 🏗️ Architect Agent
Your technical advisor. Reviews designs, suggests improvements, ensures best practices.

### 🎨 Design Agent
Converts Figma prototypes to working code. Analyzes designs, creates implementation plans, and launches Claude Code with full MCP integration.

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/graphyn/graphyn-code.git
   cd graphyn-code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Test locally:
   ```bash
   node dist/ink/cli.js
   ```

### Figma OAuth Setup

The Figma OAuth credentials are embedded in the code for local testing:
- Client ID: `YbqfPAJUb1ro4HEUVuiwhj`
- Client Secret: `4ZXEVoSX0VcINAIMgRKnvi1d38eS39`
- Redirect URI: `http://localhost:3456/callback`

To authenticate with Figma:
```bash
graphyn design auth
```

To use Figma design extraction:
```bash
graphyn design <figma-url>
```

**Note**: These are test credentials for local development. For production, create your own OAuth app at https://www.figma.com/developers/apps

## Living Documentation

Create a `GRAPHYN.md` file in your project:

```markdown
# Our Stack
- Backend: Encore.ts with PostgreSQL
- Frontend: Next.js with Tailwind
- Auth: Clerk

# Our Standards
- TypeScript everywhere
- Tests for critical paths
- Accessibility first
```

Now every agent knows your project's DNA.

## Coming Soon

- **Context Evolution**: Graphyn learns from Claude's work
- **Team Sync**: Share knowledge across your organization
- **Pattern Recognition**: Detect and suggest improvements
- **Sleep-time Compute**: AI improves while you rest

## Commands

```bash
# Specialized agents
graphyn backend "create a REST API"
graphyn frontend "build a dashboard" 
graphyn architect "review my system design"
graphyn design "https://figma.com/..."

# Setup and diagnostics
graphyn setup     # Run setup wizard
graphyn doctor    # Check your environment
graphyn auth      # Authenticate with Graphyn

# Advanced
graphyn chain "complex multi-agent task"
graphyn history   # View recent interactions
```

## Troubleshooting

**Setup issues?**
```bash
graphyn doctor -v  # Detailed diagnostics
```

**Need help?**
- Check [COMPATIBILITY.md](COMPATIBILITY.md) for platform support
- Run `graphyn setup` to reconfigure
- Report issues at [github.com/fuego-wtf/graphyn-code](https://github.com/fuego-wtf/graphyn-code)

---

**Built for developers who ship fast and dream big.**