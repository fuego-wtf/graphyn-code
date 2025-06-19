# Graphyn CLI Usage Guide (Ink Version)

## Quick Start

```bash
# Install globally
npm install -g @graphyn/code

# Or use npx
npx @graphyn/code

# Launch interactive mode
graphyn
```

## Interactive Mode Features

### Main Menu
- **Beautiful ASCII art logo** with rainbow gradient
- **Arrow key navigation** - Up/Down to move, Enter to select
- **Keyboard shortcuts** - ESC to go back, Ctrl+C to exit
- **Real-time updates** - No screen flashing

### Available Options

#### AI Agents
- ⚡ **Backend Agent** - Backend development assistance
- ✨ **Frontend Agent** - Frontend development help
- 🏗️ **Architect Agent** - System architecture guidance
- 🎨 **Design Agent** - UI/UX and Figma integration
- 🤖 **CLI Agent** - CLI development support

#### Management Tools
- 📋 **Manage Threads** - Create and manage conversation threads
- 🔐 **Authentication** - Login with API key or OAuth
- 🩺 **Doctor** - System health diagnostics
- 📊 **Monitor** - Real-time system metrics
- 🤝 **Collaborate** - Multi-agent collaboration

#### Utilities
- 📊 **Project Status** - View GRAPHYN.md status
- 🔄 **Sync GRAPHYN.md** - Pull/push documentation
- 📜 **History** - View recent interactions
- 🚀 **Share Agent** - Share agents with team

## Command Line Usage

### Agent Commands
```bash
# Direct agent queries
graphyn backend "add user authentication"
graphyn frontend "create responsive navbar"
graphyn architect "design microservices architecture"
graphyn design "https://figma.com/file/xyz"
graphyn cli "add progress bar to command"

# Short aliases
graphyn b "optimize database queries"  # backend
graphyn f "add dark mode"             # frontend
graphyn a "scale to 1M users"         # architect
graphyn d "extract components"        # design
graphyn c "add --verbose flag"        # cli
```

### Thread Management
```bash
# Open thread manager
graphyn threads

# Features:
# - Create new threads with name and description
# - View thread details and participants
# - Add/remove AI agents from threads
# - Stream real-time conversation updates
# - Delete threads when done
```

### Authentication
```bash
# Check current auth status
graphyn whoami

# Authenticate with API key
graphyn auth sk-your-api-key-here

# OAuth authentication (interactive)
graphyn auth
# Choose: GitHub or Figma OAuth

# Logout
graphyn logout
```

### System Commands
```bash
# Run system diagnostics
graphyn doctor
# Checks:
# - Node.js version
# - Network connectivity
# - API health
# - Auth status
# - Claude Code availability

# View project status
graphyn status
# Shows:
# - Repository info
# - GRAPHYN.md status
# - Customization metrics

# View interaction history
graphyn history
graphyn history -n 20  # Last 20 entries
```

### Advanced Features

#### Real-time Monitoring
```bash
# Launch system monitor
graphyn monitor
# Shows:
# - Active threads
# - Agent status
# - API metrics
# - Auto-refreshes every 5 seconds
```

#### Multi-Agent Collaboration
```bash
# Start collaborative session
graphyn collaborate "build a real-time chat app"
# Features:
# - Multiple agents work in parallel
# - Real-time progress updates
# - Aggregated responses
# - Session summary
```

#### GRAPHYN.md Sync
```bash
# Interactive sync menu
graphyn sync

# Options:
# - Pull: Get latest template
# - Push: Share your customizations
# - Edit: Open in default editor
```

## Keyboard Shortcuts

### Global
- **Ctrl+C** - Exit application
- **ESC** - Go back / Cancel
- **R** - Retry (when error shown)

### Navigation
- **↑/↓** - Navigate menus
- **↵** - Select item
- **Tab** - Next field
- **Shift+Tab** - Previous field

### Text Input
- **Ctrl+A** - Select all
- **Ctrl+K** - Clear after cursor
- **Ctrl+U** - Clear line

## Environment Variables

```bash
# API Configuration
export GRAPHYN_API_URL="https://api.graphyn.com"
export GRAPHYN_API_KEY="your-api-key"

# Development
export NODE_ENV="development"
export DEBUG="graphyn:*"

# Force color output
export FORCE_COLOR=1
```

## Error Handling

### Network Errors
- Automatic retry with exponential backoff
- Clear error messages with solutions
- Offline mode for cached operations

### API Errors
- Formatted error messages
- Suggested actions
- Link to documentation

### Recovery Options
- Press **R** to retry failed operations
- Press **ESC** to return to menu
- Run `graphyn doctor` for diagnostics

## Tips and Tricks

### 1. Quick Agent Access
```bash
# Use aliases for speed
graphyn b "query"  # Instead of 'backend'
graphyn f "task"   # Instead of 'frontend'
```

### 2. Batch Operations
```bash
# Create multiple threads quickly
graphyn threads  # Then use 'c' shortcut
```

### 3. Context Preservation
```bash
# Threads remember context
# Continue conversations across sessions
```

### 4. Efficient Navigation
```bash
# Type first letter in menus
# 'b' for Backend, 'f' for Frontend, etc.
```

## Troubleshooting

### "Command not found"
```bash
# Ensure global installation
npm list -g @graphyn/code

# Reinstall if needed
npm install -g @graphyn/code
```

### "Cannot connect to API"
```bash
# Check API status
graphyn doctor

# Verify API URL
echo $GRAPHYN_API_URL
```

### "Raw mode not supported"
```bash
# Use a proper terminal
# Avoid piping or redirecting
graphyn  # Direct execution
```

### "Authentication failed"
```bash
# Re-authenticate
graphyn logout
graphyn auth
```

## Best Practices

1. **Use threads** for complex tasks requiring multiple queries
2. **Save API keys** in environment variables, not command history
3. **Run doctor** when experiencing issues
4. **Update regularly** with `npm update -g @graphyn/code`
5. **Check history** to track and learn from past interactions