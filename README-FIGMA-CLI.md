# 🎨 Multi-Agent Figma-to-Code CLI

> Transform Figma prototypes into production-ready applications using specialized Claude Code agents working in parallel.

## Overview

This CLI orchestrates multiple specialized Claude Code agents to analyze Figma prototypes and generate complete full-stack applications. Each agent has a specific role in the development process, working concurrently to simulate a professional development team.

### 🤖 Multi-Agent Architecture

- **Architecture Agent**: System design, infrastructure planning, and technology stack decisions
- **Design System Agent**: Component library extraction, design token analysis, and style guide generation
- **Frontend Agent**: UI component implementation, responsive layouts, and interactive features
- **Backend Agent**: API development, database schema, and server-side logic
- **Testing Agent**: Test suite generation, validation scripts, and quality assurance
- **DevOps Agent**: Deployment configuration, CI/CD pipelines, and infrastructure as code

### ✨ Key Features

- **Parallel Execution**: 3-8 agents working simultaneously
- **Git Worktree Isolation**: Each agent works in an isolated git environment
- **Tmux Session Management**: Coordinated terminal sessions for real-time monitoring
- **Technology-Aware Generation**: Context-aware code generation based on chosen stack
- **Progress Tracking**: Real-time updates and comprehensive logging
- **Professional Simulation**: Mimics how a real development team would tackle the project

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Claude CLI configured and authenticated
- Figma Personal Access Token
- Git (for worktree management)
- Tmux (for session coordination)

### Installation

```bash
# Clone the repository
cd /path/to/graphyn-workspace/code

# Install dependencies
npm install

# Setup Figma integration
npm run figma:setup
```

### Basic Usage

```bash
# Quick start with React + Tailwind
npm run cli figma quick "https://www.figma.com/proto/your-prototype-url"

# Interactive setup with custom options
npm run cli figma generate "https://www.figma.com/proto/your-prototype-url"

# Automated generation with CLI flags
npm run cli figma generate "https://www.figma.com/proto/your-prototype-url" \
  --framework react \
  --styling tailwind \
  --backend node \
  --database postgres \
  --agents 6 \
  --auto
```

## 📖 Commands Reference

### Setup Commands

```bash
# Configure Figma MCP integration
npm run figma:setup

# Check system status
npm run figma:status

# List active agent sessions
npm run figma:agents
```

### Generation Commands

```bash
# Interactive workflow (recommended for first-time users)
npm run cli figma generate <figma-url>

# Quick start with sensible defaults
npm run cli figma quick <figma-url>

# Automated generation with options
npm run cli figma generate <figma-url> [options]
```

#### CLI Options

- `--framework <framework>`: Frontend framework (react, vue, angular)
- `--styling <styling>`: Styling solution (tailwind, styled-components, css-modules)
- `--backend <backend>`: Backend technology (node, python, go)
- `--database <database>`: Database (postgres, mongodb, sqlite)
- `--output <dir>`: Output directory (default: ./figma-generated)
- `--agents <number>`: Max concurrent agents 3-8 (default: 6)
- `--deployment`: Enable deployment configuration
- `--no-testing`: Disable test generation
- `--auto`: Skip interactive prompts

## 🔧 Configuration

### Environment Variables

```bash
# Required
export FIGMA_PERSONAL_ACCESS_TOKEN="your-figma-token"

# Optional
export CLAUDE_API_KEY="your-claude-api-key"
export MAX_CONCURRENT_AGENTS=6
export AGENT_TIMEOUT_MINUTES=30
export ENABLE_DETAILED_LOGGING=true
```

### Figma Token Setup

