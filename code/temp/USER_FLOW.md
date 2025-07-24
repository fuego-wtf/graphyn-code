# Graphyn CLI User Flow

## Overview
Graphyn CLI provides multiple entry points and interaction modes for working with AI agents specialized for different development tasks.

## Entry Points

### 1. Interactive Mode
```bash
graphyn
```
- Shows animated logo with random colors
- Displays main menu with agent options
- User navigates with arrow keys
- Select with Enter key

### 2. Direct Agent Mode
```bash
graphyn <agent> "<query>"
```
Examples:
- `graphyn backend "create auth API"`
- `graphyn frontend "build dashboard"`
- `graphyn architect "design microservices"`
- `graphyn design "https://figma.com/file/..."`
- `graphyn cli "add test command"`

### 3. Authentication Flow
```bash
graphyn auth          # Manage authentication
graphyn auth [key]    # Set API key directly
```

### 4. Design System Flow
```bash
graphyn design auth                    # Authenticate with Figma
graphyn design <figma-url>            # Extract design from Figma
graphyn design <figma-url> --extract-components  # Extract component library
```

## Detailed User Flows

### Flow 1: First Time User
```
1. User runs: graphyn
2. System checks for .graphyn folder
   - If not exists: Creates .graphyn/ with init.md, docs/
3. Shows main menu with random colored logo
4. User selects agent (e.g., Backend)
5. System prepares context:
   - Loads agent prompt from prompts/backend.md
   - Loads project context from GRAPHYN.md
   - Combines with user query
6. Launches Claude Code with context
7. Logs interaction to ~/.graphyn/history/
8. Exits graphyn CLI
```

### Flow 2: Direct Command User
```
1. User runs: graphyn backend "add auth endpoints"
2. System immediately:
   - Checks Claude Code availability
   - Prepares agent context
   - Launches Claude Code
   - No menu interaction needed
3. User continues in Claude Code
```

### Flow 3: Authentication Flow
```
1. User runs: graphyn auth
2. Shows authentication menu:
   - 🔑 Enter API Key
   - 🚀 Login with Graphyn (OAuth)
   - 🧪 Get Test Token
3. OAuth flow:
   - Opens browser to graphyn.com
   - User logs in
   - Callback to localhost
   - Stores token in ~/.graphyn/config.json
4. Returns to main menu
```

### Flow 4: Figma Design Import
```
1. User runs: graphyn design "https://figma.com/file/..."
2. Checks Figma authentication
   - If not authenticated: Shows auth instructions
3. Connects to Figma API
4. Analyzes prototype:
   - Extracts screens and navigation
   - Downloads frame images to /design/frames/
   - Extracts SVG assets
5. Generates implementation plan
6. Launches Claude Code with:
   - Design context
   - Component structure
   - Implementation tasks
```

### Flow 5: Component Extraction
```
1. User runs: graphyn design <url> --extract-components
2. Extracts entire design system:
   - Atomic components (buttons, inputs)
   - Molecules (cards, forms)
   - Organisms (headers, sections)
   - Design tokens (colors, typography)
3. Creates component mapping
4. Launches Claude Code with component library context
```

## Navigation Controls

### Main Menu
- **↑↓** - Navigate options
- **Enter** - Select option
- **ESC** - Exit/Back
- **Ctrl+C** - Force exit

### Color System
- Logo: Random colors on each launch
- Selected items: Random accent color
- Unselected: Gray
- Help text: Random colors

## File Structure Created

### Project Level (.graphyn/)
```
.graphyn/
├── init.md              # Project notes and context
├── docs/
│   ├── sitemap.md      # Project structure
│   ├── servicemap.md   # Service architecture
│   └── temp/           # Temporary documentation
```

### User Level (~/.graphyn/)
```
~/.graphyn/
├── config.json         # API keys and settings
├── contexts/           # Saved agent contexts
│   ├── backend/
│   ├── frontend/
│   ├── architect/
│   ├── design/
│   └── cli/
├── history/            # Interaction logs
└── logs/              # Daily logs
```

## Error Handling

### Claude Code Not Found
```
1. Shows error message
2. Provides installation instructions:
   - Visit https://claude.ai/code
   - Download for platform
   - Run "graphyn doctor" to verify
```

### Authentication Failed
```
1. Shows error message
2. Suggests:
   - Check API key format (gph_xxx)
   - Try OAuth login
   - Get test token
```

### Figma Access Denied
```
1. Shows authentication required
2. Provides steps:
   - Exit tool (Ctrl+C)
   - Run: graphyn design auth
   - Complete OAuth
   - Retry command
```

## Exit Behaviors

### Success Exit
- Agent launched: Immediate exit after Claude launches
- Auth success: 2-second delay then menu
- Design import: 1-second delay after launch

### Error Exit
- Shows error message
- 5-second delay for reading
- Auto-exit

### Manual Exit
- ESC key: Return to previous menu
- Ctrl+C: Force exit immediately
- Menu "Exit": Clean shutdown

## Special Features

### Auto-initialization
- Creates .graphyn folder on first run
- Analyzes project structure
- Generates sitemap.md automatically

### Context Persistence
- All contexts saved to ~/.graphyn/contexts/
- 5-minute auto-cleanup of temp files
- History tracking for all interactions

### Random UI Colors
- Logo colors randomize each launch
- Menu selection colors randomize
- Prevents visual monotony
- Makes each session feel fresh