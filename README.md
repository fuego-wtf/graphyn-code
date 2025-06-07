# Graphyn Code

> **Your AI development team, one command away.**

[![npm version](https://img.shields.io/npm/v/@graphyn/code.svg)](https://www.npmjs.com/package/@graphyn/code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Graphyn?

We believe AI assistants should understand your project deeply—not just respond to prompts. Graphyn gives Claude Code specialized agents that know your stack, follow your standards, and evolve with your codebase.

**One command. Full context. Real development.**

## Install

### npm (recommended)
```bash
npm install -g @graphyn/code
```

### Script install
```bash
curl -sSL https://raw.githubusercontent.com/fuego-wtf/graphyn-code/main/scripts/install.sh | bash
```

## Quick Start

> **Note**: The Graphyn API is currently in development. For now, you can explore and customize the agent prompts locally!

```bash
# Explore the agent prompts
cd prompts/
ls -la

# Edit agent behaviors by modifying their prompts
vim backend.md     # Customize backend agent
vim frontend.md    # Customize frontend agent
vim architect.md   # Customize architect agent

# Use your customized agents with Claude
graphyn backend "design a REST API for user auth"
graphyn frontend "create a dashboard with charts"
graphyn architect "review my database schema"
```

The prompts in the `prompts/` folder define each agent's expertise and behavior. Feel free to modify them to match your team's needs!

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

## Start Building

```bash
# While the API is in development, jump right in!
graphyn backend "let's build something amazing"

# Or customize agents first
cd prompts/
# Edit any .md file to customize agent behavior
# Your changes take effect immediately!
```

> **Coming Soon**: Full API integration with app.graphyn.xyz for team collaboration, agent sharing, and more!

---

**Built for developers who ship fast and dream big.**