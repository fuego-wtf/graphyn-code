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

### 🚀 New in v0.1.50: OAuth Integration

Graphyn now integrates with your GitHub and Figma accounts for enhanced context:

```bash
# First-time setup with OAuth
graphyn init
# → Connects to GitHub for repository context
# → Connects to Figma for design extraction
# → Stores secure JWT tokens locally

# Extract designs from Figma (requires auth)
graphyn design https://figma.com/file/your-design
# → Analyzes Figma prototype
# → Generates pixel-perfect React/Vue components
# → Saves to ./generated/ directory
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