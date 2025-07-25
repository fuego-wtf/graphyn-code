# Graphyn v10 Implementation Plan

## Overview
Transform Graphyn from Figma-focused to **CLI-first repository intelligence** platform. Priority: `npm i -g @graphyn/code` → working MCP integration with Claude in <5 minutes.

## 🚨 Critical Path (Week 1-2)

### 1. @graphyn/code Package Structure

```typescript
// package.json
{
  "name": "@graphyn/code",
  "version": "1.0.0",
  "bin": {
    "graphyn": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "type": "module"
}
```

**Required Commands:**
```bash
graphyn auth          # OAuth flow with app.graphyn.xyz
graphyn init          # Repository analysis → agent suggestions
graphyn mcp install   # Configure Claude MCP
graphyn test <agent>  # Local agent testing with fuego-mini
```

### 2. MCP Server Integration

**File**: `src/mcp-server.ts`
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'graphyn',
  version: '1.0.0'
});

// MCP Tools for Claude
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_repository',
      description: 'Analyze current repository structure and patterns',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'review_code',
      description: 'Review code changes using your trained agents',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to review' }
        }
      }
    },
    {
      name: 'generate_tests',
      description: 'Generate tests for functions using your patterns',
      inputSchema: {
        type: 'object',
        properties: {
          function_code: { type: 'string', description: 'Function to test' }
        }
      }
    }
  ]
}));
```

### 3. Repository Analysis Service

**File**: `src/services/repository-analyzer.ts`
```typescript
export class RepositoryAnalyzer {
  async analyzeProject(path: string): Promise<ProjectAnalysis> {
    const analysis = {
      language: await this.detectLanguage(path),
      framework: await this.detectFramework(path),
      dependencies: await this.extractDependencies(path),
      testFramework: await this.detectTestFramework(path),
      codePatterns: await this.extractPatterns(path),
      suggestedAgents: []
    };

    // Smart agent suggestions based on project
    if (analysis.language === 'typescript' && analysis.framework === 'nextjs') {
      analysis.suggestedAgents.push({
        name: 'Code Review Agent',
        model: 'fuego-mini',
        purpose: 'PR reviews, TypeScript best practices, Next.js patterns'
      });
    }

    return analysis;
  }

  private async detectFramework(path: string): Promise<string> {
    const packageJson = await this.readPackageJson(path);
    
    if (packageJson.dependencies?.['next']) return 'nextjs';
    if (packageJson.dependencies?.['react']) return 'react';
    if (packageJson.dependencies?.['vue']) return 'vue';
    if (packageJson.dependencies?.['@nestjs/core']) return 'nestjs';
    
    return 'unknown';
  }
}
```

## 🔧 Backend Services (Week 3-4)

### New Encore Services

#### 1. code-analysis Service
**File**: `backend/code-analysis/service.go`
```go
package codeanalysis

//encore:service
type Service struct{}

//encore:api public method=POST path=/analyze
func (s *Service) AnalyzeRepository(ctx context.Context, req *AnalyzeRequest) (*AnalysisResponse, error) {
    // Extract patterns from git history
    patterns := extractPatternsFromGit(req.RepoPath)
    
    // Detect tech stack
    stack := detectTechStack(req.RepoPath)
    
    // Suggest agents based on patterns
    agents := suggestAgents(stack, patterns)
    
    return &AnalysisResponse{
        TechStack: stack,
        Patterns: patterns,
        SuggestedAgents: agents,
    }, nil
}
```

#### 2. mcp Service
**File**: `backend/mcp/service.go`
```go
package mcp

//encore:api public method=POST path=/mcp/execute
func (s *Service) ExecuteMCP(ctx context.Context, req *MCPRequest) (*MCPResponse, error) {
    switch req.Tool {
    case "analyze_repository":
        return s.analyzeRepo(ctx, req)
    case "review_code":
        return s.reviewCode(ctx, req)
    case "generate_tests":
        return s.generateTests(ctx, req)
    }
    return nil, errors.New("unknown tool")
}
```

#### 3. learning Service
**File**: `backend/learning/service.go`
```go
package learning

