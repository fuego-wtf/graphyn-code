#!/usr/bin/env node

/**
 * Graphyn CLI - Single Command Entry Point
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

interface graphyn_session {
  id: string;
  working_directory: string;
  project_analysis?: any;
  specialized_agents?: any[];
  start_time: number;
  query_count: number;
}

let session: graphyn_session = {
  id: `session-${Date.now()}`,
  working_directory: process.cwd(),
  start_time: Date.now(),
  query_count: 0
};

// Initialize class instances
let streaming_console_output: StreamingConsoleOutput;
let interactive_input: InteractiveInput; 
let real_time_executor: RealTimeExecutor;
let agent_registry: DynamicAgentRegistry;

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [first_arg, ...rest_args] = args;

  try {
    // Initialize all systems
    await initialize();

    if (!first_arg) {
      // Interactive mode: graphyn
      await start_interactive_mode();
    } else if (is_natural_language_query(first_arg)) {
      // Direct query: graphyn "build user authentication"
      const full_query = rest_args.length > 0 ? `${first_arg} ${rest_args.join(' ')}` : first_arg;
      await process_natural_language_query(full_query);
    } else {
      // Legacy commands or help
      await handle_legacy_command(first_arg, rest_args);
    }

  } catch (error) {
    console.error('❌ Graphyn CLI failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Initialize all systems with dynamic agent specialization
 */
