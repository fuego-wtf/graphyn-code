# Multi-Agent Architecture Design

## Overview
The new architecture enables `graphyn <query>` to analyze the codebase and coordinate multiple AI agents to handle complex development tasks.

## Flow Diagram
```
User Query → CLI → Repository Analyzer → /ask API → Multi-Agent Orchestrator → Claude Prompts
```

## Detailed Flow

### 1. CLI Entry Point (`graphyn <query>`)
```typescript
// User runs: graphyn "add user authentication"
interface CLIRequest {
  query: string;
  context: {
    cwd: string;
    gitInfo: GitInfo;
  };
}
```

### 2. Repository Analysis Phase
```typescript
interface RepositoryAnalysis {
  framework: string;
  language: string;
  dependencies: Record<string, string>;
  fileStructure: FileTree;
  patterns: string[];
  relevantFiles: string[];
}
```

### 3. Backend /ask Endpoint
```typescript
interface AskRequest {
  query: string;
  repositoryContext: RepositoryAnalysis;
  userContext: {
    organizationId: string;
    previousInteractions?: string[];
  };
}

interface AskResponse {
  agents: AgentResponse[];
  orchestrationPlan: string;
  estimatedTime: number;
}

interface AgentResponse {
  agentId: string;
  agentName: string;
  role: string;
  prompt: string;
  tasks: Task[];
  dependencies: string[];
}
```

### 4. Multi-Agent Orchestration
The backend orchestrator:
1. Analyzes the query and repository context
2. Selects appropriate agents based on the task
3. Generates specialized prompts for each agent
4. Defines task dependencies and execution order

### 5. Claude Code Integration
Each agent response includes a ready-to-use prompt for Claude:
```typescript
interface ClaudePrompt {
  systemPrompt: string;
  taskContext: string;
  acceptanceCriteria: string[];
  relevantCode: CodeSnippet[];
}
```

## Implementation Components

### 1. Repository Context Extractor
```typescript
class RepositoryContextExtractor {
  async extractContext(query: string, repoPath: string): Promise<RepositoryAnalysis> {
    // 1. Analyze query to identify relevant areas
    // 2. Scan repository structure
    // 3. Extract relevant files and patterns
    // 4. Build focused context
  }
}
```

### 2. Ask Service
```typescript
class AskService {
  async processQuery(request: AskRequest): Promise<AskResponse> {
    // 1. Send to backend /ask endpoint
    // 2. Receive multi-agent response
    // 3. Transform for Claude execution
  }
}
```

### 3. Claude Prompt Builder
```typescript
class ClaudePromptBuilder {
  buildPrompt(agentResponse: AgentResponse, repoContext: RepositoryAnalysis): string {
    // 1. Combine agent system prompt
    // 2. Add repository context
    // 3. Include specific task details
    // 4. Add relevant code snippets
  }
}
```

## Benefits
1. **Focused Context**: Only relevant code is sent to agents
2. **Specialized Agents**: Each agent has domain expertise
3. **Parallel Execution**: Multiple agents can work simultaneously
4. **Clear Dependencies**: Tasks are properly sequenced
5. **Direct Claude Integration**: Ready-to-use prompts for immediate execution