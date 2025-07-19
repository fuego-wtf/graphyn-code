# Ink Migration Plan for Graphyn Code

## Overview
Complete migration from traditional CLI (Commander.js + various UI libs) to modern reactive Ink framework with ESM modules.

## Detailed Task List with Dependencies

### Phase 1: Foundation (Critical Path)

#### Task 1: Create minimal Ink app that displays 'Hello Graphyn' and exits
**Goal**: Validate Ink setup and basic rendering
- Create `src/minimal-app.tsx` with React component
- Import React and Ink's render function
- Display text using `<Box>` and `<Text>`
- Auto-exit after 2 seconds
- **Files to create**:
  - `src/minimal-app.tsx`
- **Commands to test**:
  - `npm run dev:minimal`
  - `npm run build && node dist/minimal-app.js`
- **Success criteria**: 
  - Shows "Hello Graphyn" in terminal
  - Exits cleanly
  - No ESM errors

#### Task 2: Set up ESM-compatible build pipeline and test it works
**Goal**: Ensure TypeScript compiles to working ESM
- Update `tsconfig.json` for ES2022 modules
- Add `"type": "module"` to package.json
- Fix all import paths to include `.js` extension
- Update npm scripts for ESM
- **Files to modify**:
  - `package.json` - add type: module
  - `tsconfig.json` - module: ES2022
  - All `.ts` files - add .js to imports
- **Success criteria**:
  - `npm run build` succeeds
  - `node dist/minimal-app.js` runs
  - No module resolution errors

### Phase 2: Core UI Components

#### Task 3: Create main menu component with agent selection
**Goal**: Interactive menu for agent selection
- Create `src/components/MainMenu.tsx`
- Use `ink-select-input` for selection
- Add gradient banner with `ink-gradient`
- Handle selection events
- **Implementation details**:
  ```tsx
  const menuItems = [
    { label: 'Backend Agent', value: 'backend' },
    { label: 'Frontend Agent', value: 'frontend' },
    // ...
  ];
  ```
- **Files to create**:
  - `src/components/MainMenu.tsx`
  - `src/types/menu.ts`
- **Success criteria**:
  - Arrow keys navigate menu
  - Enter selects item
  - Escape exits app

#### Task 4: Build reactive state management with Zustand
**Goal**: Global state that triggers UI updates
- Create `src/store/app-store.ts`
- Define state interface with all app states
- Create actions for state updates
- **State shape**:
  ```typescript
  interface AppState {
    mode: 'menu' | 'agent' | 'loading' | 'error';
    selectedAgent: string | null;
    query: string;
    threads: Thread[];
    error: Error | null;
    // actions
    setMode: (mode: Mode) => void;
    setAgent: (agent: string) => void;
  }
  ```
- **Files to create**:
  - `src/store/app-store.ts`
  - `src/store/types.ts`
- **Success criteria**:
  - State changes update UI immediately
  - No prop drilling needed
  - DevTools show state changes

#### Task 5: Create agent context preparation component
**Goal**: Prepare and display agent context
- Create `src/components/AgentContext.tsx`
- Fetch agent prompts from GitHub/local
- Read GRAPHYN.md if exists
- Combine with user query
- Save to temp file
- **Implementation flow**:
  1. Show "Fetching prompt..." spinner
  2. Download/read agent prompt
  3. Read project context
  4. Prepare combined context
  5. Save to temp file
  6. Show success with file path
- **Files to create**:
  - `src/components/AgentContext.tsx`
  - `src/lib/agent-utils.ts`
  - `src/lib/file-utils.ts`
- **Success criteria**:
  - Shows real-time progress
  - Handles errors gracefully
  - Displays temp file path

#### Task 6: Implement loading states and progress indicators
**Goal**: Beautiful loading animations
- Create reusable loading components
- Add progress bars for long operations
- Implement skeleton screens
- **Components to create**:
  - `<LoadingSpinner />` with different styles
  - `<ProgressBar />` with percentage
  - `<LoadingMessage />` with rotating messages
- **Files to create**:
  - `src/components/shared/Loading.tsx`
  - `src/components/shared/Progress.tsx`
  - `src/hooks/useProgress.ts`
- **Success criteria**:
  - Smooth animations
  - Accurate progress tracking
  - No UI freezing