async function initialize(): Promise<void> {
  console.log('🚀 Initializing Graphyn CLI with Dynamic Agent Specialization...');
  
  try {
    // Initialize specialization engine first
    await specializationEngine.initialize();
    
    // Create class instances
    streaming_console_output = new StreamingConsoleOutput();
    interactive_input = new InteractiveInput();
    real_time_executor = new RealTimeExecutor();
    agent_registry = new DynamicAgentRegistry();
    
    // Initialize other components
    await agent_registry.initialize();
    await real_time_executor.initialize();
    
    console.log('✅ All systems initialized successfully');
  } catch (error) {
    console.error('❌ Initialization failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Process natural language query with dynamic agent creation
 */
async function process_natural_language_query(query: string): Promise<void> {
  console.log('🔥 GRAPHYN CLI - DYNAMIC AGENT ORCHESTRATION');
  console.log('═'.repeat(80));
  console.log(`💡 Query: "${query}"`);
  console.log(`📁 Working Directory: ${session.working_directory}`);
  console.log('═'.repeat(80));
  console.log('');

  try {
    // PHASE 1: Deep Project Analysis
    console.log('🔍 PHASE 1: Deep Project Analysis');
    console.log('─'.repeat(50));
    
    const project_analysis = await specializationEngine.analyzeProject(session.working_directory);
    session.project_analysis = project_analysis;
    
    display_project_analysis(project_analysis);

    // PHASE 2: Dynamic Agent Specialization
    console.log('\n🤖 PHASE 2: Dynamic Agent Specialization');
    console.log('─'.repeat(50));
    
    const specialized_agents = await specializationEngine.createSpecializedAgents(project_analysis, query);
    session.specialized_agents = specialized_agents;
    
    if (specialized_agents.length === 0) {
      console.log('⚠️  No suitable agents found for this query and project combination.');
      return;
    }

    // PHASE 3: Advanced Integration Setup
    console.log('\n🔗 PHASE 3: Advanced Integration Setup');
    console.log('─'.repeat(50));
    
    await specializationEngine.setupAdvancedIntegrations(specialized_agents, project_analysis);
    
    // Display agent assignments
    display_agent_assignments(specialized_agents);

    // PHASE 4: Real-time Multi-Agent Execution
    console.log('\n⚡ PHASE 4: Real-time Multi-Agent Execution');
    console.log('─'.repeat(50));
    
    await execute_with_specialized_agents(query, specialized_agents, project_analysis);

    // PHASE 5: Enhanced UX and Session Management
    console.log('\n✨ PHASE 5: Enhanced User Experience');
    console.log('─'.repeat(50));
    
    await specializationEngine.setupEnhancedUX(specialized_agents);
    
    // Offer continuation
    await offer_continuation(query);

  } catch (error) {
    console.error('\n❌ Query execution failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Execute query with specialized agents
 */
async function execute_with_specialized_agents(
  query: string, 
  specialized_agents: any[], 
  project_analysis: any
): Promise<void> {
  let final_result: any = null;
  let completed_tasks = 0;
  let current_agent = '';

  // Use the primary agent for execution (highest confidence)
  const primary_agent = specialized_agents[0];
  console.log(`🎯 Primary Agent: ${primary_agent.base_agent.name} (${primary_agent.confidence_score.toFixed(2)} confidence)`);
  console.log(`💬 Reasoning: ${primary_agent.reasoning}`);
  console.log('');

  // Execute with real-time streaming through the orchestrator
  for await (const event of real_time_executor.executeQueryStream(query, {
    workingDirectory: session.working_directory,
    projectContext: project_analysis,
    specializedAgents: specialized_agents
  })) {
    
    // Handle streaming events with enhanced feedback
    switch (event.type) {
      case 'start':
        streaming_console_output.showAnalysis('🔍 Starting specialized agent analysis...', 'routing');
        break;
        
      case 'context':
        streaming_console_output.showAnalysis(event.data.message || '📋 Building specialized context...');
        break;
        
      case 'analysis':
        if (event.data.agent && event.data.confidence) {
          streaming_console_output.showRouting(event.data.agent, event.data.confidence, event.data.reasoning);
        } else {
          streaming_console_output.showAnalysis(event.data.message, event.data.stage);
        }
        break;
        
      case 'agent_start':
        current_agent = event.data.agent;
        streaming_console_output.startAgentStream(current_agent);
        streaming_console_output.showStatus(current_agent, 'thinking', 'analyzing with specialized knowledge');
        break;
        
      case 'message':
        if (event.data.message) {
          const message = event.data.message;
          
          if (message.type === 'assistant') {
            streaming_console_output.showStatus(current_agent, 'writing', 'generating specialized response');
            streaming_console_output.streamMessage({
              type: 'assistant',
              agent: current_agent,
              content: message.message?.content,
              timestamp: Date.now()
            });
          } else if (message.type === 'tool_use') {
            streaming_console_output.showStatus(current_agent, 'reading', message.tool?.name || 'using specialized tool');
            streaming_console_output.streamMessage({
              type: 'tool_use',
              agent: current_agent,
              tool: message.tool?.name,
              timestamp: Date.now()
            });
          } else if (message.type === 'result') {
            streaming_console_output.showStatus(current_agent, 'complete');
            streaming_console_output.streamMessage({
              type: 'result',
              agent: current_agent,
              timestamp: Date.now()
            });
            
            if ('subtype' in message && message.subtype === 'success') {
              final_result = (message as any).result || '';
            }
          }
        }
        break;
        
      case 'result':
        completed_tasks++;
        if (event.data && event.data.primaryResponse) {
          final_result = event.data.primaryResponse;
        } else if (event.data && typeof event.data === 'string') {
          final_result = event.data;
        }
        streaming_console_output.finishAgentStream();
        break;
        
      case 'error':
        console.error(`\n❌ Error: ${event.data.error}`);
        break;
    }
  }

  // Show final specialized result
  if (final_result && typeof final_result === 'string' && final_result.trim()) {
    console.log('\n' + '═'.repeat(80));
    console.log('📋 SPECIALIZED AGENT RESPONSE');
    console.log('═'.repeat(80));
    console.log(final_result.trim());
  } else if (completed_tasks === 0) {
    console.log('\n⚠️  No response generated. This may indicate an issue with the specialized agent execution.');
  }

  // Show completion summary with specialization details
  console.log('\n' + '═'.repeat(80));
  console.log(`🎉 TASK COMPLETED WITH SPECIALIZED AGENTS`);
  console.log(`   • Primary Agent: ${primary_agent.base_agent.name}`);
  console.log(`   • Confidence Score: ${primary_agent.confidence_score.toFixed(2)}`);
  console.log(`   • Technology Match: ${primary_agent.technology_match.map((t: any) => t.name).join(', ')}`);
  console.log(`   • Tasks Completed: ${completed_tasks}`);
  console.log('═'.repeat(80));

  session.query_count++;
}

/**
 * Interactive mode with dynamic agent specialization
 */
async function start_interactive_mode(): Promise<void> {
  console.log('🚀 GRAPHYN INTERACTIVE MODE - Dynamic Agent Specialization');
  console.log('═'.repeat(80));
  console.log('💡 Natural language queries will be analyzed and routed to specialized agents');
  console.log('📁 Working in:', session.working_directory);
  console.log('═'.repeat(80));
  console.log('');

  // Analyze project once for the session
  console.log('🔍 Analyzing project for agent specialization...');
  try {
    const project_analysis = await specializationEngine.analyzeProject(session.working_directory);
    session.project_analysis = project_analysis;
    display_project_analysis(project_analysis);
  } catch (error) {
    console.warn('⚠️  Could not analyze project, using generic agents');
  }

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    show_session_summary();
    process.exit(0);
  });

  // Start interactive input loop
  interactive_input.on('userInput', async (query: string) => {
    try {
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        show_session_summary();
        process.exit(0);
      }

      console.log(''); // Add spacing
      await process_natural_language_query(query);
      console.log(''); // Add spacing before next prompt
      
    } catch (error) {
      console.error('\n❌ Query failed:', error instanceof Error ? error.message : String(error));
      console.log(''); // Add spacing before next prompt
    }
  });

  await interactive_input.startInteractiveMode();
}

/**
 * Display project analysis summary
 */
function display_project_analysis(analysis: any): void {
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
function display_agent_assignments(agents: any[]): void {
  console.log('🤖 SPECIALIZED AGENT ASSIGNMENTS:');
  
  for (let i = 0; i < agents.length && i < 5; i++) {
    const agent = agents[i];
    const tech_stack = agent.technology_match.map((t: any) => t.name).join(', ');
    
    console.log(`   ${i + 1}. ${agent.base_agent.name}`);
    console.log(`      • Confidence: ${agent.confidence_score.toFixed(2)}`);
    console.log(`      • Specialization: ${tech_stack || 'General'}`);
    console.log(`      • Reasoning: ${agent.reasoning}`);
  }
  
  if (agents.length > 5) {
    console.log(`   ... and ${agents.length - 5} more specialized agents ready`);
  }
}

/**
 * Offer continuation after query completion
 */
async function offer_continuation(previous_query: string): Promise<void> {
  console.log('\n💡 What would you like to do next?');
  console.log('  • Ask for clarification or improvements');
  console.log('  • Request new features or changes');  
  console.log('  • Get explanations about the implementation');
  console.log('  • Start a completely new task');
  console.log('  • Type "exit" to quit');
  console.log('');
  
  const follow_up = await interactive_input.showContinuationPrompt();
  
  if (follow_up && follow_up.toLowerCase() !== 'exit' && follow_up.toLowerCase() !== 'quit') {
    console.log(''); // Add spacing
    await process_natural_language_query(follow_up);
  }
}

/**
 * Handle legacy commands for backward compatibility
 */
async function handle_legacy_command(command: string, args: string[]): Promise<void> {
  switch (command) {
    case '--help':
    case '-h':
    case 'help':
      show_help();
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
      await show_agent_info();
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
async function show_agent_info(): Promise<void> {
  console.log('🤖 DYNAMIC AGENT SPECIALIZATION SYSTEM');
  console.log('═'.repeat(60));
  
  if (session.project_analysis && session.specialized_agents) {
    console.log('📊 Current Session Agents:');
    display_agent_assignments(session.specialized_agents);
  } else {
    console.log('📋 Available Base Agent Types:');
    const agents = agent_registry.getAgents();
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
function show_session_summary(): void {
  const duration = Math.round((Date.now() - session.start_time) / 1000);
  
  console.log('\n📊 SESSION SUMMARY');
  console.log('═'.repeat(40));
  console.log(`   • Session ID: ${session.id}`);
  console.log(`   • Duration: ${duration}s`);
  console.log(`   • Queries Processed: ${session.query_count}`);
  
  if (session.specialized_agents) {
    console.log(`   • Specialized Agents: ${session.specialized_agents.length}`);
  }
  
  console.log('   • Thank you for using Graphyn! 🚀');
}

/**
 * Check if input is a natural language query
 */
function is_natural_language_query(input: string): boolean {
  // Known commands that are NOT natural language
  const known_commands = [
    'help', '--help', '-h',
    'version', '--version', '-v', 
    'init', 'agents', 'config', 'auth', 'logout'
  ];
  
  if (known_commands.includes(input.toLowerCase())) {
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
function show_help(): void {
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

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Graphyn CLI failed:', error);
    process.exit(1);
  });
}
