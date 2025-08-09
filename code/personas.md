# Graphyn Code CLI User Personas

This document defines the key user personas for Graphyn Code CLI, focusing on developers who use it to create AI development squads through Claude Code.

## David - Individual Developer (CLI Power User)

**Profile**: Solo developer who prefers CLI over GUI for everything

**Background**:
- 5+ years using terminal-based tools
- Already uses Claude Code daily via MCP
- Works on multiple projects simultaneously
- Values speed and keyboard-driven workflows

**Goals**:
- Create AI squads without leaving terminal
- Maintain context across different projects
- Automate repetitive development tasks
- Quick access to specialized agents

**Pain Points**:
- Context switching between projects
- Remembering complex CLI commands
- Setting up new projects repeatedly
- Managing multiple agent configurations

**Graphyn Code Usage**:
```bash
graphyn "add user auth to my Next.js app"     # Natural language
graphyn backend "implement Redis caching"       # Domain-specific
graphyn design "https://figma.com/..."         # Design-to-code
graphyn --resume                               # Continue last session
```

---

## Sarah - Dev Agency Owner (Team CLI User)

**Profile**: Manages team of developers using shared CLI tools

**Background**:
- Runs 10-person development agency
- Standardizes tools across team
- Multiple client projects running
- Needs consistent workflows

**Goals**:
- Share agent configurations with team
- Consistent code standards across projects
- Quick onboarding for new developers
- Client-specific squad templates

**Pain Points**:
- Team members using different approaches
- Knowledge not shared between projects
- Onboarding takes too long
- Client requirements vary widely

**Graphyn Code Usage**:
```bash
graphyn init --team "acme-corp"               # Team setup
graphyn "create e-commerce for StyleHub"      # Client project
graphyn squad --share                         # Share with team
graphyn config --export > team-config.json   # Export settings
```

---

## Jordan - Backend API Developer (Specialist)

**Profile**: Expert backend developer who lives in the terminal

**Background**:
- Specializes in API development
- Uses vim/neovim exclusively
- Automates everything possible
- Contributes to open source

**Goals**:
- Quick API scaffolding
- Consistent error handling
- Automated testing setup
- Performance optimization

**Pain Points**:
- Repetitive CRUD implementations
- Maintaining API documentation
- Setting up test environments
- Debugging complex systems

**Graphyn Code Usage**:
```bash
graphyn backend "create REST API for users"   # Quick scaffolding
graphyn test "add integration tests"          # Testing focus
graphyn architect "optimize for 10k RPS"      # Performance
graphyn --context backend/                    # Backend-only context
```

---

## Alex - UI/UX Designer-Developer (Design-to-Code)

**Profile**: Bridges design and development using CLI tools

**Background**:
- Proficient in both Figma and code
- Uses CLI for build processes
- Values pixel-perfect implementation
- Focuses on design systems

**Goals**:
- Convert Figma designs quickly
- Maintain design consistency
- Generate accessible components
- Automate asset extraction

**Pain Points**:
- Manual design token updates
- Keeping code synced with designs
- Extracting assets repeatedly
- Accessibility compliance

**Graphyn Code Usage**:
```bash
graphyn design "https://figma.com/file/..."   # Direct conversion
graphyn "extract design tokens"               # Token generation
graphyn frontend "make components accessible" # A11y focus
graphyn design --watch                        # Auto-sync mode
```

---

## Casey - Open Source Maintainer (Community Leader)

**Profile**: Maintains popular libraries via CLI workflows

**Background**:
- Heavy GitHub CLI user
- Manages contributor PRs
- Automated release processes
- Documentation-focused

**Goals**:
- Efficient PR reviews
- Consistent code standards
- Automated releases
- Community engagement

**Pain Points**:
- Reviewing varied code styles
- Maintaining changelogs
- Security vulnerability checks
- Breaking change detection

**Graphyn Code Usage**:
```bash
graphyn "review PR #234 for security"         # PR analysis
graphyn "generate changelog from commits"     # Release prep
graphyn test "check breaking changes"         # Compatibility
graphyn squad --contributors                  # Contributor mode
```

---

## Morgan - DevOps Engineer (Infrastructure Focus)

**Profile**: Infrastructure automation expert using CLI

**Background**:
- Everything as code philosophy
- Docker/K8s expert
- CI/CD pipeline master
- Monitoring enthusiast

**Goals**:
- Infrastructure automation
- Deployment standardization
- Monitoring setup
- Security hardening

**Pain Points**:
- Complex deployment configs
- Secret management
- Debugging production issues
- Keeping docs updated

**Graphyn Code Usage**:
```bash
graphyn devops "deploy to kubernetes"         # Deployment
graphyn "add prometheus monitoring"           # Monitoring
graphyn security "scan for vulnerabilities"   # Security
graphyn infra --dry-run                      # Safe testing
```

---

## Taylor - Full-Stack Developer (Rapid Prototyper)

**Profile**: Builds MVPs quickly using CLI tools

**Background**:
- Hackathon regular
- Startup experience
- Pragmatic tool choices
- Speed over perfection

**Goals**:
- Rapid prototyping
- Quick deployments
- Feature validation
- User feedback loops

**Pain Points**:
- Boilerplate setup time
- Choosing right stack
- Quick deployment options
- Feature prioritization

**Graphyn Code Usage**:
```bash
graphyn "create MVP for task tracker"         # Quick start
graphyn fullstack "add real-time updates"    # Feature addition
graphyn deploy "to vercel"                    # Quick deploy
graphyn --quick                               # Speed mode
```

---

## Common CLI Usage Patterns

### Quick Commands
- `graphyn` - Interactive mode with Ink UI
- `graphyn "natural language request"` - Direct squad creation
- `graphyn --resume` - Continue last session
- `graphyn --help` - Context-aware help

### Domain-Specific
- `graphyn backend "..."` - Backend-focused squad
- `graphyn frontend "..."` - Frontend-focused squad
- `graphyn design "..."` - Design-to-code squad
- `graphyn devops "..."` - Infrastructure squad

### Team Features
- `graphyn init --team` - Team setup
- `graphyn squad --share` - Share configurations
- `graphyn config --export` - Export settings
- `graphyn --org <name>` - Organization context

### Advanced Usage
- `graphyn --context <path>` - Specific folder context
- `graphyn --model <name>` - Choose AI model
- `graphyn --dry-run` - Preview without execution
- `graphyn --verbose` - Detailed output

These personas guide the CLI design to ensure it serves the diverse needs of modern developers who prefer terminal-based workflows.