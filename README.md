<div align="center">

# Graphyn Code 🚀

### Free AI Development Tool for Claude Code Users

[![Version](https://img.shields.io/badge/version-2.0.0-3267F5.svg)](https://github.com/graphyn-xyz/graphyn-code)
[![License](https://img.shields.io/badge/license-MIT-A67763.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-graphyn-C0B7FD.svg)](https://graphyn.xyz)

<img src="docs/assets/graphyn-code-banner.png" alt="Graphyn Code" width="600">

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 **Specialized AI Agents**
Backend, Frontend, and Architect agents with deep knowledge and context awareness

### 🆓 **Free Forever**
Completely free for Claude Code users - no credit card, no limits, unlimited usage

### 🎯 **Smart Context Detection**
Automatically detects which agent to use based on your current directory and project

</td>
<td width="50%">

### 🔄 **Agent Collaboration**
Chain multiple agents together to solve complex problems collaboratively

### 📊 **Session Management**
Track conversations and maintain context across multiple interactions

### 🎨 **Beautiful CLI**
Graphyn-branded terminal UI with colors, animations, and visual feedback

</td>
</tr>
</table>

## 🚀 Quick Start

### Installation

```bash
# One-line install
curl -sSL https://graphyn.xyz/code | bash

# Or manual install
git clone https://github.com/graphyn-xyz/graphyn-code.git
cd graphyn-code
./scripts/install.sh
```

### First Time Setup

```bash
# 1. Get your FREE API key
# Visit: https://graphyn.xyz/code

# 2. Authenticate 
graphyn auth gph_xxxxxxxxxxxx

# 3. Start coding with AI!
graphyn "help me build a REST API"
```

## 📸 Screenshots

<div align="center">
<table>
<tr>
<td><img src="docs/assets/fuego-auth.png" alt="Authentication" width="400"></td>
<td><img src="docs/assets/fuego-chat.png" alt="Chat Interface" width="400"></td>
</tr>
<tr>
<td><img src="docs/assets/fuego-chain.png" alt="Agent Chain" width="400"></td>
<td><img src="docs/assets/fuego-context.png" alt="Context Detection" width="400"></td>
</tr>
</table>
</div>

## 🎯 Usage

### Basic Commands

```bash
# Auto-detect context from current directory
graphyn "How do I implement SSE endpoints?"

# Explicitly specify an agent
graphyn --backend "Create a new API endpoint"
graphyn --frontend "Build a dashboard component"
graphyn --architect "Review our microservices design"

# Interactive mode (no message)
graphyn --backend
```

### Context Detection

Fuego automatically detects which agent to use based on:

- 📁 **Directory path**: `/backend`, `/frontend`, `/misc`
- 📄 **Project files**: `package.json`, `encore.app`, `next.config.js`
- 🌿 **Git branch**: `feature/backend-*`, `frontend-*`, `arch-*`
- 💾 **Saved preference**: Set with `--set-default`

```bash
# Check current context
fuego --context

# Set default context
fuego --set-default backend
```

### Agent Collaboration

Chain multiple agents together for complex tasks:

```bash
# Agents work together to implement a feature
fuego --chain "implement real-time notifications"

# This will:
# 1. Frontend agent designs the UI requirements
# 2. Backend agent implements the API
# 3. Architect reviews the implementation
```

### Authentication

```bash
# Authenticate with your API key
fuego auth gph_xxxxxxxxxxxx

# Check authentication status
fuego whoami

# Logout
fuego logout
```

## 🛠️ Configuration

### Environment Variables

```bash
# Custom home directory
export FUEGO_HOME="$HOME/.fuego"

# API endpoint (for development)
export GRAPHYN_API_URL="https://api.graphyn.ai/v1"

# Request timeout (seconds)
export GRAPHYN_API_TIMEOUT="30"
```

### Configuration File

Fuego stores configuration in `~/.fuego/config/settings.json`:

```json
{
  "version": "2.0.0",
  "editor": "vim",
  "log_level": "info",
  "history_size": 1000,
  "auto_update": true,
  "theme": "graphyn"
}
```

## 🏗️ Architecture

### Project Structure

```
fuego-cli/
├── scripts/
│   ├── fuego          # Main CLI executable
│   └── install.sh     # Installation script
├── prompts/
│   ├── backend.md     # Backend agent prompt
│   ├── frontend.md    # Frontend agent prompt
│   └── architect.md   # Architect agent prompt
├── config/
│   └── version.txt    # Version tracking
├── docs/
│   └── todo.md        # Development tasks
└── README.md          # This file
```

### Agent Roles

#### 🔧 Backend Agent
- Specializes in Encore.ts and backend development
- Handles API design, database operations, and real-time features
- Focuses on security, scalability, and performance

#### 🎨 Frontend Agent
- Expert in React, Next.js, and modern web development
- Creates intuitive UIs and developer experiences
- Implements real-time features and API integrations

#### 🏗️ Architect Agent
- System design and architecture decisions
- Reviews implementations and suggests improvements
- Ensures scalability and maintainability

## 🔒 Security

- API keys are stored securely with 600 permissions
- Keys are validated against expected format
- Never logged in full (only first 8 chars shown)
- Secure session management for agent interactions

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Make your changes
4. Run tests (`./tests/validate.sh`)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing`)
7. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/fuego-cli.git
cd fuego-cli

# Install in development mode
FUEGO_INSTALL_DIR="$PWD" ./scripts/install.sh

# Make changes and test
fuego --help
```

## 🐛 Troubleshooting

### Common Issues

**"Command not found"**
```bash
# Add to PATH
echo 'export PATH="$PATH:/usr/local/bin"' >> ~/.zshrc
source ~/.zshrc
```

**"Permission denied"**
```bash
# Install to user directory
FUEGO_BIN_DIR=~/.local/bin ./scripts/install.sh
```

**"API key invalid"**
- Ensure key starts with `gph_`
- Check key hasn't expired
- Verify at https://graphyn.ai/settings/api

### Debug Mode

```bash
# Enable debug logging
export FUEGO_LOG_LEVEL=debug
fuego --backend "test query"
```

## 📚 Advanced Usage

### Custom Prompts

Create custom agent prompts:

```bash
# Copy template
cp prompts/backend.md prompts/custom.md

# Edit your custom prompt
vim prompts/custom.md

# Use custom agent
fuego --custom "your query"
```

### Session History

Sessions are stored in `~/.fuego/sessions/`:

```bash
# View recent sessions
ls -la ~/.fuego/sessions/

# Read session details
cat ~/.fuego/sessions/backend_*.json | jq
```

## 🎨 Design System

Fuego uses Graphyn's visual identity:

- **Primary Blue**: `#3267F5`
- **Light Purple**: `#C0B7FD`
- **Tan Brown**: `#A67763`
- **Dark Brown**: `#2D160B`

The CLI features:
- Clean, spacious layouts
- Consistent iconography
- Smooth animations
- Visual feedback for all operations

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with 💙 by the [Graphyn](https://graphyn.ai) team
- Powered by Claude AI and the Graphyn platform
- Special thanks to all contributors

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/graphyn-xyz/fuego-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/graphyn-xyz/fuego-cli/discussions)
- **Email**: support@graphyn.ai
- **Discord**: [Join our community](https://discord.gg/graphyn)

---

<div align="center">

**[Documentation](https://docs.graphyn.ai/fuego)** • **[API Reference](https://api.graphyn.ai/docs)** • **[Blog](https://graphyn.ai/blog)**

</div>