1. Go to [Figma Settings > Personal Access Tokens](https://www.figma.com/settings)
2. Generate a new token with appropriate permissions
3. Set the environment variable: `FIGMA_PERSONAL_ACCESS_TOKEN`

## 🎯 Supported Technology Stacks

### Frontend Frameworks
- **React** (with TypeScript, Vite, modern hooks)
- **Vue 3** (with Composition API, TypeScript support)
- **Angular** (latest version, standalone components)

### Styling Solutions
- **Tailwind CSS** (with JIT, custom design tokens)
- **Styled Components** (with theme provider)
- **CSS Modules** (with PostCSS, modern features)

### Backend Technologies
- **Node.js** (Express, Fastify, or NestJS)
- **Python** (FastAPI or Django)
- **Go** (Gin or Echo framework)

### Databases
- **PostgreSQL** (with migrations, relations)
- **MongoDB** (with Mongoose schemas)
- **SQLite** (for development/prototyping)

## 🏗️ Workflow Example

```bash
# 1. Setup (one-time)
npm run figma:setup

# 2. Verify everything is working
npm run figma:status

# 3. Generate from Figma prototype
npm run cli figma generate "https://www.figma.com/proto/abc123/my-app"

# The CLI will:
# - Parse the Figma URL and fetch prototype data
# - Analyze screens, components, and design tokens
# - Create a multi-agent task plan
# - Spawn 6 specialized Claude Code agents in parallel
# - Each agent works in an isolated git worktree
# - Coordinate via tmux sessions
# - Generate and integrate code from all agents
# - Run tests and validation
# - Output final integrated application

# 4. Review generated code
cd ./figma-generated

# 5. Install dependencies and run
npm install
npm run dev
```

## 📊 Agent Coordination

### Task Decomposition

The system automatically breaks down the Figma prototype generation into specialized tasks:

1. **Architecture Planning** (Architecture Agent)
   - Technology stack analysis
   - Project structure design
   - Dependency management
   - Performance considerations

2. **Design System Extraction** (Design System Agent)
   - Color palette extraction
   - Typography analysis
   - Component categorization
   - Spacing and layout tokens

3. **Frontend Implementation** (Frontend Agent)
   - Component implementation
   - Responsive layouts
   - Interactive behaviors
   - Routing setup

4. **Backend Development** (Backend Agent)
   - API endpoint generation
   - Database schema design
   - Authentication logic
   - Business logic implementation

5. **Testing & Validation** (Testing Agent)
   - Unit test generation
   - Integration test suites
   - E2E test scenarios
   - Performance benchmarks

6. **Deployment Configuration** (DevOps Agent)
   - Docker configuration
   - CI/CD pipeline setup
   - Environment management
   - Infrastructure as code

### Real-Time Monitoring

```bash
# Watch agent progress in real-time
npm run figma:agents

# View detailed logs
tail -f /tmp/claude-agents/*/session.log
```

## 🛠️ Advanced Configuration

### Custom Agent Profiles

Create custom agent configurations in `src/agents/profiles/`:

```typescript
// src/agents/profiles/custom-frontend.ts
export const customFrontendProfile = {
  agentType: 'frontend',
  specialization: 'react-native',
  contextPrompt: `You are a React Native specialist...`,
  capabilities: ['mobile-ui', 'native-apis', 'performance-optimization'],
  preferences: {
    stateManagement: 'zustand',
    navigation: 'react-navigation-v6',
    styling: 'nativewind'
  }
};
```

### Workflow Customization

Extend the workflow in `src/setup/figma-mcp-setup.ts`:

```typescript
// Add custom post-processing steps
export async function customPostProcessing(result: MultiAgentResult) {
  // Custom validation
  await runCustomValidation(result);
  
  // Custom deployment
  await deployToCustomPlatform(result);
  
  // Custom notifications
  await notifyTeam(result);
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Figma Token Invalid**
   ```bash
   # Verify token
   curl -H "X-Figma-Token: YOUR_TOKEN" https://api.figma.com/v1/me
   ```

2. **Claude CLI Not Found**
   ```bash
   # Install Claude CLI
   npm install -g @anthropic-ai/claude-code
   
   # Verify installation
   claude --version
   ```

3. **Git Worktree Issues**
   ```bash
   # Clean up stale worktrees
   git worktree prune
   
   # Check worktree status
   git worktree list
   ```

4. **Tmux Session Problems**
   ```bash
   # List active sessions
   tmux list-sessions
   
   # Kill all claude agent sessions
   tmux kill-session -t claude-agent-*
   ```

### Debug Mode

```bash
# Enable detailed logging
export ENABLE_DETAILED_LOGGING=true

# Run with debug output
npm run cli figma generate <url> --verbose
```

### Performance Optimization

```bash
# Reduce concurrent agents for limited resources
npm run cli figma generate <url> --agents 3

# Skip testing for faster generation
npm run cli figma generate <url> --no-testing

# Use local development database
npm run cli figma generate <url> --database sqlite
```

## 📈 Metrics and Analytics

### Generation Metrics

The CLI tracks various metrics during generation:

- **Total Generation Time**: End-to-end duration
- **Agent Utilization**: Per-agent task completion times
- **Code Quality Scores**: Static analysis results
- **Test Coverage**: Generated test suite coverage
- **Performance Benchmarks**: Generated app performance metrics

### Output Structure

```
figma-generated/
├── src/
│   ├── components/         # Frontend components
│   ├── pages/             # Application pages
│   ├── api/               # Backend API routes
│   ├── styles/            # Design system styles
│   └── tests/             # Generated test suites
├── docs/
│   ├── architecture.md    # System architecture
│   ├── design-system.md   # Design token documentation
│   └── deployment.md      # Deployment instructions
├── scripts/
│   ├── setup.sh          # Environment setup
│   └── deploy.sh         # Deployment script
├── docker/
│   ├── Dockerfile        # Container configuration
│   └── docker-compose.yml
└── .github/
    └── workflows/        # CI/CD pipelines
```

## 🤝 Contributing

### Development Setup

```bash
# Clone and setup
git clone <repo-url>
cd code
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Adding New Agent Types

1. Create agent profile in `src/agents/profiles/`
2. Implement agent logic in `src/agents/`
3. Update the multi-agent manager
4. Add tests and documentation

### Extending Framework Support

1. Add framework configuration in `src/frameworks/`
2. Create templates in `templates/`
3. Update the CLI options
4. Test with sample prototypes

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Figma API](https://www.figma.com/developers/api) for design data access
- [Claude Code](https://docs.anthropic.com/claude/docs/claude-code) for AI-powered development
- [MCP](https://modelcontextprotocol.io/) for context integration
- Open source community for inspiration and tools

---

**Happy coding with multi-agent Figma-to-code generation!** 🎨✨
