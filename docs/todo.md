# Graphyn Code CLI - Development Tasks

## 🧠 CLI INTELLIGENCE VIA AGENT CONSUMPTION (TOP PRIORITY - January 2025)

### Core Strategy: Consume Agents, Don't Build Intelligence
The CLI becomes intelligent by orchestrating Graphyn agents. All intelligence features come from asking agents questions and facilitating their responses.

### Immediate Agent Integration Tasks
- [ ] Create CLI Assistant Agent consumption:
    ```typescript
    // CLI asks agents for help
    const nextSteps = await queryAgent('cli-assistant', {
      query: 'What should the user do next?',
      context: { recentCommands, projectState, currentThread }
    });
    ```
- [ ] Natural language command interpretation:
    ```bash
    graphyn "test my customer service agent"
    # CLI sends to agent: "Interpret this command: test my customer service agent"
    # Agent responds with: { action: 'test', target: 'agent', filter: 'customer-service' }
    ```
- [ ] Context awareness through agents:
    - [ ] Agents track user's work session
    - [ ] Agents remember previous commands
    - [ ] Agents understand project state
    - [ ] Agents provide contextual suggestions

### Agent-Driven Features
- [ ] Smart suggestions:
    ```bash
    graphyn suggest
    # Asks agent: "Based on context, what should user do?"
    # Agent: "You just created an agent. Try: graphyn test agent customer-service"
    ```
- [ ] Learning analytics via agents:
    ```bash
    graphyn learning analyze
    # Asks learning agent: "What patterns do you see?"
    # Agent analyzes and reports insights
    ```
- [ ] Debugging with agent help:
    ```bash
    graphyn debug thread-123
    # Asks debug agent: "Analyze this thread for issues"
    # Agent provides detailed analysis
    ```

### Multi-Agent Orchestration
- [ ] Agent-to-agent conversations:
    - [ ] CLI creates thread for agents to discuss
    - [ ] Facilitates agent collaboration
    - [ ] Aggregates multi-agent insights
- [ ] Agent consensus building:
    - [ ] Ask multiple agents same question
    - [ ] Compare and combine responses
    - [ ] Present unified recommendation

## 🚀 LIVE BACKEND INTEGRATION (URGENT - January 2025)

### BREAKTHROUGH: APIs Are Live!
The backend is 100% operational with real PostgreSQL database. CLI should integrate immediately to support the 80% → 100% demo push!

### Immediate Integration Tasks
- [ ] Replace mock authentication with real token system
- [ ] Connect to live Encore.dev backend endpoints
- [ ] Test thread creation/listing with real database
- [ ] Integrate SSE streaming for real-time updates
- [ ] Validate all CLI commands against working APIs

### Demo Support Features (Next 2-3 Hours)
- [ ] Multi-instance Claude Code launcher for learning demo:
    ```bash
    graphyn demo learning
    # Creates test thread
    # Adds agent to thread
    # Launches Claude with agent context
    # Monitors conversation
    # Removes agent (triggers learning)
    # Shows learning insights
    ```
- [ ] Real-time thread monitoring:
    - [ ] Display live participant count
    - [ ] Show message activity
    - [ ] Monitor agent status
- [ ] Bulk operations for testing:
    - [ ] Create multiple test threads
    - [ ] Mass add/remove participants
    - [ ] Batch agent testing

### Live API Integration
- [ ] Update API client configuration:
    ```typescript
    const client = new GraphynClient({
      baseURL: process.env.GRAPHYN_API_URL || 'http://localhost:4000',
      apiKey: process.env.GRAPHYN_API_KEY
    });
    ```
- [ ] Real thread management:
    - [ ] `graphyn threads list` - Show actual database threads
    - [ ] `graphyn threads create` - Create real thread
    - [ ] `graphyn threads join <id>` - Add participant to thread
- [ ] Agent integration:
    - [ ] `graphyn agents list` - Real agents from database
    - [ ] `graphyn agents test <agent-id>` - Test specific agent
    - [ ] `graphyn agents add <thread-id> <agent-id>` - Real participant addition

## 🔐 Web-Based Authentication Flow (UPDATED PRIORITY)

### OAuth Device Flow Implementation
- [ ] Implement device authorization flow:
    - [ ] Generate device code on `graphyn auth`
    - [ ] Poll `/api/cli/device/token` endpoint
    - [ ] Store tokens securely on success
    - [ ] Handle timeout and error cases
- [ ] Create browser opening logic:
    - [ ] Auto-open browser to auth URL
    - [ ] Display user code prominently
    - [ ] Fallback to manual URL if browser fails
    - [ ] Support `--no-browser` flag
- [ ] Build local callback server option:
    - [ ] Start temporary HTTP server
    - [ ] Listen for OAuth callback
    - [ ] Extract token from callback
    - [ ] Shut down server cleanly

