#!/usr/bin/env node

/**
 * Unified Graphyn CLI - Single Command Entry Point
 * 
 * Handles everything through a single `graphyn` command:
 * - graphyn -> Interactive mode
 * - graphyn "user query" -> Direct natural language processing
 * 
 * Features:
 * - Dynamic agent specialization per user/repo
 * - Technology stack analysis and confidence scoring
 * - Real-time multi-agent orchestration 
 * - Claude Code SDK integration
 * - Figma API and GitHub OAuth support
 * - Human-in-the-loop workflows
 */

import { specializationEngine } from './engines/SpecializationEngine.js';
import { DynamicAgentRegistry } from './agents/DynamicAgentRegistry.js';
import { StreamingConsoleOutput } from './console/StreamingConsoleOutput.js';
import { InteractiveInput } from './console/InteractiveInput.js';
import { RealTimeExecutor } from './orchestrator/RealTimeExecutor.js';

interface GraphynSession {
  id: string;
  workingDirectory: string;
  projectAnalysis?: any;
  specializedAgents?: any[];
  startTime: number;
  queryCount: number;
}

export class UnifiedGraphynCLI {
  private session: GraphynSession;
  private streamingOutput: StreamingConsoleOutput;
  private interactiveInput: InteractiveInput;
  private realTimeExecutor: RealTimeExecutor;
  private agentRegistry: DynamicAgentRegistry;

  constructor() {
    this.session = {
      id: `session-${Date.now()}`,
      workingDirectory: process.cwd(),
      startTime: Date.now(),
      queryCount: 0
    };
    
    this.streamingOutput = new StreamingConsoleOutput();
    this.interactiveInput = new InteractiveInput();
    this.realTimeExecutor = new RealTimeExecutor();
    this.agentRegistry = new DynamicAgentRegistry();
  }

