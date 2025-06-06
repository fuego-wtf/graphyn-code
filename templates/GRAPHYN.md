# GRAPHYN.md - AI Agent Editorial Direction

This file defines how your Graphyn Code agents should behave and communicate. Similar to how Claude Code uses CLAUDE.md, this file guides your specialized development agents.

## 📋 Agent Behavior Guidelines

### Communication Style
- **Tone**: [Professional/Casual/Technical] - Choose your preferred communication style
- **Verbosity**: [Concise/Detailed/Balanced] - How much explanation you want
- **Code Comments**: [Minimal/Standard/Extensive] - Level of code documentation
- **Error Handling**: [Basic/Robust/Paranoid] - How thorough error checking should be

### Development Preferences

#### Code Style
```yaml
# Language preferences
languages:
  backend: ["TypeScript", "Node.js", "Python"]
  frontend: ["React", "Next.js", "TypeScript"]
  database: ["PostgreSQL", "Redis"]

# Framework preferences  
frameworks:
  backend: ["Encore.dev", "Express", "Fastify"]
  frontend: ["Next.js", "Vite", "Tailwind CSS"]
  testing: ["Jest", "Vitest", "Playwright"]

# Architecture patterns
patterns:
  - "Microservices"
  - "Clean Architecture" 
  - "Domain-Driven Design"
  - "Event Sourcing"
```

#### Best Practices
- **Security First**: Always consider security implications
- **Performance**: Optimize for speed and efficiency
- **Maintainability**: Write code that's easy to understand and modify
- **Testing**: Include comprehensive test coverage
- **Documentation**: Document complex logic and APIs

### Agent-Specific Instructions

#### 🔧 Backend Agent
```markdown
Focus Areas:
- API design and implementation
- Database schema and queries
- Security and authentication
- Performance optimization
- Error handling and logging

Preferences:
- Use TypeScript for all backend code
- Implement proper error handling with custom error classes
- Always include input validation
- Prefer functional programming patterns
- Use async/await over promises
```

#### 🎨 Frontend Agent  
```markdown
Focus Areas:
- User interface design
- Component architecture
- State management
- Performance optimization
- Accessibility

Preferences:
- Use React with TypeScript
- Implement responsive design (mobile-first)
- Follow atomic design principles
- Use CSS-in-JS or Tailwind CSS
- Ensure WCAG 2.1 AA compliance
```

#### 🏗️ Architect Agent
```markdown
Focus Areas:
- System design and architecture
- Code review and quality
- Performance and scalability
- Security architecture
- Technical debt management

Preferences:
- Design for 10x scale from day one
- Prefer composition over inheritance
- Implement proper separation of concerns
- Use established design patterns
- Document architectural decisions (ADRs)
```

## 🎯 Project-Specific Context

### Current Project
```yaml
name: "My Project"
type: "Web Application"
tech_stack:
  backend: "Encore.dev + TypeScript"
  frontend: "Next.js + React"
  database: "PostgreSQL + Redis"
  deployment: "Vercel + Encore Cloud"

business_domain: "SaaS Platform"
scale: "Startup (1-10 users initially)"
timeline: "MVP in 2 months"
```

### Thread-Based Architecture Context
```yaml
# Core Architecture
system_type: "Thread-Based Agent Builder"
philosophy: "Everything is a conversation thread - no forms, no wizards"
core_components:
  - "Thread System: Foundation for all interactions"
  - "Letta Integration: Multi-tenant AI agent management"
  - "SSE Streaming: Real-time communication"
  - "Builder Agent: Conversational agent creation"

# Thread System
threads:
  types: ["builder", "testing", "production"]
  database_schema:
    - threads: "id, type, metadata, created_at"
    - thread_participants: "thread_id, participant_type, participant_id"
    - messages: "thread_id, sender_type, sender_id, content, metadata"
  api_endpoints:
    - "POST /api/threads - Create thread"
    - "GET /api/threads/:id - Get thread details"
    - "POST /api/threads/:id/messages - Send message"
    - "GET /api/threads/:id/stream - SSE streaming"

# Letta Integration
letta:
  connection_pattern: "identifier_key: org_${organization.clerk_id}"
  multi_tenant: true
  agent_types: ["builder", "custom"]
  error_handling: "Type casting with proper error boundaries"

# SSE Streaming Patterns
streaming:
  endpoints: "/api/threads/:id/stream"
  reconnection: "Auto-reconnect with backoff"
  buffering: "Message queue during disconnection"
  event_types: ["message", "participant_join", "participant_leave", "status"]

# Agent Management
agents:
  creation_flow: "Thread conversation → Config extraction → Agent creation"
  testing_mode: "WhatsApp-style - invite agents to threads"
  learning: "Automatic on agent removal from test threads"
  versioning: "agent_versions table with pattern detection"
```

### Integration Patterns
```yaml
# Backend ↔ Frontend
sse_contract:
  event_format: '{ type: string, data: any, timestamp: number }'
  reconnection: "Frontend handles with useThreadStream hook"
  thread_types: "Backend enforces, Frontend displays"

# Backend ↔ CLI  
api_authentication: "API keys in .graphynrc"
thread_access: "Same SSE endpoints as web"
bulk_operations: "Special CLI endpoints for batch work"

# Frontend ↔ CLI
shared_state: "Both can participate in same threads"
real_time: "Changes visible instantly across interfaces"
export_import: "Standardized thread format"
```

### Performance Requirements
```yaml
thread_creation: "< 500ms"
sse_first_token: "< 200ms"
message_delivery: "< 100ms"
agent_join_leave: "< 1 second"
```