### Authentication UX
- [ ] Design authentication flow UI:
    ```
    🔐 Starting authentication...
    
    Enter this code on app.graphyn.xyz:
    ┌─────────────┐
    │  ABCD-1234  │
    └─────────────┘
    
    Or visit: https://app.graphyn.xyz/cli-auth
    
    ⠋ Waiting for authentication...
    ```
- [ ] Add success confirmation:
    - [ ] Show user email/name
    - [ ] Display organization name
    - [ ] List available agents
- [ ] Implement auth status command:
    - [ ] `graphyn auth status` - detailed info
    - [ ] `graphyn auth refresh` - refresh token
    - [ ] `graphyn auth logout` - clear tokens

### API Endpoints Required
- [ ] Work with backend team on:
    - [ ] `POST /api/cli/device/code` - initiate flow
    - [ ] `POST /api/cli/device/token` - poll for token
    - [ ] `GET /api/cli/verify` - verify token validity
- [ ] Token management:
    - [ ] Access token (short-lived)
    - [ ] Refresh token (long-lived)
    - [ ] Automatic refresh logic

### Security Implementation
- [ ] Secure token storage:
    - [ ] Use OS keychain where available
    - [ ] Fallback to encrypted file (chmod 600)
    - [ ] Never store in plain text
- [ ] PKCE implementation:
    - [ ] Generate code verifier
    - [ ] Create code challenge
    - [ ] Verify on callback
- [ ] Token rotation:
    - [ ] Auto-refresh before expiry
    - [ ] Handle refresh failures gracefully

## 🚀 API Architecture Refactor (NEW - January 2025)

### Core Principle: Graphyn CLI as Standard API Client
- [ ] Refactor CLI to use standard GraphynClient library
    - [ ] Remove any special endpoint logic
    - [ ] Use same API endpoints as web/mobile clients
    - [ ] Import shared SDK/client library
- [ ] Implement multi-thread orchestration layer:
    - [ ] Create threads for each agent instance
    - [ ] Add agents as thread participants
    - [ ] Link threads via session metadata
    - [ ] Stream responses from multiple threads
- [ ] Build response aggregation system:
    - [ ] Collect SSE streams from all threads
    - [ ] Aggregate responses intelligently
    - [ ] Present unified output to user
    - [ ] Handle multi-agent coordination

### GraphynClient Integration
- [ ] Install/create GraphynClient SDK:
    - [ ] `npm install @graphyn/sdk` or local import
    - [ ] Configure with API key authentication
    - [ ] Support environment variable configuration
- [ ] Update all API calls to use client:
    ```typescript
    const graphyn = new GraphynClient({ 
      apiKey: process.env.GRAPHYN_API_KEY 
    });
    ```
- [ ] Remove hardcoded endpoints and custom API logic

### Multi-Agent Orchestration
- [ ] Implement session management:
    - [ ] Generate unique session IDs
    - [ ] Tag all threads with session metadata
    - [ ] Track related threads across agents
- [ ] Create orchestration patterns:
    - [ ] Sequential agent execution
    - [ ] Parallel agent coordination
    - [ ] Result passing between agents
    - [ ] Context sharing mechanisms

## 🔧 Core Features Enhancement

### API Client Architecture
- [ ] Create `src/api-client.ts`:
    - [ ] Wrapper around GraphynClient
    - [ ] Handle authentication
    - [ ] Manage SSE connections
    - [ ] Error handling and retries
- [ ] Update `src/agents.ts`:
    - [ ] Fetch agents from `/api/agents`
    - [ ] Transform agent configs for Claude
    - [ ] Extract launcher-friendly formats
- [ ] Refactor `src/auth.ts`:
    - [ ] Store API endpoint configuration
    - [ ] Support multiple auth profiles
    - [ ] Validate against actual API

### Thread Management
- [ ] Create `src/threads.ts`:
    - [ ] Thread creation utilities
    - [ ] Participant management
    - [ ] SSE stream handling
    - [ ] Message aggregation
- [ ] Implement thread lifecycle:
    - [ ] Create thread on agent launch
    - [ ] Add user and agent participants
    - [ ] Stream real-time responses
    - [ ] Clean up on completion

### Context Extraction
- [ ] Build context transformation layer:
    - [ ] Agent config → Claude launcher format
    - [ ] Include GRAPHYN.md context
    - [ ] Add project-specific prompts
    - [ ] Optimize for context window

## 📦 Testing & Validation

### Local Testing Setup
- [ ] Create test harness:
    - [ ] Mock GraphynClient for offline testing
    - [ ] Test multi-thread orchestration
    - [ ] Validate response aggregation
