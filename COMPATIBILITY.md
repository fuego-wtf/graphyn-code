# Graphyn Code Compatibility

## Platform Support

### ✅ Fully Supported
- **macOS** (Intel & Apple Silicon)
- **Linux** (Ubuntu, Debian, CentOS, etc.)

### ⚠️ Experimental Support
- **Windows** (PowerShell, cmd, WSL)
  - Basic functionality works
  - Some terminal features may be limited
  - WSL recommended for best experience

### ❌ Limited Support
- FreeBSD, OpenBSD, Solaris, AIX
- Basic CLI may work but not tested

## Node.js Requirements

### ✅ Supported Versions
- **Node.js 16+** (required)
- **Node.js 18** (LTS - recommended)
- **Node.js 20** (LTS - recommended)
- **Node.js 22** (current)

### ❌ Unsupported
- Node.js 14 and below (ESM dependency conflicts)

## Terminal Compatibility

### ✅ Fully Compatible
- **Bash** (Linux/macOS default)
- **Zsh** (macOS default)
- **Fish shell**
- **VS Code integrated terminal**
- **iTerm2, Terminal.app**

### ⚠️ Limited Compatibility
- **Windows PowerShell** - Basic functionality
- **Windows cmd** - Basic functionality
- **Git Bash on Windows** - Should work

## Dependencies

### Core Dependencies
- `commander` - CLI framework ✅
- `inquirer` - Interactive prompts ✅
- `ora` - Spinners (requires Node 16+) ⚠️
- `chalk` - Colors (ESM, requires Node 12+) ⚠️
- `boxen` - Boxes (ESM, requires Node 14+) ⚠️

### External Dependencies
- **Claude Code** - Optional but recommended
- **Figma Desktop** - Required for MCP design features
- **MCP Proxy** - Auto-installed for Figma integration

## Architecture Support

### ✅ Tested
- **x64** (Intel 64-bit)
- **arm64** (Apple Silicon, ARM64)

### ⚠️ Should Work
- **x86** (32-bit) - Not tested
- **armv7** - Not tested

## Checking Your Compatibility

Run the compatibility check:
```bash
graphyn doctor -v
```

This will show:
- Platform support level
- Node.js version compatibility
- Terminal environment
- Dependencies status

## Known Issues

### Windows-Specific
- Path separators (handled automatically)
- PowerShell execution policies may block scripts
- Terminal colors may not render properly in cmd

### Node.js Version Issues
- **Node 14**: ESM dependency conflicts
- **Node 12**: Multiple compatibility issues

### Terminal Issues
- Raw mode conflicts with some terminals
- Unicode characters may not render in all terminals

## Recommendations

### For Best Experience
1. **macOS/Linux** with **Node 18+**
2. **Modern terminal** (iTerm2, VS Code, etc.)
3. **Claude Code installed** and configured

### Windows Users
1. **Use WSL2** for best compatibility
2. **PowerShell 7+** preferred over cmd
3. **Git Bash** as alternative

### Troubleshooting
1. Run `graphyn doctor` to diagnose issues
2. Update Node.js to latest LTS
3. Check platform-specific instructions

## Future Improvements

- Full Windows PowerShell testing
- CI testing across platforms
- Better terminal detection
- Fallback modes for limited environments