  /**
   * Main CLI entry point
   */
  async main(): Promise<void> {
    const args = process.argv.slice(2);
    const [firstArg, ...restArgs] = args;

    try {
      // Initialize all systems
      await this.initialize();

      if (!firstArg) {
        // Interactive mode: graphyn
        await this.startInteractiveMode();
      } else if (this.isNaturalLanguageQuery(firstArg)) {
        // Direct query: graphyn "build user authentication"
        const fullQuery = restArgs.length > 0 ? `${firstArg} ${restArgs.join(' ')}` : firstArg;
        await this.processNaturalLanguageQuery(fullQuery);
      } else {
        // Legacy commands or help
        await this.handleLegacyCommand(firstArg, restArgs);
      }

    } catch (error) {
      console.error('❌ Graphyn CLI failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Initialize all systems with dynamic agent specialization
   */
  private async initialize(): Promise<void> {
    console.log('🚀 Initializing Graphyn CLI with Dynamic Agent Specialization...');
    
    try {
      // Initialize specialization engine first
      await specializationEngine.initialize();
      
      // Initialize other components
      await this.agentRegistry.initialize();
      await this.realTimeExecutor.initialize();
      
      console.log('✅ All systems initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Process natural language query with dynamic agent creation
   */
  private async processNaturalLanguageQuery(query: string): Promise<void> {
    console.log('🔥 UNIFIED GRAPHYN CLI - DYNAMIC AGENT ORCHESTRATION');
    console.log('═'.repeat(80));
    console.log(`💡 Query: "${query}"`);
    console.log(`📁 Working Directory: ${this.session.workingDirectory}`);
    console.log('═'.repeat(80));
    console.log('');

    try {
      // PHASE 1: Deep Project Analysis (Steps 1-15)
      console.log('🔍 PHASE 1: Deep Project Analysis');
      console.log('─'.repeat(50));
      
      const projectAnalysis = await specializationEngine.analyzeProject(this.session.workingDirectory);
      this.session.projectAnalysis = projectAnalysis;
      
      this.displayProjectAnalysis(projectAnalysis);

      // PHASE 2: Dynamic Agent Specialization (Steps 16-30)
      console.log('\n🤖 PHASE 2: Dynamic Agent Specialization');
      console.log('─'.repeat(50));
      
      const specializedAgents = await specializationEngine.createSpecializedAgents(projectAnalysis, query);
      this.session.specializedAgents = specializedAgents;
      
      if (specializedAgents.length === 0) {
        console.log('⚠️  No suitable agents found for this query and project combination.');
        return;
      }

      // PHASE 3: Advanced Integration Setup (Steps 31-45)
      console.log('\n🔗 PHASE 3: Advanced Integration Setup');
      console.log('─'.repeat(50));
      
      await specializationEngine.setupAdvancedIntegrations(specializedAgents, projectAnalysis);
      
      // Display agent assignments
      this.displayAgentAssignments(specializedAgents);

      // PHASE 4: Real-time Multi-Agent Execution (Steps 46-60)
      console.log('\n⚡ PHASE 4: Real-time Multi-Agent Execution');
      console.log('─'.repeat(50));
      
      await this.executeWithSpecializedAgents(query, specializedAgents, projectAnalysis);

      // PHASE 5: Enhanced UX and Session Management (Steps 61-75)
      console.log('\n✨ PHASE 5: Enhanced User Experience');
      console.log('─'.repeat(50));
      
      await specializationEngine.setupEnhancedUX(specializedAgents);
      
      // Offer continuation
      await this.offerContinuation(query);

    } catch (error) {
      console.error('\n❌ Query execution failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Execute query with specialized agents
   */
  private async executeWithSpecializedAgents(
    query: string, 
    specializedAgents: any[], 
    projectAnalysis: any
  ): Promise<void> {
    let finalResult: any = null;
    let completedTasks = 0;
    let currentAgent = '';

    // Use the primary agent for execution (highest confidence)
    const primaryAgent = specializedAgents[0];
    console.log(`🎯 Primary Agent: ${primaryAgent.base_agent.name} (${primaryAgent.confidence_score.toFixed(2)} confidence)`);
    console.log(`💬 Reasoning: ${primaryAgent.reasoning}`);
    console.log('');

    // Execute with real-time streaming through the orchestrator
    for await (const event of this.realTimeExecutor.executeQueryStream(query, {
      workingDirectory: this.session.workingDirectory,
      projectContext: projectAnalysis,
      specializedAgents: specializedAgents
    })) {
      
      // Handle streaming events with enhanced feedback
      switch (event.type) {
        case 'start':
          this.streamingOutput.showAnalysis('🔍 Starting specialized agent analysis...', 'routing');
          break;
          
        case 'context':
          this.streamingOutput.showAnalysis(event.data.message || '📋 Building specialized context...');
          break;
          
        case 'analysis':
          if (event.data.agent && event.data.confidence) {
            this.streamingOutput.showRouting(event.data.agent, event.data.confidence, event.data.reasoning);
          } else {
            this.streamingOutput.showAnalysis(event.data.message, event.data.stage);
          }
          break;
          
        case 'agent_start':
          currentAgent = event.data.agent;
          this.streamingOutput.startAgentStream(currentAgent);
          this.streamingOutput.showStatus(currentAgent, 'thinking', 'analyzing with specialized knowledge');
          break;
          
        case 'message':
          if (event.data.message) {
            const message = event.data.message;
            
            if (message.type === 'assistant') {
              this.streamingOutput.showStatus(currentAgent, 'writing', 'generating specialized response');
              this.streamingOutput.streamMessage({
                type: 'assistant',
                agent: currentAgent,
                content: message.message?.content,
                timestamp: Date.now()
              });
            } else if (message.type === 'tool_use') {
              this.streamingOutput.showStatus(currentAgent, 'reading', message.tool?.name || 'using specialized tool');
              this.streamingOutput.streamMessage({
                type: 'tool_use',
                agent: currentAgent,
                tool: message.tool?.name,
                timestamp: Date.now()
              });
            } else if (message.type === 'result') {
              this.streamingOutput.showStatus(currentAgent, 'complete');
              this.streamingOutput.streamMessage({
                type: 'result',
                agent: currentAgent,
                timestamp: Date.now()
              });
              
              if ('subtype' in message && message.subtype === 'success') {
                finalResult = (message as any).result || '';
              }
            }
          }
          break;
          
        case 'result':
          completedTasks++;
          if (event.data && event.data.primaryResponse) {
            finalResult = event.data.primaryResponse;
          } else if (event.data && typeof event.data === 'string') {
            finalResult = event.data;
          }
          this.streamingOutput.finishAgentStream();
          break;
          
        case 'error':
          console.error(`\n❌ Error: ${event.data.error}`);
          break;
      }
    }

    // Show final specialized result
    if (finalResult && typeof finalResult === 'string' && finalResult.trim()) {
      console.log('\n' + '═'.repeat(80));
      console.log('📋 SPECIALIZED AGENT RESPONSE');
      console.log('═'.repeat(80));
      console.log(finalResult.trim());
    } else if (completedTasks === 0) {
      console.log('\n⚠️  No response generated. This may indicate an issue with the specialized agent execution.');
    }

    // Show completion summary with specialization details
    console.log('\n' + '═'.repeat(80));
    console.log(`🎉 TASK COMPLETED WITH SPECIALIZED AGENTS`);
    console.log(`   • Primary Agent: ${primaryAgent.base_agent.name}`);
    console.log(`   • Confidence Score: ${primaryAgent.confidence_score.toFixed(2)}`);
    console.log(`   • Technology Match: ${primaryAgent.technology_match.map((t: any) => t.name).join(', ')}`);
    console.log(`   • Tasks Completed: ${completedTasks}`);
    console.log('═'.repeat(80));

    this.session.queryCount++;
  }

  /**
   * Interactive mode with dynamic agent specialization
   */
  private async startInteractiveMode(): Promise<void> {
    console.log('🚀 GRAPHYN INTERACTIVE MODE - Dynamic Agent Specialization');
    console.log('═'.repeat(80));
    console.log('💡 Natural language queries will be analyzed and routed to specialized agents');
    console.log('📁 Working in:', this.session.workingDirectory);
    console.log('═'.repeat(80));
    console.log('');

    // Analyze project once for the session
    console.log('🔍 Analyzing project for agent specialization...');
    try {
      const projectAnalysis = await specializationEngine.analyzeProject(this.session.workingDirectory);
      this.session.projectAnalysis = projectAnalysis;
      this.displayProjectAnalysis(projectAnalysis);
    } catch (error) {
      console.warn('⚠️  Could not analyze project, using generic agents');
    }

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      this.showSessionSummary();
      process.exit(0);
    });

    // Start interactive input loop
    this.interactiveInput.on('userInput', async (query: string) => {
      try {
        if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
          this.showSessionSummary();
          process.exit(0);
        }

        console.log(''); // Add spacing
        await this.processNaturalLanguageQuery(query);
        console.log(''); // Add spacing before next prompt
        
      } catch (error) {
        console.error('\n❌ Query failed:', error instanceof Error ? error.message : String(error));
        console.log(''); // Add spacing before next prompt
      }
    });

    await this.interactiveInput.startInteractiveMode();
  }

  /**
   * Display project analysis summary
   */
  private displayProjectAnalysis(analysis: any): void {
    console.log('📊 PROJECT ANALYSIS COMPLETE');
    console.log(`   • Repository: ${analysis.repository.name} (${analysis.repository.primary_language})`);
    console.log(`   • Architecture: ${analysis.architecture.type} (complexity: ${analysis.architecture.complexity_score}/100)`);
    console.log(`   • Technologies: ${analysis.technologies.map((t: any) => `${t.name} (${t.confidence.toFixed(2)})`).join(', ')}`);
    
    if (analysis.api_integrations.figma || analysis.api_integrations.github) {
      console.log(`   • API Integrations: ${[
        analysis.api_integrations.figma && 'Figma',
        analysis.api_integrations.github && 'GitHub'
      ].filter(Boolean).join(', ')}`);
    }
    
    if (analysis.development_workflow.testing_framework.length > 0) {
      console.log(`   • Testing: ${analysis.development_workflow.testing_framework.join(', ')}`);
    }
  }

  /**
   * Display specialized agent assignments
   */
  private displayAgentAssignments(agents: any[]): void {
    console.log('🤖 SPECIALIZED AGENT ASSIGNMENTS:');
    
    for (let i = 0; i < agents.length && i < 5; i++) {
      const agent = agents[i];
      const techStack = agent.technology_match.map((t: any) => t.name).join(', ');
      
      console.log(`   ${i + 1}. ${agent.base_agent.name}`);
      console.log(`      • Confidence: ${agent.confidence_score.toFixed(2)}`);
      console.log(`      • Specialization: ${techStack || 'General'}`);
      console.log(`      • Reasoning: ${agent.reasoning}`);
    }
    
    if (agents.length > 5) {
      console.log(`   ... and ${agents.length - 5} more specialized agents ready`);
    }
  }

  /**
   * Offer continuation after query completion
   */
  private async offerContinuation(_previousQuery: string): Promise<void> {
    console.log('\n💡 What would you like to do next?');
    console.log('  • Ask for clarification or improvements');
    console.log('  • Request new features or changes');  
    console.log('  • Get explanations about the implementation');
    console.log('  • Start a completely new task');
    console.log('  • Type "exit" to quit');
    console.log('');
    
    const followUp = await this.interactiveInput.showContinuationPrompt();
    
    if (followUp && followUp.toLowerCase() !== 'exit' && followUp.toLowerCase() !== 'quit') {
      console.log(''); // Add spacing
      await this.processNaturalLanguageQuery(followUp);
    }
  }

  /**
   * Handle legacy commands for backward compatibility
   */
  private async handleLegacyCommand(command: string, _args: string[]): Promise<void> {
    switch (command) {
      case '--help':
      case '-h':
      case 'help':
        this.showHelp();
        break;
        
      case '--version':
      case '-v':
      case 'version':
        console.log('Graphyn CLI v3.0.0 - Dynamic Agent Specialization Engine');
        break;
        
      case 'init':
        console.log('🚀 Initializing Graphyn project with dynamic agent specialization...');
        // TODO: Project initialization
        break;
        
      case 'agents':
        await this.showAgentInfo();
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Try: graphyn --help');
        process.exit(1);
    }
  }

  /**
   * Show specialized agent information
   */
  private async showAgentInfo(): Promise<void> {
    console.log('🤖 DYNAMIC AGENT SPECIALIZATION SYSTEM');
    console.log('═'.repeat(60));
    
    if (this.session.projectAnalysis && this.session.specializedAgents) {
      console.log('📊 Current Session Agents:');
      this.displayAgentAssignments(this.session.specializedAgents);
    } else {
      console.log('📋 Available Base Agent Types:');
      const agents = this.agentRegistry.getAgents();
      for (const agent of agents.slice(0, 8)) {
        console.log(`   • ${agent.name} (${agent.type})`);
        console.log(`     ${agent.description}`);
      }
      
      console.log('\n💡 Agents are specialized dynamically based on your project and queries');
    }
  }

  /**
   * Show session summary
   */
  private showSessionSummary(): void {
    const duration = Math.round((Date.now() - this.session.startTime) / 1000);
    
    console.log('\n📊 SESSION SUMMARY');
    console.log('═'.repeat(40));
    console.log(`   • Session ID: ${this.session.id}`);
    console.log(`   • Duration: ${duration}s`);
    console.log(`   • Queries Processed: ${this.session.queryCount}`);
    
    if (this.session.specializedAgents) {
      console.log(`   • Specialized Agents: ${this.session.specializedAgents.length}`);
    }
    
    console.log('   • Thank you for using Graphyn! 🚀');
  }

  /**
   * Check if input is a natural language query
   */
  private isNaturalLanguageQuery(input: string): boolean {
    // Known commands that are NOT natural language
    const knownCommands = [
      'help', '--help', '-h',
      'version', '--version', '-v', 
      'init', 'agents', 'config', 'auth', 'logout'
    ];
    
    if (knownCommands.includes(input.toLowerCase())) {
      return false;
    }

    // Natural language patterns
    const patterns = [
      /^(help|tell|show|create|build|make|add|implement|fix|update|generate|write|explain)/i,
      /^(what|how|why|when|where|can|could|should|would|please)/i,
      /\s/, // Contains spaces
      /^".*"$/, // Quoted string
      /\?$/ // Ends with question mark
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Show CLI help
   */
  private showHelp(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       GRAPHYN CLI v3.0.0                                     ║
║                Dynamic Agent Specialization Engine                           ║
╚═══════════════════════════════════════════════════════════════════════════════╝

USAGE:
  graphyn                          Interactive mode with specialized agents
  graphyn "your natural query"     Direct processing with dynamic agent selection

FEATURES:
  🤖 Dynamic agent specialization per user/repository
  🔍 Deep project analysis with technology detection  
  ⚡ Real-time multi-agent orchestration (up to 8 agents)
  🎯 Confidence scoring and technology matching
  🔗 Figma API and GitHub OAuth integration
  💬 Human-in-the-loop workflows
  ✨ Claude Code SDK integration

EXAMPLES:
  graphyn                                    # Start interactive mode
  graphyn "build user authentication"       # Direct natural language query
  graphyn "add OAuth with Google and GitHub" # API integration query
  graphyn "create responsive dashboard UI"   # Frontend-focused query
  graphyn "optimize database performance"    # Backend-focused query
  graphyn "implement TDD workflow"           # Testing-focused query

SPECIALIZATION:
  • Agents are created dynamically based on your project's technology stack
  • Confidence scoring matches the best agents to your specific needs  
  • Technology detection includes React, Vue, Django, Express, and many more
  • Each agent is enhanced with project-specific knowledge and tools

LEGACY COMMANDS:
  graphyn help                     Show this help
  graphyn version                  Show version information
  graphyn agents                   Show current agent configuration
  graphyn init                     Initialize new project (coming soon)

The future of AI-powered development is specialized agents that understand
your exact technology stack and project requirements. 🚀
`);
  }
}

// Main execution
async function main(): Promise<void> {
  const cli = new UnifiedGraphynCLI();
  await cli.main();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unified Graphyn CLI failed:', error);
    process.exit(1);
  });
}

