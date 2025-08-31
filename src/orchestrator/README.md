# Multi-Agent Orchestrator

A sophisticated multi-agent coordination system that enables multiple Claude Code sessions to work together on complex development tasks.

## 🏗️ Architecture Overview

The Multi-Agent Orchestrator consists of 6 core components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MultiAgentOrchestrator                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ TaskDistributor │  │ExecutionCoord.  │  │ ProgressTracker │  │
│  │                 │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │AgentSpawnMgr.   │  │CommunicationBus │                      │
│  │                 │  │                 │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **MultiAgentOrchestrator** - Core system that coordinates all components
2. **TaskDistributor** - Breaks complex requests into agent-specific tasks
3. **AgentSpawnManager** - Manages Claude Code session lifecycle  
4. **InterAgentCommunicationBus** - Enables agent-to-agent communication
5. **ExecutionCoordinator** - Manages parallel execution and dependencies
6. **ProgressTracker** - Real-time progress visualization with Ink

## 🚀 Quick Start

```typescript
import { MultiAgentOrchestrator } from './multi-agent-orchestrator.js';

const orchestrator = new MultiAgentOrchestrator();

const request = {
  query: "Build a user authentication system with JWT tokens",
  context: {
    repository: "/path/to/project",
    framework: "Next.js", 
    language: "TypeScript"
  },
  agents: ["architect", "backend", "frontend", "test-writer"],
  mode: "adaptive" as const
};

const taskId = await orchestrator.orchestrate(request);

// Stream real-time progress
for await (const progress of orchestrator.streamProgress(taskId)) {
  console.log(`Progress: ${progress.progress.completed}/${progress.progress.total}`);
  if (progress.status === 'completed') break;
}
```

## 🎯 Execution Modes

### Sequential Mode
Tasks execute in dependency order, one after another.

```typescript
const request = {
  query: "Implement user registration API",
  mode: "sequential" // architect → backend → test-writer
};
```

### Parallel Mode  
All ready tasks execute simultaneously for maximum speed.

```typescript
const request = {
  query: "Build dashboard UI components", 
  mode: "parallel" // All frontend tasks run at once
};
```

### Adaptive Mode ⭐
System optimizes execution based on dependencies and available agents.

```typescript
const request = {
  query: "Full-stack e-commerce checkout flow",
  mode: "adaptive" // Smart coordination between all agents
};
```

## 🤖 Available Agents

| Agent | Specialization | Use Cases |
|-------|---------------|-----------|
| `architect` | System design & architecture | Planning, design patterns, tech decisions |
| `backend` | Server-side development | APIs, databases, business logic |
| `frontend` | UI/UX development | Components, styling, user experience |
| `test-writer` | Testing & QA | Unit tests, integration tests, coverage |
| `design` | UI/UX design | Design systems, mockups, accessibility |
| `cli` | Command-line tools | Developer tooling, automation |
| `pr-merger` | Code review & merging | Code quality, review processes |
| `task-dispatcher` | Task analysis & routing | Request analysis, agent coordination |
| `production-architect` | Deployment & operations | Production setup, monitoring, scaling |

## 📊 Progress Visualization

The system provides real-time progress visualization using Ink:

```
🤖 Multi-Agent Orchestrator - Task: orch_1234567890_abc123def

Overall Progress: 3/5 tasks (60%)
Status: Executing frontend tasks  
Time: 2m 15s (Est. remaining: 1m)

Agent Status:
  🔄 architect     2/2 tasks
  🔄 backend       1/1 tasks - Implementing user authentication API...
  ⏳ frontend      0/1 tasks
  💤 test-writer   0/1 tasks

Press 'D' for details, 'Q' to quit
```

## 🔄 Inter-Agent Communication

Agents can communicate and share context:

```typescript
// Agent A sends context to Agent B
await communicationBus.sendMessage({
  from: 'agent_backend_123',
  to: 'agent_frontend_456', 
  type: 'context_share',
  payload: {
    apiEndpoints: ['/api/users', '/api/auth'],
    dataTypes: ['User', 'AuthToken']
  }
});

// Request-response pattern
const response = await communicationBus.sendMessageWithResponse({
  from: 'agent_frontend_456',
  to: 'agent_backend_123',
  type: 'dependency_request', 
  payload: { question: 'What validation rules for email?' }
}, 30000); // 30 second timeout
```

## 📋 Task Distribution

The TaskDistributor analyzes requests and creates appropriate task workflows:

### Full-Stack Feature
```
query: "Implement user authentication with login/signup"
→ 1. [architect] Plan authentication architecture 
  2. [backend] Implement auth API endpoints (depends on 1)
  3. [frontend] Build login/signup UI (depends on 2)  
  4. [test-writer] Create integration tests (depends on 2,3)
  5. [production-architect] Production deployment (depends on 4)
```