### Phase 3: Feature Components

#### Task 7: Build thread management UI component
**Goal**: Full thread CRUD interface
- List threads in a table
- Create new threads
- Show thread details
- Delete threads
- **UI Layout**:
  ```
  ┌─ Threads ────────────────┐
  │ ID   Name    Status      │
  │ 123  Auth    active  [x] │
  │ 124  UI      closed  [x] │
  └──────────────────────────┘
  [n]ew [r]efresh [q]uit
  ```
- **Files to create**:
  - `src/components/ThreadManager.tsx`
  - `src/components/ThreadList.tsx`
  - `src/components/ThreadDetail.tsx`
- **Success criteria**:
  - Real-time updates
  - Keyboard shortcuts work
  - Loading states for API calls

#### Task 8: Create authentication flow component
**Goal**: API key input and validation
- Text input for API key
- Masked input display
- Validation against backend
- Save to config file
- **Flow**:
  1. Check existing auth
  2. Prompt for API key
  3. Validate with backend
  4. Save encrypted
  5. Show success
- **Files to create**:
  - `src/components/Auth.tsx`
  - `src/components/shared/MaskedInput.tsx`
  - `src/lib/auth-utils.ts`
- **Success criteria**:
  - Secure key handling
  - Clear error messages
  - Persistent storage

#### Task 9: Implement error handling and recovery UI
**Goal**: Graceful error handling
- Error boundary component
- Retry mechanisms
- Fallback UI
- Error reporting
- **Error types to handle**:
  - Network errors
  - API errors
  - File system errors
  - Invalid input
- **Files to create**:
  - `src/components/ErrorBoundary.tsx`
  - `src/components/shared/ErrorDisplay.tsx`
  - `src/hooks/useError.ts`
- **Success criteria**:
  - No crashes
  - Clear error messages
  - Recovery options

#### Task 10: Add keyboard navigation and shortcuts
**Goal**: Power user keyboard controls
- Global hotkeys
- Context-aware shortcuts
- Vim-style navigation
- Help overlay
- **Shortcuts**:
  - `j/k` - navigate up/down
  - `Enter` - select
  - `Esc` - go back
  - `?` - show help
  - `Ctrl+C` - quit
- **Files to create**:
  - `src/hooks/useKeyboard.ts`
  - `src/components/shared/HelpOverlay.tsx`
  - `src/lib/keyboard-utils.ts`
- **Success criteria**:
  - All actions keyboard accessible
  - No conflicts
  - Discoverable via help

### Phase 4: Integration

#### Task 11: Integrate API client for backend communication
**Goal**: Convert API client to ESM
- Update imports to ESM syntax
- Convert EventSource usage
- Add proper error handling
- Integrate with Zustand
- **Changes needed**:
  - `import` instead of `require`
  - Top-level await support
  - Promise-based APIs
- **Files to modify**:
  - `src/lib/api-client.ts`
  - `src/lib/graphyn-client.ts`
  - `src/hooks/useApi.ts`
- **Success criteria**:
  - All API calls work
  - TypeScript types preserved
  - Error handling works

#### Task 12: Handle Claude Code launching strategy
**Goal**: Launch Claude from Ink app
- Detect Claude installation
- Save context before exit
- Exit Ink cleanly
- Launch Claude with context
- **Strategies**:
  1. Direct launch (if supported)
  2. Copy to clipboard
  3. Show manual commands
  4. Open in new terminal
- **Files to create**:
  - `src/lib/claude-launcher.ts`
  - `src/components/ClaudeLaunch.tsx`
- **Success criteria**:
  - Smooth transition
  - Context preserved
  - Clear instructions

### Phase 5: Migration & Polish

#### Task 13: Migrate existing commands one by one
**Goal**: Port all existing functionality
- **Order of migration**:
  1. `graphyn <agent> <query>` - direct mode
  2. `graphyn threads` - thread management
  3. `graphyn auth` - authentication
  4. `graphyn doctor` - system check
  5. `graphyn setup` - first run
- **For each command**:
  - Create Ink component
  - Port business logic
  - Add to router
  - Test thoroughly
- **Success criteria**:
  - Feature parity
  - Better UX
  - No regressions

