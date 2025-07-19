# Ink Framework Migration Guide

## Overview

This guide documents the migration of Graphyn CLI from Commander.js to Ink (React for terminals), completed in January 2025.

## Migration Status: 88% Complete (15/17 tasks)

### Why Ink?

1. **Modern React-based UI** - Component-based architecture for terminal apps
2. **Real-time updates** - Reactive UI updates without screen flashing
3. **Better UX** - Smooth animations, spinners, and interactive elements
4. **Same as Claude Code** - Uses the same framework for consistency
5. **Type safety** - Full TypeScript support with React patterns

## Architecture Changes

### Before (Commander.js)
```typescript
// Imperative command handling
program
  .command('backend <query>')
  .action(async (query) => {
    console.log('Processing...');
    // Direct console output
  });
```

### After (Ink)
```typescript
// Reactive component-based UI
export const AgentContext: React.FC<Props> = ({ agent, query }) => {
  return (
    <Box flexDirection="column">
      <Spinner /> Processing...
      {/* Real-time UI updates */}
    </Box>
  );
};
```

## Key Components

### 1. App.tsx - Main Application
- Central routing logic
- Mode-based rendering
- Error boundary wrapper
- Keyboard input handling

### 2. Store (Zustand)
- Global state management
- Reactive updates
- Type-safe actions

### 3. API Context
- Centralized API client
- Authentication management
- Shared across components

### 4. Error Handling
- ErrorBoundary component
- useErrorHandler hook
- Graceful error recovery

## Component Structure

```
src/ink/
├── components/
│   ├── AgentContext.tsx      # Agent interaction UI
│   ├── Authentication.tsx    # Auth flows (OAuth, API key)
│   ├── Doctor.tsx           # System health checks
│   ├── ErrorBoundary.tsx    # React error boundary
│   ├── Loading.tsx          # Loading spinner
│   ├── MainMenu.tsx         # Interactive main menu
│   ├── ThreadManagement.tsx # Thread CRUD operations
│   └── ...
├── contexts/
│   └── APIContext.tsx       # API client provider
├── hooks/
│   ├── useAPI.ts           # API operations
│   ├── useClaude.ts        # Claude integration
│   └── useErrorHandler.ts  # Error management
├── store.ts                # Zustand store
├── App.tsx                 # Main app component
└── cli.tsx                 # Entry point
```

## ESM Module System

### Key Requirements
1. All imports must use `.js` extension
2. Package.json has `"type": "module"`
3. TypeScript compiles to ESM format

### Example
```typescript
// ✅ Correct
import { MainMenu } from './components/MainMenu.js';

// ❌ Wrong
import { MainMenu } from './components/MainMenu';
```

## Testing Strategy

### Unit Tests (Vitest)
```typescript
import { render } from '../test-utils';
import { MainMenu } from '../MainMenu';

test('renders menu items', () => {
  const { lastFrame } = render(<MainMenu />);
  expect(lastFrame()).toContain('Backend Agent');
});
```

### Integration Tests
- Test full command flows
- Mock API responses
- Verify error handling

### E2E Tests
- Test actual CLI commands
- Verify package installation
- Check cross-platform compatibility

## State Management Pattern

```typescript
// Zustand store
interface AppState {
  mode: AppMode;
  selectedAgent: string;
  loading: boolean;
  error: string | null;
  
  // Actions
  setMode: (mode: AppMode) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Component usage
const { mode, setMode } = useStore();
```

## API Integration Pattern

```typescript
// Using API context
const { client, isAuthenticated } = useAPI();

// Making API calls
const { data, loading, error } = useAPICall(
  async () => client.threads.list(),
  []
);
```

## Error Handling Pattern

```typescript
// Component with error handling
export const MyComponent = () => {
  const { handleError } = useErrorHandler();
  
  const doSomething = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      handleError(error);
    }
  };
};
```

## Performance Optimizations

1. **Lazy loading** - Components loaded on demand
2. **Memoization** - React.memo for expensive renders
3. **Debouncing** - For user input and API calls
4. **Virtual scrolling** - For long lists

## Deployment Considerations

1. **Bundle size** - Ink adds ~2MB to package
2. **Node version** - Requires Node 16+
3. **Terminal compatibility** - Works in all modern terminals
4. **Windows support** - Fully tested on Windows Terminal

## Migration Checklist

- [x] Set up Ink application structure
- [x] Configure ESM build pipeline
- [x] Implement Zustand state management
- [x] Create all UI components
- [x] Add error boundaries
- [x] Set up testing infrastructure
- [ ] Update all documentation
- [ ] Prepare for release

## Common Issues and Solutions

### 1. ESM Import Errors
**Problem**: `Cannot find module`
**Solution**: Add `.js` extension to all imports

### 2. Terminal Control Conflicts
**Problem**: "Raw mode not supported"
**Solution**: Ensure only one Ink app runs at a time

### 3. TypeScript Compilation
**Problem**: Type errors with Ink components
**Solution**: Use proper React.FC types and props interfaces

### 4. State Not Updating
**Problem**: UI doesn't reflect state changes
**Solution**: Check Zustand subscriptions and React hooks

## Future Enhancements

1. **Theming** - User-customizable color schemes
2. **Plugins** - Extension system for custom commands
3. **Animations** - Smooth transitions between views
4. **Accessibility** - Screen reader support
5. **Localization** - Multi-language support