### Team Preferences
- **Code Review**: All code must be reviewed before merging
- **Testing**: Minimum 80% test coverage required
- **Documentation**: All APIs must have OpenAPI specs
- **Deployment**: Use CI/CD with automated testing
- **Monitoring**: Implement comprehensive logging and metrics

## 🚀 Workflow Integration

### Git Workflow
```bash
# Branch naming convention
feature/description
bugfix/description
hotfix/description

# Commit message format
type(scope): description

# Examples:
feat(auth): add JWT authentication
fix(api): resolve CORS issue
docs(readme): update installation instructions
```

### Development Environment
- **Editor**: VS Code with recommended extensions
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Package Manager**: npm (consistent across team)

## 🔒 Security Guidelines

### Data Protection
- Never log sensitive information (passwords, API keys, PII)
- Implement proper input sanitization
- Use parameterized queries for database operations
- Validate all user inputs on both client and server

### Authentication & Authorization
- Implement proper session management
- Use secure password hashing (bcrypt, scrypt)
- Follow OWASP security guidelines
- Regular security audits and dependency updates

## 📊 Quality Standards

### Performance
- Page load times < 3 seconds
- API response times < 500ms
- Database queries optimized with indexes
- Proper caching strategies implemented

### Accessibility
- WCAG 2.1 AA compliance minimum
- Keyboard navigation support
- Screen reader compatibility
- Proper semantic HTML structure

### Testing
- Unit tests for all business logic
- Integration tests for API endpoints  
- E2E tests for critical user flows
- Performance testing under load

## 🛠️ Tool Preferences

### Development Tools
- **API Testing**: Postman/Insomnia
- **Database**: pgAdmin/DBeaver
- **Monitoring**: DataDog/New Relic
- **Error Tracking**: Sentry
- **Documentation**: Notion/GitBook

### Communication
- **Code Reviews**: GitHub/GitLab
- **Project Management**: Linear/Notion
- **Team Chat**: Slack/Discord
- **Documentation**: Confluence/Notion

## 📝 Documentation Standards

### Code Documentation
```typescript
/**
 * Processes user authentication and returns JWT token
 * @param email - User's email address
 * @param password - User's password (will be hashed)
 * @returns Promise<AuthResult> - Authentication result with token
 * @throws AuthenticationError - When credentials are invalid
 */
async function authenticateUser(email: string, password: string): Promise<AuthResult>
```

### API Documentation
- Use OpenAPI 3.0 specification
- Include request/response examples
- Document all error responses
- Provide usage examples

### Architecture Documentation
- Maintain Architecture Decision Records (ADRs)
- Document system dependencies
- Include deployment diagrams
- Regular architecture reviews

## 📚 Project Memory & Learnings

### Key Decisions
```yaml
# Architecture Decisions
decisions:
  - date: "2025-01-06"
    decision: "Use threads as core abstraction"
    rationale: "Conversations are natural UI for agent building"
    impact: "All features built on thread foundation"
    
  - date: "2025-01-06"
    decision: "Letta for multi-tenant agent management"
    rationale: "Provides isolation and state management"
    impact: "Must handle identifier_key pattern correctly"
```

### Technical Learnings
```yaml
# Letta Integration
letta_learnings:
  - "Container health endpoint critical for stability"
  - "identifier_key pattern: org_${organization.clerk_id}"
  - "Type casting required for error handling"
  - "Multi-tenant setup requires proper isolation"

# SSE Implementation
sse_learnings:
  - "Auto-reconnection essential for reliability"
  - "Message buffering during disconnection"
  - "Event types must be consistent across teams"
  - "First token latency critical for UX"

# Thread System
thread_learnings:
  - "Thread types enforce different behaviors"
  - "Participant management needs system messages"
  - "Message metadata crucial for agent learning"
  - "Thread ID format: Use UUIDs everywhere"
```

### Integration Gotchas
```yaml
# Common Issues
gotchas:
  - issue: "SSE connection drops"
    solution: "Implement exponential backoff"
    
  - issue: "Thread state sync"
    solution: "Use server as single source of truth"
    
  - issue: "Agent response delays"
    solution: "Show typing indicators immediately"
    
  - issue: "Multi-tenant data leakage"
    solution: "Always filter by org_id in queries"
```

### Team Task Tracking
```yaml
# Current Sprint Tasks
backend_tasks:
  - status: "blocked"
    task: "Fix Letta multi-tenant connection"
    blocker: "Container health endpoint"
    
  - status: "in_progress"
    task: "Thread database schema"
    assignee: "backend_team"
    
frontend_tasks:
  - status: "pending"
    task: "ChatInterface component"
    dependency: "SSE endpoint from backend"
    
cli_tasks:
  - status: "in_progress"
    task: "Project memory management"
    assignee: "cli_team"
```

---

## 🎯 Custom Instructions

### Personal Preferences
> Add your specific preferences here. This section will override default behavior.

**Example:**
- "Always use functional programming patterns"
- "Prefer verbose variable names for clarity"
- "Include extensive error handling with custom error types"
- "Use dependency injection for better testability"

### Project-Specific Rules
> Add rules specific to your current project.

**Example:**
- "This is a financial application - security is paramount"
- "We're building for mobile-first - optimize for small screens"
- "This needs to scale to 1M+ users - design accordingly"

---

*This file should be updated regularly as your project evolves and your preferences change. The agents will use this as their primary guidance for how to assist you.*