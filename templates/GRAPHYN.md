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