# @graphyn/code

> Your AI development team, one command away

## Overview

Transform Claude Code into a multi-agent development powerhouse. @graphyn/code orchestrates specialized AI agents to tackle complex coding tasks with unprecedented efficiency.

## Features

### 🤖 Multi-Agent Orchestration
Route tasks to specialized agents: **@backend**, **@frontend**, **@architect**, **@design**. Each agent brings domain expertise to your workflow.

### 🚀 Mission Control
Real-time streaming interface shows agent activity, system logs, and live output. Watch your AI team work in parallel.

### 🎨 Figma Integration
Extract designs directly from Figma with OAuth authentication. Turn mockups into code without leaving your terminal.

### 📚 Smart Context Building
Automatic repository analysis detects frameworks, patterns, and conventions. Claude receives rich context for better code generation.

### 🔌 MCP Integration
12 MCP servers out of the box: Linear, Figma, Perplexity, Firecrawl, Chrome DevTools, and more.

## Quick Start

```bash
# Install globally
npm install -g @graphyn/code

# Run with natural language
graphyn "add user authentication with JWT"

# Or route to specific agents
graphyn @backend "create REST API for users"
graphyn @frontend "build login form component"
```

## Why @graphyn/code?

| Feature | Without Graphyn | With Graphyn |
|---------|-----------------|--------------|
| Context | Manual copy/paste | Auto-detected |
| Agents | Single Claude | Multi-agent team |
| Figma | Export → Import | Direct extraction |
| History | Lost between sessions | Persistent |

## Screenshots

### Mission Control Interface
![Mission Control](./screenshots/mission-control.png)
*Real-time agent streaming with flight cockpit UI*

### Agent Routing
![Agent Routing](./screenshots/agent-routing.png)
*Intelligent task distribution across specialized agents*

### Figma Integration
![Figma](./screenshots/figma-integration.png)
*Design-to-code pipeline with OAuth*

## Installation

```bash
npm install -g @graphyn/code
```

### Requirements
- Node.js 18+
- Claude Code CLI installed
- (Optional) Graphyn Desktop for enhanced features

## Commands

| Command | Description |
|---------|-------------|
| `graphyn "query"` | Natural language task execution |
| `graphyn @agent "task"` | Route to specific agent |
| `graphyn init` | Initialize project configuration |
| `graphyn doctor` | Diagnostic and health check |
| `graphyn figma auth` | Authenticate with Figma |

## Enhanced with Desktop

Install [Graphyn Desktop](https://graphyn.xyz/download) to unlock:
- 📚 Semantic code search across your codebase
- 🧠 Session memory - never lose context
- ⚡ Offline knowledge base
- 📖 Pre-indexed documentation

## Keywords

`ai` `development` `multi-agent` `orchestration` `claude` `code-generation` `figma` `mcp` `cli` `developer-tools`

## Links

- [Documentation](https://docs.graphyn.xyz)
- [GitHub](https://github.com/fuego-wtf/graphyn-code)
- [Desktop App](https://graphyn.xyz/download)
- [Discord](https://discord.gg/graphyn)

## License

MIT © Graphyn
