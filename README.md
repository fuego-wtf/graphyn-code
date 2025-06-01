# Graphyn Code

Free AI Development Tool for Claude Code Users

## Install

```bash
curl -sSL https://raw.githubusercontent.com/fuego-wtf/graphyn-code/main/scripts/install.sh | bash
```

## Setup

```bash
# Get API key from https://graphyn.xyz/code
graphyn auth gph_xxxxxxxxxxxx
```

## Usage

```bash
# Auto-detect context
graphyn "help me build a REST API"

# Specify agent
graphyn --backend "create an endpoint"
graphyn --frontend "build a component" 
graphyn --architect "review this design"
```

## Context Detection

Automatically detects the right agent based on:
- Directory (`/backend`, `/frontend`, `/misc`)
- Files (`encore.app`, `next.config.js`, `package.json`)
- Git branch names

## Agents

- **Backend**: Encore.ts, APIs, databases
- **Frontend**: React, Next.js, components  
- **Architect**: System design, reviews

That's it. Start building.