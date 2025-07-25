# Graphyn Code CLI Sitemap

This document provides a comprehensive overview of the Graphyn Code CLI's command architecture, interactive UI routes, and user journey flows.

**Last Updated**: 2025-01-19

## CLI Command Architecture

### Command Structure Overview

```
graphyn                       # Launch interactive mode (Ink UI)
├── init                      # Initialize Graphyn with OAuth
├── auth                      # Authenticate with platform
│   ├── login                 # OAuth login flow
│   ├── logout                # Clear credentials
│   └── status                # Check auth status
├── design <figma-url>        # Extract Figma design to code
│   ├── --extract-components  # Extract with i18n mapping
│   └── --output <dir>        # Specify output directory
├── thread                    # Thread management
│   ├── create                # Create new thread
│   ├── list                  # List all threads
│   └── show <id>             # Show thread details
├── agent                     # Agent operations
│   ├── create                # Create via builder conversation
│   ├── list                  # List available agents
│   ├── test <id>             # Test agent in thread
│   └── deploy <id>           # Deploy as API endpoint
├── backend <prompt>          # Backend development agent
├── frontend <prompt>         # Frontend development agent
├── architect <prompt>        # Architecture review agent
├── share <agent-id>          # Share agent with team
├── history                   # View interaction history
├── doctor                    # System diagnostics
│   └── -v                    # Verbose diagnostics
├── status                    # Current configuration
├── sync                      # Sync with backend
└── help                      # Show help
```

## Interactive Mode UI Architecture (Ink Components)

### Component Hierarchy

```
App.tsx (Root)
├── ErrorBoundary
│   └── ErrorFallback
├── MainMenu
│   ├── gradient-string (Banner)
│   ├── SelectInput (Menu items)
│   └── StatusBar
├── Authentication
│   ├── LoginFlow
│   ├── APIKeyInput
│   └── StatusDisplay
├── ThreadManagement
│   ├── ThreadList
│   ├── ThreadDetail
│   ├── ParticipantManager
│   └── MessageStream
├── AgentContext
│   ├── AgentSelector
│   ├── PromptInput
│   └── ClaudeLauncher
├── FigmaDesign
│   ├── URLInput
│   ├── ExtractionProgress
│   └── ComponentPreview
├── Doctor
│   ├── SystemChecks
│   ├── AuthStatus
│   └── DependencyValidator
└── Loading (Spinner states)
```

### Navigation Flow

```
[Launch] → MainMenu
    ├── "Work with Agents" → AgentContext → Claude Launch
    ├── "Manage Threads" → ThreadManagement
    │   ├── Create Thread
    │   ├── List Threads
    │   └── Thread Details → Participants/Messages
    ├── "Extract Figma Design" → FigmaDesign
    │   └── Extract → Preview → Claude Launch
    ├── "Authenticate" → Authentication
    │   ├── OAuth Flow → Browser
    │   └── API Key → Manual Input
    ├── "System Diagnostics" → Doctor
    └── "Exit" → Graceful shutdown
```

## User Journey Maps

### 1. First-Time User Journey

```
Install CLI → Launch graphyn → See welcome banner
    ↓
MainMenu → "Authenticate" → OAuth flow
    ↓
Browser opens → GitHub/Figma consent → Return to CLI
    ↓
"Work with Agents" → Select agent → Enter prompt
    ↓
Claude Code launches with context → Development begins
```

### 2. Figma Designer Journey

```
Designer has Figma prototype → graphyn design <url>
    ↓
CLI extracts components → Shows preview
    ↓
"Launch in Claude Code?" → Yes
    ↓
Claude opens with:
- Extracted design specs
- Component structure
- Implementation plan
- MCP context ready
```

### 3. Team Developer Journey

```
graphyn thread create → "Customer Support Bot"
    ↓
Builder agent joins → Conversational creation
    ↓
"I need a bot that handles refunds..."
    ↓
Agent created → Test in thread
    ↓
graphyn agent test <id> → WhatsApp-style testing
    ↓
Happy with results → graphyn agent deploy <id>
    ↓
Receives API endpoint → Integration ready
```

### 4. Repository-Aware Journey

```
cd existing-project/ → graphyn init
    ↓
CLI detects:
- Framework (Next.js, React, etc.)
- Patterns (hooks, components)
- Dependencies
- Git history
    ↓
Creates .graphyn/config.yaml → Agents understand project
    ↓
graphyn architect "review our auth flow"
    ↓
Agent responds with project-specific insights
```