#### Task 14: Add real-time updates with SSE
**Goal**: Live updates in UI
- Connect to SSE endpoint
- Update UI reactively
- Show connection status
- Auto-reconnect
- **Implementation**:
  - EventSource in useEffect
  - Update Zustand on events
  - Connection indicator
  - Retry logic
- **Files to create**:
  - `src/hooks/useSSE.ts`
  - `src/components/shared/ConnectionStatus.tsx`
- **Success criteria**:
  - Instant updates
  - Resilient connection
  - Clear status

#### Task 15: Test cross-platform compatibility
**Goal**: Works everywhere
- Test on macOS (native)
- Test on Linux (Docker)
- Test on Windows (VM)
- Fix platform-specific issues
- **Test matrix**:
  - Node 16, 18, 20
  - Different terminals
  - Various screen sizes
- **Success criteria**:
  - Same behavior
  - Correct rendering
  - No crashes

#### Task 16: Update documentation for Ink architecture
**Goal**: Complete documentation
- Update README.md
- Update CLAUDE.md
- Create ARCHITECTURE.md
- Add inline code docs
- **Documentation sections**:
  - Getting started
  - Architecture overview
  - Component guide
  - Contributing guide
- **Success criteria**:
  - Clear and complete
  - Examples included
  - Easy to follow

#### Task 17: Version bump and release strategy
**Goal**: Manage version transition properly
- **Version strategy**:
  - Current: 0.1.32 (Commander.js based)
  - Ink beta: 0.2.0-beta.1, 0.2.0-beta.2, etc.
  - Ink stable: 0.2.0
  - Major version: 1.0.0 (when feature complete)
- **Release phases**:
  1. Beta releases during development
  2. RC (release candidate) when feature complete
  3. Stable release after testing
- **npm tags**:
  - `@graphyn/code@latest` - current stable (0.1.x)
  - `@graphyn/code@beta` - Ink version testing
  - `@graphyn/code@next` - Ink stable
- **Migration path**:
  - Keep 0.1.x branch for hotfixes
  - Document breaking changes
  - Provide migration guide
- **Files to update**:
  - `package.json` - version field
  - `CHANGELOG.md` - what changed
  - `MIGRATION.md` - how to upgrade
- **Success criteria**:
  - Users can choose version
  - Clear upgrade path
  - No accidental breaking changes

## Technical Decisions

### ESM Strategy
- Use `.js` extensions in all imports
- No `__dirname` or `__filename` (use `import.meta.url`)
- Dynamic imports for conditional loading

### File Structure
```
src/
├── cli.tsx                 # Entry point
├── app.tsx                 # Main Ink app
├── store.ts               # Zustand store
├── components/
│   ├── Menu.tsx
│   ├── AgentContext.tsx
│   ├── ThreadManager.tsx
│   ├── Auth.tsx
│   └── shared/
│       ├── Loading.tsx
│       ├── Error.tsx
│       └── Success.tsx
├── hooks/
│   ├── useApi.ts
│   ├── useKeyboard.ts
│   └── useAgent.ts
└── lib/
    ├── api-client.ts      # Converted to ESM
    ├── config.ts
    └── utils.ts

```

### Component Architecture
- Each screen is a separate component
- Shared state via Zustand
- Effects for side operations
- Custom hooks for reusable logic

### Challenges & Solutions
1. **Claude Code Terminal Conflict**
   - Solution: Exit Ink before launching Claude
   - Fallback: Save context and show commands
   
2. **ESM/CJS Interop**
   - Solution: Convert everything to ESM
   - Use dynamic imports for CJS modules
   
3. **File System Operations**
   - Keep synchronous for simplicity
   - Show progress for long operations

## Success Criteria
- [ ] All commands work in Ink UI
- [ ] Reactive updates (no polling)
- [ ] Beautiful, consistent UI
- [ ] Fast startup (<500ms)
- [ ] Works on all platforms
- [ ] No ESM/CJS conflicts

## Estimated Timeline
- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 1 hour
- Phase 4: 30 minutes
- Phase 5: 1 hour
- **Total: ~4 hours**

---

**Ready to proceed?** This plan will completely transform Graphyn Code into a modern, reactive CLI with beautiful UI and real-time updates.