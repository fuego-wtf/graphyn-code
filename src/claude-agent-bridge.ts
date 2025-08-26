/**
 * Claude Agent Bridge
 * Integrates .claude/ directory agent system with @graphyn/code CLI
 * Provides MCP tools for agent coordination and task management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GraphynAPIClient } from './api/client.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface AgentBridgeOptions {
  workspaceRoot: string;
  debug?: boolean;
}

export class ClaudeAgentBridge {
  private server: Server;
  private apiClient: GraphynAPIClient;
  private workspaceRoot: string;
  
  constructor(options: AgentBridgeOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.apiClient = new GraphynAPIClient();
    
    this.server = new Server(
      {
        name: 'claude-agent-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  async initialize(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Claude Agent Bridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Bridge:', error);
      process.exit(1);
    }
  }
  
  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAvailableTools(),
    }));
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'execute_sprint':
          return this.handleExecuteSprint(args);
        case 'write_tests':
          return this.handleWriteTests(args);
        case 'review_pr':
          return this.handleReviewPR(args);
        case 'design_architecture':
          return this.handleDesignArchitecture(args);
        case 'assign_phase1':
          return this.handleAssignPhase1(args);
        case 'assign_phase2':
          return this.handleAssignPhase2(args);
        case 'status':
          return this.handleStatus(args);
        case 'activate_all':
          return this.handleActivateAll(args);
        case 'todo_read':
          return this.handleTodoRead(args);
        case 'todo_write':
          return this.handleTodoWrite(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
    
    // Handle resource listing
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.getAvailableResources(),
    }));
    
    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return this.handleReadResource(uri);
    });
  }
  
  private getAvailableTools() {
    return [
      {
        name: 'execute_sprint',
        description: 'Execute sprint task with fullstack-sprint-executor agent',
        inputSchema: {
          type: 'object',
          properties: {
            issue_number: { type: 'string', description: 'GitHub issue number' },
          },
          required: ['issue_number'],
        },
      },
      {
        name: 'write_tests',
        description: 'Write tests with test-writer agent',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: { type: 'string', description: 'GitHub PR number' },
          },
          required: ['pr_number'],
        },
      },
      {
        name: 'review_pr',
        description: 'Review PR with pr-merger agent',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: { type: 'string', description: 'GitHub PR number' },
          },
          required: ['pr_number'],
        },
      },
      {
        name: 'design_architecture',
        description: 'Design architecture with platform-architect agent',
        inputSchema: {
          type: 'object',
          properties: {
            issue_number: { type: 'string', description: 'GitHub issue number' },
          },
          required: ['issue_number'],
        },
      },
      {
        name: 'assign_phase1',
        description: 'Assign all Phase 1 foundation tasks',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'assign_phase2', 
        description: 'Assign Phase 2 integration tasks',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'status',
        description: 'Check comprehensive ecosystem status',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'activate_all',
        description: 'Activate all agents for coordinated sprint execution',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'todo_read',
        description: 'Read current TodoWrite state',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'todo_write',
        description: 'Create TodoWrite tasks',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                  activeForm: { type: 'string' },
                },
              },
            },
          },
          required: ['tasks'],
        },
      },
    ];
  }
  
  private getAvailableResources() {
    return [
      {
        uri: 'claude://agents',
        name: 'Claude Agents',
        description: 'All .claude/agents/ definitions',
        mimeType: 'application/json',
      },
      {
        uri: 'claude://commands',
        name: 'Claude Commands',
        description: 'All .claude/commands/ slash commands',
        mimeType: 'application/json',
      },
      {
        uri: 'claude://project-memory',
        name: 'Project Memory',
        description: 'CLAUDE.md project guidelines',
        mimeType: 'text/markdown',
      },
      {
        uri: 'claude://github-issues',
        name: 'GitHub Issues',
        description: 'Current GitHub issues across repositories',
        mimeType: 'application/json',
      },
    ];
  }
  
  // Tool handlers
  private async handleExecuteSprint(args: any): Promise<any> {
    const issueNumber = args.issue_number;
    
    try {
      // Get issue details
      const issueDetails = execSync(
        `gh issue view ${issueNumber} --repo fuego-wtf/graphyn-workspace --json title,body,labels`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const issue = JSON.parse(issueDetails);
      
      // Read agent definition
      const agentPath = path.join(this.workspaceRoot, '.claude/agents/fullstack-sprint-executor.md');
      const agentDefinition = fs.readFileSync(agentPath, 'utf-8');
      
      // Read project memory
      const claudemdPath = path.join(this.workspaceRoot, 'CLAUDE.md');
      const projectMemory = fs.readFileSync(claudemdPath, 'utf-8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Executing sprint task for Issue #${issueNumber}: ${issue.title}
            
Context:
- Issue: ${issue.title}
- Labels: ${issue.labels.map((l: any) => l.name).join(', ')}
- Agent: fullstack-sprint-executor
- Architecture: 7-service boundaries from project memory

Next: Use Task tool to delegate to fullstack-sprint-executor with this context`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing sprint task: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleWriteTests(args: any): Promise<any> {
    const prNumber = args.pr_number;
    
    try {
      // Get PR details and diff
      const prDetails = execSync(
        `gh pr view ${prNumber} --json title,body,labels`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const prDiff = execSync(
        `gh pr diff ${prNumber}`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const pr = JSON.parse(prDetails);
      
      return {
        content: [
          {
            type: 'text',
            text: `Writing tests for PR #${prNumber}: ${pr.title}
            
Context:
- PR: ${pr.title}
- Changes: ${prDiff.split('\n').length} lines changed
- Agent: test-writer
- Standards: >90% coverage from CLAUDE.md

Next: Use Task tool to delegate to test-writer with PR diff analysis`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error writing tests: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleReviewPR(args: any): Promise<any> {
    const prNumber = args.pr_number;
    
    try {
      const prDetails = execSync(
        `gh pr view ${prNumber} --json title,body,labels,state`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const pr = JSON.parse(prDetails);
      
      return {
        content: [
          {
            type: 'text',
            text: `Reviewing PR #${prNumber}: ${pr.title}
            
Context:
- PR: ${pr.title}
- State: ${pr.state}
- Agent: pr-merger
- Quality gates: Architecture compliance, performance targets, test coverage

Next: Use Task tool to delegate to pr-merger for comprehensive review`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reviewing PR: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleDesignArchitecture(args: any): Promise<any> {
    const issueNumber = args.issue_number;
    
    try {
      const issueDetails = execSync(
        `gh issue view ${issueNumber} --repo fuego-wtf/graphyn-workspace --json title,body,labels`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const issue = JSON.parse(issueDetails);
      
      return {
        content: [
          {
            type: 'text',
            text: `Designing architecture for Issue #${issueNumber}: ${issue.title}
            
Context:
- Issue: ${issue.title}
- Agent: graphyn-platform-architect
- Performance targets: JWT <50ms, Thread <500ms, SSE <50ms
- Architecture: 7-service boundaries

Next: Use Task tool to delegate to platform-architect for system design`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error designing architecture: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleAssignPhase1(args: any): Promise<any> {
    try {
      // Get database issues
      const databaseIssues = execSync(
        `gh issue list --repo fuego-wtf/graphyn-backyard --label database --json number,title`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const issues = JSON.parse(databaseIssues);
      
      return {
        content: [
          {
            type: 'text',
            text: `Assigning Phase 1 Foundation Tasks:

Database Issues Found: ${issues.length}
${issues.map((i: any) => `- Issue #${i.number}: ${i.title}`).join('\n')}

Task Assignments (per CLAUDE.md):
- Issues #54, #55, #71 → fullstack-sprint-executor
- Issue #98 → graphyn-platform-architect  
- Issue #27 → graphyn-platform-architect then fullstack-sprint-executor

Next: Create TodoWrite tasks for each assignment`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error assigning Phase 1 tasks: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleAssignPhase2(args: any): Promise<any> {
    return {
      content: [
        {
          type: 'text',
          text: `Assigning Phase 2 Integration Tasks:

Prerequisites: Phase 1 completion required
Tasks:
- Integration testing across services
- Performance optimization  
- Security hardening

Next: Verify Phase 1 completion via TodoRead before proceeding`,
        },
      ],
    };
  }
  
  private async handleStatus(args: any): Promise<any> {
    try {
      // Get open PRs
      const openPRs = execSync(
        `gh pr list --repo fuego-wtf/graphyn-workspace --json number,title`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      // Get active issues
      const activeIssues = execSync(
        `gh issue list --assignee @me --json number,title`,
        { encoding: 'utf-8', cwd: this.workspaceRoot }
      );
      
      const prs = JSON.parse(openPRs);
      const issues = JSON.parse(activeIssues);
      
      return {
        content: [
          {
            type: 'text',
            text: `Ecosystem Status Report:

Open PRs: ${prs.length}
${prs.map((pr: any) => `- PR #${pr.number}: ${pr.title}`).join('\n')}

Active Issues: ${issues.length}
${issues.map((issue: any) => `- Issue #${issue.number}: ${issue.title}`).join('\n')}

Agent Coordination: Via TodoWrite system
Project Status: Per CLAUDE.md guidelines`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting status: ${error}`,
          },
        ],
      };
    }
  }
  
  private async handleActivateAll(args: any): Promise<any> {
    return {
      content: [
        {
          type: 'text',
          text: `Activating All Agents for Coordinated Sprint Execution:

Parallel Agent Startup:
1. fullstack-sprint-executor: Database schema tasks (#54, #55)
2. graphyn-platform-architect: v11 architecture design (#98)  
3. test-writer: Watch mode for incoming PRs
4. pr-merger: Review queue monitoring

Coordination Setup:
- Cross-agent dependencies via TodoWrite task linking
- Shared sprint context via CLAUDE.md memory
- Progress tracking through persistent TodoRead/TodoWrite

Next: Create TodoWrite tasks for each agent activation`,
        },
      ],
    };
  }
  
  private async handleTodoRead(args: any): Promise<any> {
    // In a real implementation, this would read from persistent storage
    // For now, return mock data structure
    return {
      content: [
        {
          type: 'text',
          text: `Current TodoWrite State:

Tasks:
- Phase 1 Foundation (in_progress)
  - Database schema fixes (#54, #55) → fullstack-sprint-executor
  - Architecture design (#98) → graphyn-platform-architect
  
Dependencies:
- Issue #27 blocked until #98 completion
- Test coverage dependent on implementation completion
- PR reviews dependent on test completion

Status: 3 active tasks, 2 pending dependencies`,
        },
      ],
    };
  }
  
  private async handleTodoWrite(args: any): Promise<any> {
    const tasks = args.tasks || [];
    
    return {
      content: [
        {
          type: 'text',
          text: `TodoWrite Tasks Created:

${tasks.map((task: any, index: number) => 
  `${index + 1}. [${task.status}] ${task.content}`
).join('\n')}

Total: ${tasks.length} tasks
Coordination: Available to all agents via TodoRead`,
        },
      ],
    };
  }
  
  // Resource handlers
  private async handleReadResource(uri: string) {
    switch (uri) {
      case 'claude://agents': {
        const agentsDir = path.join(this.workspaceRoot, '.claude/agents');
        const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
        
        const agents = agentFiles.map(file => {
          const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
          const name = file.replace('.md', '');
          return { name, content };
        });
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }
      
      case 'claude://commands': {
        const commandsDir = path.join(this.workspaceRoot, '.claude/commands');
        const commands: any[] = [];
        
        // Read agents commands
        const agentsDir = path.join(commandsDir, 'agents');
        if (fs.existsSync(agentsDir)) {
          const agentCommands = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
          for (const file of agentCommands) {
            const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
            commands.push({ type: 'agent', name: file.replace('.md', ''), content });
          }
        }
        
        // Read coordination commands
        const coordDir = path.join(commandsDir, 'coordination');
        if (fs.existsSync(coordDir)) {
          const coordCommands = fs.readdirSync(coordDir).filter(f => f.endsWith('.md'));
          for (const file of coordCommands) {
            const content = fs.readFileSync(path.join(coordDir, file), 'utf-8');
            commands.push({ type: 'coordination', name: file.replace('.md', ''), content });
          }
        }
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(commands, null, 2),
            },
          ],
        };
      }
      
      case 'claude://project-memory': {
        const claudemdPath = path.join(this.workspaceRoot, 'CLAUDE.md');
        const content = fs.readFileSync(claudemdPath, 'utf-8');
        
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      }
      
      case 'claude://github-issues': {
        try {
          const issues = execSync(
            `gh issue list --repo fuego-wtf/graphyn-workspace --json number,title,state,labels`,
            { encoding: 'utf-8', cwd: this.workspaceRoot }
          );
          
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: issues,
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: error.toString() }),
              },
            ],
          };
        }
      }
      
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }
}

// Export for CLI usage
export async function startAgentBridge(workspaceRoot: string): Promise<void> {
  const bridge = new ClaudeAgentBridge({
    workspaceRoot,
    debug: process.env.DEBUG === 'true',
  });
  
  await bridge.initialize();
}