- [ ] Integration tests:
    - [ ] Test against real API endpoints
    - [ ] Verify thread creation/management
    - [ ] Test multi-agent coordination
- [ ] CLI command tests:
    - [ ] Test all commands with API
    - [ ] Verify error handling
    - [ ] Test offline fallbacks

### Installation & Setup
- [ ] Test npm global installation:
    ```bash
    npm install -g @graphyn/code
    graphyn auth
    graphyn architect "design auth system"
    ```
- [ ] Verify cross-platform compatibility:
    - [ ] macOS with different shells
    - [ ] Linux distributions
    - [ ] Windows (PowerShell/CMD)
- [ ] Document installation issues and fixes

## 🎨 User Experience

### Progress & Feedback
- [ ] Implement real-time streaming UI:
    - [ ] Show agent responses as they arrive
    - [ ] Display which agent is responding
    - [ ] Progress indicators for long operations
- [ ] Multi-agent coordination display:
    - [ ] Show active agents
    - [ ] Display coordination status
    - [ ] Aggregate results clearly

### Error Handling
- [ ] Graceful API failures:
    - [ ] Offline mode with cached prompts
    - [ ] Clear error messages
    - [ ] Suggested fixes
- [ ] Network resilience:
    - [ ] Auto-reconnect SSE streams
    - [ ] Handle partial responses
    - [ ] Retry failed requests

## 📚 Documentation Updates

### CLAUDE.md Updates
- [ ] Document API client architecture
- [ ] Add orchestration patterns
- [ ] Update with latest learnings
- [ ] Include troubleshooting guide

### GRAPHYN.md Creation
- [ ] Initialize project memory file
- [ ] Document architecture decisions
- [ ] Track technical learnings
- [ ] Maintain living documentation

### README Enhancement
- [ ] Update installation instructions
- [ ] Add API configuration guide
- [ ] Include multi-agent examples
- [ ] Document all commands

## 🤖 Agent Builder Mode (NEW - January 2025)

### Local Agent Development
- [ ] Implement agent creation workflow:
    - [ ] `graphyn agent create <name>` - interactive builder
    - [ ] Template selection (code review, testing, etc.)
    - [ ] Capability configuration
    - [ ] Local testing environment
- [ ] Build conversational agent designer:
    - [ ] Interactive prompt refinement
    - [ ] Test with sample inputs
    - [ ] Iterate based on responses
    - [ ] Save versions locally
- [ ] Agent configuration management:
    - [ ] Store in `.graphyn/agents/` directory
    - [ ] YAML/JSON format for portability
    - [ ] Version control friendly

### Agent Testing Framework
- [ ] Create local testing commands:
    - [ ] `graphyn agent test <name> "query"`
    - [ ] Mock API responses for offline work
    - [ ] Performance metrics
    - [ ] Response quality checks
- [ ] Build validation system:
    - [ ] Verify agent configurations
    - [ ] Check capability requirements
    - [ ] Validate prompts and examples
    - [ ] Security scanning

### Push/Pull Workflow
- [ ] Implement sync with app.graphyn.xyz:
    - [ ] `graphyn agent push <name>` - deploy to org
    - [ ] `graphyn agent pull <name>` - fetch from org
    - [ ] `graphyn agent list --remote` - see org agents
    - [ ] Conflict resolution strategies
- [ ] Add collaboration features:
    - [ ] Share agents within organization
    - [ ] Agent versioning and rollback
    - [ ] Usage analytics per agent
    - [ ] Team permissions

### Agent Marketplace Integration
- [ ] Browse public agents:
    - [ ] `graphyn agent search "testing"`
    - [ ] `graphyn agent install @graphyn/code-reviewer`
    - [ ] Rating and review system
- [ ] Publish agents:
    - [ ] `graphyn agent publish --public`
    - [ ] Documentation requirements
    - [ ] License selection

## 🔍 Next Phase Planning

### Analytics & Insights
- [ ] Track usage patterns:
    - [ ] Which agents used most
    - [ ] Common query patterns
    - [ ] Error frequencies
    - [ ] Agent performance metrics
- [ ] Build improvement pipeline:
    - [ ] Analyze logged interactions
    - [ ] Auto-improve agent prompts
    - [ ] A/B testing for prompts
    - [ ] Optimize orchestration

### Platform Integration
- [ ] Deep app.graphyn.xyz integration:
    - [ ] Real-time agent sync
    - [ ] Team workspace support
    - [ ] Shared context management
    - [ ] Usage dashboards
- [ ] Enterprise features:
    - [ ] SSO integration
    - [ ] Audit logging
    - [ ] Compliance controls
    - [ ] Private agent registries

### Future Features
- [ ] Plugin system for custom tools
- [ ] Multi-language support
- [ ] IDE extensions
- [ ] Advanced orchestration patterns