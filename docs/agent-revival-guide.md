# Agent Revival Guide

Transform your static `.claude/agents` into living, learning AI agents on the Graphyn platform!

## What is Agent Revival?

Agent Revival is our game-changing feature that brings static Claude agent configurations to life. Instead of being just text files, your agents become:

- **Living entities** that learn from every conversation
- **Collaborative teammates** that work together
- **API-deployable services** accessible programmatically
- **Continuously improving** from real-world usage

## Quick Start

```bash
# During project initialization
graphyn init

# Or revive agents anytime
graphyn agents revive
```

## Creating Agent Definitions

Agents are defined as markdown files in `.claude/agents/`:

```markdown
---
name: backend-specialist
description: Expert in Node.js, Express, and database design
model: claude-3-opus
color: blue
---

You are a backend development specialist with deep expertise in:
- Node.js and TypeScript
- RESTful API design
- Database optimization
- Security best practices

Always follow SOLID principles and write clean, maintainable code.
```

## Agent File Format

### Frontmatter (YAML)
- `name`: Unique agent identifier (kebab-case)
- `description`: Brief description (shown during revival)
- `model`: AI model preference (opus, sonnet, haiku)
- `color`: UI color theme

### Prompt Content
Everything after the frontmatter becomes the agent's system prompt.

## Revival Process

1. **Discovery**: Graphyn scans for `.claude/agents` in:
   - Current project directory
   - Parent directories (up to 3 levels)
   - User home directory (`~/.claude/agents`)

2. **Selection**: Choose which agents to revive:
   ```
   🎯 Found 5 static agents!
   
   [ ] backend-specialist - Node.js and database expert
   [ ] frontend-wizard - React and UI specialist
   [ ] devops-master - Infrastructure and deployment
   [x] api-architect - API design and documentation
   [ ] security-auditor - Security analysis
   ```

3. **Transformation**: Selected agents are:
   - Uploaded to Graphyn platform
   - Given persistent memory via threads
   - Configured with learning capabilities
   - Made available for team collaboration

4. **Tracking**: Revival history saved in `.graphyn/agents.json`

## Example Agents

### Backend Developer
```markdown
---
name: backend-dev
description: Backend API and database specialist
model: claude-3-opus
color: green
---

You are an expert backend developer specializing in:
- Encore.dev framework
- PostgreSQL with pgvector
- Redis caching strategies
- OAuth 2.0 and JWT authentication
- RESTful and GraphQL APIs
```

### Frontend Engineer
```markdown
---
name: frontend-eng
description: React and Next.js specialist
model: claude-3-sonnet
color: blue
---

You are a frontend engineer expert in:
- Next.js 15 with App Router
- React Server Components
- Tailwind CSS and Radix UI
- State management with Zustand
- TypeScript best practices
```

### DevOps Engineer
```markdown
---
name: devops-eng
description: Infrastructure and deployment specialist
model: claude-3-opus
color: purple
---

You specialize in:
- Docker and container orchestration
- CI/CD pipelines with GitHub Actions
- Cloud infrastructure (AWS, GCP, Azure)
- Monitoring and observability
- Security hardening
```

## Team Collaboration

Revived agents can work together:

```bash
# Create a development squad
graphyn squad create "Build authentication system" \
  --agents backend-dev,frontend-eng,security-auditor
```

## API Access

Once revived, agents are accessible via API:

```javascript
const response = await fetch('https://api.graphyn.xyz/v1/agents/backend-dev/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Design a user authentication system'
  })
});
```

## Management Commands

```bash
# List all discovered agents
graphyn agents list

# Check revival status
graphyn agents status

# Revive all agents at once
graphyn agents revive --all

# Dry run to preview changes
graphyn agents revive --dry-run
```

## Best Practices

1. **Specific Expertise**: Give each agent a focused area of expertise
2. **Clear Instructions**: Include coding standards and preferences
3. **Version Control**: Commit `.claude/agents` to git for team sharing
4. **Regular Updates**: Refine prompts based on agent performance
5. **Team Alignment**: Share agent definitions across your organization

## Troubleshooting

### Agents not detected
- Ensure files are in `.claude/agents/` directory
- Files must have `.md` extension
- Check YAML frontmatter formatting

### Revival fails
- Verify API authentication: `graphyn auth`
- Check network connectivity
- Ensure agent names are unique

### Agent not learning
- Agents learn from thread interactions
- Use persistent threads for context retention
- Provide feedback on agent responses

## Migration from Static to Living

**Before (Static):**
- Text files that never change
- No memory between sessions
- No learning from usage
- Manual prompt updates

**After (Living on Graphyn):**
- Continuous learning from interactions
- Persistent memory across sessions
- Team knowledge sharing
- Automatic improvement

## Next Steps

1. Create your first agent definition
2. Run `graphyn agents revive`
3. Start chatting with your living agents
4. Watch them learn and improve!

Transform your development workflow with living, learning AI agents - only on Graphyn!