## Keyboard Shortcuts & Controls

### Global Shortcuts
- `↑/↓` or `j/k` - Navigate menu items
- `Enter` - Select item
- `Tab` - Next field
- `Shift+Tab` - Previous field  
- `Ctrl+C` - Cancel/Exit
- `Esc` - Go back
- `?` - Show context help

### Component-Specific Controls

**MainMenu**
- Number keys `1-9` - Quick select menu items
- `/` - Search (when implemented)

**ThreadManagement**
- `n` - New thread
- `r` - Refresh list
- `d` - Delete thread (with confirmation)
- `Enter` - View thread details

**AgentContext**
- `Ctrl+Enter` - Launch Claude immediately
- `Ctrl+S` - Save prompt as template
- `Tab` - Cycle through agents

**FigmaDesign**
- `Ctrl+V` - Paste Figma URL
- `e` - Extract with components
- `l` - Launch in Claude after extraction

## Component Architecture Details

### State Management (Zustand)

```typescript
GraphynStore
├── auth
│   ├── isAuthenticated
│   ├── token
│   ├── user
│   └── organization
├── threads
│   ├── currentThread
│   ├── threads[]
│   └── messages[]
├── agents
│   ├── availableAgents[]
│   ├── selectedAgent
│   └── customAgents[]
├── ui
│   ├── currentView
│   ├── loading
│   └── error
└── config
    ├── apiUrl
    ├── theme
    └── shortcuts
```

### API Integration Points

```typescript
// All API calls go through GraphynAPIClient
GraphynAPIClient
├── auth
│   ├── login()
│   ├── logout()
│   └── getSession()
├── threads
│   ├── create()
│   ├── list()
│   ├── get()
│   ├── sendMessage()
│   └── streamMessages() // SSE
├── agents
│   ├── list()
│   ├── create()
│   ├── test()
│   └── deploy()
├── design
│   ├── extractFigma()
│   └── getExtraction()
└── repository
    ├── analyze()
    └── detectFramework()
```

### Error Handling Flow

```
User Action → Try Operation
    ↓
Success → Update UI
    ↓
Failure → ErrorBoundary catches
    ↓
Show ErrorFallback → Offer recovery options
    ├── "Retry" → Retry with backoff
    ├── "Report" → Send error report
    └── "Reset" → Clear state and restart
```

## File Organization

```
src/ink/
├── cli.tsx                    # Entry point
├── App.tsx                    # Root component
├── components/
│   ├── MainMenu.tsx          # Navigation hub
│   ├── AgentContext.tsx      # Agent interaction
│   ├── ThreadManagement.tsx  # Thread CRUD
│   ├── Authentication.tsx    # Auth flows
│   ├── FigmaDesign.tsx      # Design extraction
│   ├── Doctor.tsx           # Diagnostics
│   ├── Loading.tsx          # Loading states
│   └── StatusBar.tsx        # Global status
├── hooks/
│   ├── useAPI.ts            # API integration
│   ├── useKeyboardNavigation.ts
│   ├── useClaude.ts         # Claude integration
│   └── useErrorHandler.ts   # Error management
├── store.ts                  # Zustand store
└── contexts/
    └── APIContext.tsx        # API provider
```

## Integration Architecture

### With Claude Code
- Direct argument passing: `claude "${content}"`
- No terminal conflicts (both use Ink)
- Context includes full project understanding
- MCP server bundled for enhanced features

### With Graphyn Platform
- Standard REST API + SSE streams
- OAuth 2.0 authentication
- Organization-scoped operations
- Real-time thread updates

### With Development Workflow
- Git-aware operations
- Framework detection
- Pattern learning
- Team collaboration

## Performance Targets

- CLI startup: < 500ms
- Menu navigation: 60fps
- API response: < 200ms
- Claude launch: < 1s
- Design extraction: < 5s for large files

## Accessibility Features

- Full keyboard navigation
- Screen reader support (when available in terminal)
- High contrast mode
- Clear focus indicators
- Descriptive error messages

## Future UI Enhancements

1. **Search & Filter** - Quick agent/thread search
2. **Themes** - Light/dark/custom themes
3. **Shortcuts** - Customizable keybindings
4. **Plugins** - Third-party integrations
5. **Notifications** - Desktop notifications for long operations

---

This sitemap serves as the definitive guide to navigating and understanding the Graphyn Code CLI's user interface and command structure.