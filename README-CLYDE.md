# 🤖 Clyde - Smart Claude Code Orchestrator

**Revolutionary dual-mode AI agent development with Git-like workflow**

Clyde transforms Claude Code into an intelligent orchestrator that provides the best standalone experience while enabling seamless team collaboration through Graphyn's platform.

## 🚀 Quick Start

### Installation
```bash
npm install -g @graphyn/code
```

### Usage

#### Interactive Mode (Recommended)
```bash
clyde
```

This launches the interactive terminal where you can have natural conversations:
```
🤖 clyde > create "a helpful code reviewer that checks for security issues"
🤖 clyde > build a React component for user authentication  
🤖 clyde > test the current project
🤖 clyde > help
```

#### Direct Command Mode
```bash
clyde "create a REST API endpoint for user authentication"
clyde "optimize the database queries in my project"
clyde "add comprehensive tests to my React components"
```

## ✨ Core Features

### 🎯 Natural Language Interface
Just describe what you want - no complex commands or flags:
- `create "a security-focused code reviewer"`  
- `build a user authentication system`
- `optimize my database performance`
- `add tests to my React components`

### 🔄 Dual-Mode Architecture

#### 🏠 Standalone Mode (Default)
- **Pure Claude Code integration** - Works entirely through Claude Code
- **Local development** - Perfect for individual work
- **No authentication required** - Start immediately
- **Full offline capability** - No internet dependency

#### 🌐 Dynamic Mode  
- **Claude Code + Graphyn APIs** - Enhanced team collaboration
- **Cloud sync and deployment** - Share agents across team
- **Multi-device continuity** - Resume work anywhere
- **Production deployment** - One-click agent deployment

### ⚡ Auto-Management
- **Smart Context Detection** - Automatically analyzes your project
- **Agent Selection** - Picks optimal Claude Code agent for each task
- **Session Continuity** - Preserves context across commands
- **Error Recovery** - Intelligent fallback and retry mechanisms

## 🏗️ How It Works

### The Claude Code Integration

Clyde is a **smart wrapper** around Claude Code that:

1. **Analyzes your request** using natural language processing
2. **Builds enhanced context** from your project structure  
3. **Selects optimal agent** based on task type and project context
4. **Executes via Claude Code Task tool** with enriched prompts
5. **Processes results** and maintains session state

```typescript
// Inside Claude Code environment
const result = await Task({
  description: "User task: create authentication system",
  prompt: enhancedPromptWithProjectContext,
  subagent_type: "backend-dev" // Auto-selected
});
```

### Architecture Overview

```
User Input → Intent Parser → Context Builder → Agent Selector → Claude Code Task Tool → Result Processor
     ↓              ↓              ↓              ↓                    ↓                    ↓
"create auth" → agent.create → project context → backend-dev → Task execution → formatted output
```

## 🎮 Interactive Examples

### Creating an Agent
```
🏠 clyde > create "a helpful code reviewer that checks for security issues"
🧠 Processing your request...
🤖 Executing via Claude Code Task tool (coder)...
✅ Claude Code execution completed
✅ Agent created successfully!

📁 Files affected:
  📝 .claude/agents/security-reviewer.json

💡 Next steps:
  • Run the agent: clyde run security-reviewer
  • Test it: clyde test security-reviewer
```

### Building Features
```
🏠 clyde > build a React component for user authentication
🧠 Processing your request...
🤖 Executing via Claude Code Task tool (frontend-dev)...
✅ Claude Code execution completed

📁 Files affected:
  📝 src/components/AuthComponent.jsx
  📝 src/hooks/useAuth.js
  ✏️ src/App.jsx

⚡ Commands executed:
  $ npm install react-router-dom
  $ npm run test
```

### Testing Projects  
```
🏠 clyde > test the current project
🧠 Processing your request...  
🤖 Executing via Claude Code Task tool (tester)...
✅ Claude Code execution completed

✅ All tests passed
- Unit tests: 15/15
- Integration tests: 8/8  
- Coverage: 94%
```

## 🔧 Advanced Usage