### Backend Feature
```
query: "Create REST API for user management"
→ 1. [architect] Design API architecture
  2. [backend] Implement CRUD endpoints (depends on 1)
  3. [test-writer] Write API tests (depends on 2)
```

### Bug Fix
```  
query: "Fix memory leak in session management"
→ 1. [task-dispatcher] Diagnose issue location
  2. [backend] Fix memory leak (depends on 1)
  3. [test-writer] Verify fix with tests (depends on 2)
```

## ⚡ Advanced Features

### Custom Agent Configuration
```typescript
const orchestrator = new MultiAgentOrchestrator();

// Disable progress visualization for headless use
orchestrator.progressTracker.setVisualizationEnabled(false);

// Access communication stats
const stats = orchestrator.communicationBus.getStats();
console.log(`Active agents: ${stats.activeAgents}`);
```

### Error Handling & Retries
- Automatic task retry (up to 3 attempts)
- Graceful failure handling
- Dependency resolution
- Timeout management

### Workspace Management
- Shared context across agents
- Repository analysis and setup
- Agent-specific working directories  
- Automatic cleanup

## 📝 Event System

Listen to orchestration events:

```typescript
orchestrator.on('orchestration_started', ({ taskId, tasks }) => {
  console.log(`Started ${tasks.length} tasks`);
});

orchestrator.on('task_completed', ({ task, result }) => {
  console.log(`✅ ${task.agent} completed: ${task.description}`);
});

orchestrator.on('task_failed', ({ task, error }) => {
  console.log(`❌ ${task.agent} failed: ${error}`);
});

orchestrator.on('orchestration_completed', ({ session }) => {
  const duration = session.endTime - session.startTime;
  console.log(`🎉 Completed in ${duration}ms`);
});
```

## 🛠️ API Reference

### MultiAgentOrchestrator

#### Methods
- `orchestrate(request)` - Start task orchestration
- `getStatus(taskId)` - Get current orchestration status
- `streamProgress(taskId)` - Stream real-time progress updates  
- `cancel(taskId)` - Cancel running orchestration
- `getAvailableAgents()` - List available agent types

### OrchestrationRequest

```typescript
interface OrchestrationRequest {
  query: string;                    // Natural language task description
  context: {                        // Project context
    repository: string;             // Project path
    framework?: string;             // e.g., "Next.js", "Express"  
    language?: string;              // e.g., "TypeScript", "Python"
    dependencies?: string[];        // Package names
  };
  agents: string[];                 // Which agents to involve
  mode: 'sequential' | 'parallel' | 'adaptive';
}
```

### Task

```typescript
interface Task {
  id: string;                       // Unique task identifier
  description: string;              // What the agent should do
  agent: string;                    // Which agent handles this
  dependencies: string[];           // Task IDs this depends on
  priority: number;                 // Execution priority (1-5)
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;                     // Task output
  error?: string;                   // Error message if failed
}
```

## 🎯 Use Cases

### 1. Full-Stack Feature Development
Coordinate backend APIs, frontend UI, testing, and deployment for complete features.

### 2. Architecture Reviews  
Have multiple architects analyze and propose improvements to system design.

### 3. Bug Fixes
Diagnose, fix, and test issues across multiple components.

### 4. Code Refactoring
Coordinate large-scale refactoring across backend and frontend codebases.

### 5. Testing & QA
Generate comprehensive test suites with multiple specialized agents.

### 6. Documentation
Create technical docs, API documentation, and user guides in parallel.

## 🔧 Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
npm run test:coverage
```

### Example Usage
```bash
tsx src/orchestrator/example-usage.ts
```

## 🤝 Integration

The Multi-Agent Orchestrator integrates seamlessly with:

- **@graphyn/code CLI** - Main CLI interface  
- **Claude Code** - Direct function calls via spawned sessions
- **Repository Analyzer** - Automatic project context detection
- **Ink Terminal UI** - Rich progress visualization
- **MCP Bridge** - Model Context Protocol integration

## ⚠️ Limitations

- Requires Claude Code installation
- Maximum 5 concurrent agents (configurable)
- Tasks must have clear agent assignment
- Communication requires active agent sessions

## 🚀 Future Enhancements

- [ ] Dynamic agent spawning based on workload
- [ ] Persistent task history and resumption
- [ ] Advanced dependency resolution with conflict detection  
- [ ] Agent performance analytics and optimization
- [ ] Custom agent plugin system
- [ ] Distributed execution across multiple machines

---

Built with ❤️ for the **@graphyn/code** ecosystem