//encore:api public method=POST path=/learning/capture
func (s *Service) CaptureInteraction(ctx context.Context, req *InteractionRequest) (*InteractionResponse, error) {
    // Store interaction for RLHF training
    interaction := &Interaction{
        UserID: req.UserID,
        AgentID: req.AgentID,
        Code: req.Code,
        Response: req.Response,
        Feedback: req.Feedback,
        Timestamp: time.Now(),
    }
    
    return s.db.StoreInteraction(ctx, interaction)
}
```

## 🎯 CLI Commands Implementation

### graphyn init Flow
```typescript
// src/commands/init.ts
export async function initCommand() {
  console.log('🔍 Analyzing repository structure...');
  
  const analysis = await analyzer.analyzeProject(process.cwd());
  
  console.log(`Found: ${analysis.language} project with ${analysis.framework}`);
  console.log(`Detected: ${analysis.dependencies.length} dependencies`);
  
  console.log('\n🤖 Based on your codebase, I recommend these agents:');
  
  analysis.suggestedAgents.forEach((agent, i) => {
    console.log(`\n${i+1}. ${agent.name} (${agent.model})`);
    console.log(`   - ${agent.purpose}`);
  });
  
  const confirm = await inquirer.prompt([{
    type: 'confirm',
    name: 'createAll',
    message: 'Create all suggested agents?',
    default: true
  }]);
  
  if (confirm.createAll) {
    await createAgents(analysis.suggestedAgents);
  }
}
```

### graphyn mcp install
```typescript
// src/commands/mcp.ts
export async function mcpInstallCommand() {
  console.log('📦 Installing MCP server for Claude integration...');
  
  const configPath = path.join(
    os.homedir(),
    'Library/Application Support/Claude/claude_desktop_config.json'
  );
  
  const config = {
    mcpServers: {
      graphyn: {
        command: 'npx',
        args: ['-y', '@graphyn/mcp-server'],
        env: {
          GRAPHYN_API_KEY: await getApiKey(),
          GRAPHYN_AGENTS: await getAgentIds()
        }
      }
    }
  };
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log('✅ MCP server configured! Restart Claude to activate.');
}
```

## 🏗️ Local Model Integration

### Strands Integration
```typescript
// src/services/local-model.ts
export class LocalModelService {
  private strandsClient: StrandsClient;
  
  async initializeModel(modelName: string = 'fuego-mini') {
    this.strandsClient = new StrandsClient({
      model: modelName,
      maxTokens: 4096,
      temperature: 0.1
    });
  }
  
  async reviewCode(code: string, context: RepositoryContext): Promise<string> {
    const prompt = this.buildCodeReviewPrompt(code, context);
    
    const stream = await this.strandsClient.complete({
      prompt,
      stream: true
    });
    
    let response = '';
    for await (const chunk of stream) {
      response += chunk.choices[0]?.delta?.content || '';
    }
    
    return response;
  }
  
  private buildCodeReviewPrompt(code: string, context: RepositoryContext): string {
    return `You are a code reviewer for a ${context.language} ${context.framework} project.

Repository patterns:
${context.patterns.map(p => `- ${p.description}`).join('\n')}

Review this code:
\`\`\`${context.language}
${code}
\`\`\`

Provide specific feedback on:
1. Security issues
2. Performance concerns  
3. Code style alignment with project patterns
4. Suggestions for improvement`;
  }
}
```

## 📦 Package Publishing Strategy

### NPM Package Structure
```
@graphyn/code/
├── dist/           # Compiled JS
├── src/
│   ├── cli.ts     # Main CLI entry
│   ├── commands/  # Command implementations
│   ├── services/  # Business logic
│   └── mcp/       # MCP server
├── package.json
└── README.md
```

### Installation Experience
```bash
# Single command gets you started
npm i -g @graphyn/code

# Authentication (opens browser)
graphyn auth

# Project setup (analyzes repo, suggests agents)
graphyn init

# Claude integration (configures MCP)
graphyn mcp install

# Test locally (with fuego-mini)
graphyn test code-review
```

## 🎯 Success Metrics

### Week 1-2 Goals
- [ ] `@graphyn/code` installable via npm
- [ ] `graphyn auth` OAuth flow working
- [ ] `graphyn init` analyzes repo and suggests agents
- [ ] Basic MCP server responds to Claude

### Week 3-4 Goals  
- [ ] All 3 new backend services deployed
- [ ] `graphyn mcp install` configures Claude perfectly
- [ ] Local fuego-mini model integration working
- [ ] End-to-end flow: CLI → Analysis → Agent Creation → MCP → Claude

### Week 5-6 Goals
- [ ] Repository pattern learning working
- [ ] Agent fine-tuning pipeline operational
- [ ] Performance: <80ms response time with fuego-mini
- [ ] Enterprise features: org-specific models

## 🚧 Implementation Priority

1. **Phase 1**: CLI package + MCP bridge (get Claude integration working)
2. **Phase 2**: Repository analysis + agent suggestions (core value prop)
3. **Phase 3**: Local model integration (performance optimization)
4. **Phase 4**: Learning pipeline (continuous improvement)

This plan transforms Graphyn from Figma-focused to the CLI-first repository intelligence platform outlined in v10. 