### Mode Switching
```bash
# Switch to dynamic mode for team collaboration
clyde mode dynamic

# Switch back to standalone
clyde mode standalone  
```

### Agent Management
```bash
# List all agents
clyde list

# Run specific agent
clyde run my-agent

# Deploy to production (dynamic mode)
clyde deploy my-agent
```

### Sync Operations (Dynamic Mode)
```bash  
# Check sync status
clyde sync status

# Push local agents to cloud
clyde sync push

# Pull team agents
clyde sync pull
```

## 🚀 Claude Code Integration

### Requirements
Clyde requires Claude Code for full functionality:

```bash
npm install -g @anthropic/claude-code
```

### Running in Claude Code
When you run `clyde` within Claude Code environment:

✅ **Full functionality** - Real Task tool integration  
✅ **Enhanced context** - Project analysis and pattern detection  
✅ **Smart agent selection** - Optimal Claude Code agent for each task  
✅ **Session continuity** - Context preserved across commands  

### Running Outside Claude Code
When you run `clyde` outside Claude Code environment:

⚠️ **Limited functionality** - Clear guidance provided  
💡 **Helpful messages** - Instructions to enable full features  
📋 **Graceful degradation** - Still useful for planning and organization  

## 🎯 Examples by Project Type

### React/Next.js Projects
```bash
clyde "add authentication with NextAuth.js"
clyde "create a responsive dashboard component"  
clyde "optimize bundle size and loading performance"
clyde "add comprehensive unit tests with Jest"
```

### Node.js/Express APIs
```bash
clyde "create RESTful API endpoints for user management"
clyde "add JWT authentication middleware"
clyde "implement rate limiting and security headers"
clyde "add comprehensive API testing with supertest"
```

### Python Projects
```bash
clyde "create a FastAPI application with authentication"
clyde "add database models with SQLAlchemy" 
clyde "implement comprehensive pytest test suite"
clyde "add Docker configuration for deployment"
```

## 🛠️ Configuration

### Project Setup
Clyde automatically detects project types and configurations:

- **package.json** → Node.js project with framework detection
- **requirements.txt** → Python project with dependency analysis  
- **Cargo.toml** → Rust project with crate analysis
- **.git/** → Git repository with branch and status info

### Session Storage
Clyde maintains session data in `.claude/` directory:
```
.claude/
├── agents/          # Local agent configurations
├── sessions/        # Session history and context
└── config.json     # User preferences and settings
```

## 🔍 Troubleshooting

### Claude Code Not Available
```
⚠️ Claude Code Task tool not available
For full functionality, run within Claude Code environment
💡 Install: npm install -g @anthropic/claude-code
```

**Solution**: Install and run Clyde within Claude Code environment for full functionality.

### Task Execution Fails
```  
❌ Claude Code execution failed: timeout
```

**Solutions**:
- Break complex tasks into smaller parts
- Simplify requirements and try again
- Check project context and dependencies

### Permission Issues
```
🔒 Permission denied
```

**Solutions**:
- Check file/directory permissions
- Ensure Clyde has access to working directory
- Run with appropriate user privileges

## 🚀 What Makes Clyde Different

### 1. **Conversational Building**
Describe what you want, get working code - no forms, wizards, or complex configurations.

### 2. **"Git for AI Agents"**  
Complete version control workflow for AI agents with push/pull/sync operations.

### 3. **Seamless Mode Switching**
Start local, go global when ready - no configuration changes needed.

### 4. **Context-Aware Intelligence**
Automatically detects project type, frameworks, patterns, and conventions.

### 5. **Progressive Enhancement**
Works offline in standalone mode, enhanced online with team features.

## 📚 Learn More

- **Architecture**: See `src/clyde/` for implementation details
- **Agent Types**: Check `src/types/claude-code.d.ts` for available agents  
- **Examples**: Explore `examples/` directory for common patterns
- **API**: Review `src/api/` for Graphyn integration details

---

**Ready to revolutionize your development workflow?**

```bash
npm install -g @graphyn/code
clyde
```

Welcome to the future of AI-assisted development! 🚀