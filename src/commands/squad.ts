import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { GraphynAPIClient } from '../api-client.js';
import { SquadsAPI, AskSquadRequest } from '../api/squads.js';
import { getCachedAnalysis } from './analyze.js';
import { ConfigManager } from '../config-manager.js';
import { buildAskRequest, detectRepository, contextBuilders } from '../services/request-builder.js';
import { getRecommendedAgents, createExampleAgents } from '../services/example-agents.js';
import { render } from 'ink';
import { debug, debugError, debugSuccess, setDebugMode } from '../utils/debug.js';
import React from 'react';
import { InteractiveSquadBuilder } from '../components/InteractiveSquadBuilder.js';
import { ThreadStreamHandler } from '../utils/sse-handler.js';
import type { Task } from '../services/claude-task-generator.js';
import type { SquadFeedbackData } from '../ink/components/SquadFeedback.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
};

export async function createSquad(userMessage: string, options: any = {}) {
  // Set debug mode if option is passed
  if (options.debug) {
    setDebugMode(true);
  }
  
  debug('🔍 createSquad called');
  debug('User message:', userMessage);
  debug('Options:', JSON.stringify(options, null, 2));
  
  try {
    console.log(colors.info('🤖 Preparing your AI development squad...\n'));

    // Check authentication
    const oauthManager = new OAuthManager();
    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.error('❌ Not authenticated. Please run "graphyn auth" first.'));
      return;
    }

    // Get valid token
    const token = await oauthManager.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    // Check for existing squads unless --new flag is passed
    if (!options.new) {
      const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
      const existingSquad = await selectExistingSquad(token, apiUrl);
      if (existingSquad) {
        // User selected an existing squad
        console.log(colors.success(`\n✅ Using existing squad: ${existingSquad.name}`));
        console.log(colors.info(`Squad ID: ${existingSquad.id}`));
        
        // Use the existing squad
        await useExistingSquad(existingSquad, token, userMessage);
        return;
      }
      // If no squad selected, continue with new squad creation
    }

    // Get configuration
    const configManager = new ConfigManager();
    const currentUser = await configManager.get('auth.user');
    
    // Determine context mode
    const contextMode = options.contextMode || 'basic';
    debug('🔧 Building context');
    debug('Context mode:', contextMode);
    
    // Check for cached analysis
    const cachedAnalysis = await getCachedAnalysis();
    let context = options.context;
    
    if (!context && cachedAnalysis) {
      console.log(colors.info('📊 Using cached repository analysis'));
      debug('Cached context:', JSON.stringify(cachedAnalysis.context, null, 2));
      context = cachedAnalysis.context;
    } else if (!context) {
      // Build context using the modular system
      console.log(colors.info('🔍 Analyzing repository...'));
      const contextBuilder = contextBuilders[contextMode];
      context = await contextBuilder(process.cwd());
      debug('Built context:', JSON.stringify(context, null, 2));
    }
    
    // Build the request using the modular system
    debug('🔨 Detecting repository info');
    const repoInfo = await detectRepository(process.cwd());
    debug('Repository info:', JSON.stringify(repoInfo, null, 2));
    
    // Build a minimal request - the backend gets organization from auth context
    const request: AskSquadRequest = {
      user_message: userMessage,
      // team_id is optional - backend will use user's default organization if not provided
    };
    
    debug('🎯 Building request');
    debug('Base request:', JSON.stringify(request, null, 2));
    
    // Only add optional fields if they exist
    if (repoInfo.url) {
      request.repo_url = repoInfo.url;
      debug('Added repo_url:', repoInfo.url);
    }
    if (repoInfo.branch) {
      request.repo_branch = repoInfo.branch;
      debug('Added repo_branch:', repoInfo.branch);
    }
    
    // Only add context if it's not empty
    if (context && Object.keys(context).length > 0) {
      request.context = context;
      debug('Added context with keys:', Object.keys(context));
    }

    // Initialize API
    const squadsAPI = new SquadsAPI(token);

    console.log(colors.info('🔄 Analyzing your request...'));
    
    debug('📤 Final request to be sent');
    debug(JSON.stringify(request, null, 2));
    
    // Call API
    debug('🚀 Calling askForSquad API');
    const response = await squadsAPI.askForSquad(request);
    
    debugSuccess('✔️ API call successful');
    debug('Response:', JSON.stringify(response, null, 2));
    
    // The response contains a squad recommendation (group of agents)
    // This is not persisted as a "current squad" since each request creates a new squad

    // Display results
    displaySquadCreationResponse(response);

    // Save squad info if available
    if (response.squad) {
      await saveSquadInfo(response.squad, userMessage);
    }
    
    // Enter interactive mode if not disabled
    if (!options.nonInteractive && response.thread_id) {
      console.log(colors.info('\n🎮 Entering interactive mode...'));
      console.log(colors.info('Use arrow keys to navigate, Enter to select, ESC to exit\n'));
      
      // Launch interactive squad builder
      const agents = await launchInteractiveSquadBuilder(response.thread_id, token);
      
      if (agents && agents.length > 0) {
        // Squad was approved, proceed to naming and saving
        await handleSquadApproval(agents, token);
      }
    } else {
      // Check if user has any agents and offer to create examples
      await checkAndOfferExampleAgents(token, userMessage);
    }

  } catch (error) {
    debugError('🚨 Error in createSquad');
    debugError('Error type:', error?.constructor?.name);
    debugError('Error message:', error?.message);
    debugError('Error stack:', error?.stack);
    
    console.error(colors.error('❌ Failed to create squad:'), error);
  }
}

function displaySquadCreationResponse(response: any) {
  console.log(colors.success('\n✅ Squad Creation Started!\n'));
  
  console.log(colors.info('📍 Thread ID:'), colors.highlight(response.thread_id));
  console.log(colors.info('🔗 Stream URL:'), colors.highlight(response.stream_url));
  console.log(colors.info('💬 Message:'), response.message);
  
  if (response.squad && response.squad.agents && response.squad.agents.length > 0) {
    console.log(chalk.bold('\n📋 Initial Squad Analysis:\n'));
    console.log(chalk.bold('Formation:'), colors.highlight(response.squad.formation));
    console.log(chalk.bold('Reasoning:'), response.squad.reasoning);
    
    console.log(chalk.bold('\n👥 Recommended Agents:\n'));
    
    response.squad.agents.forEach((agent: any, index: number) => {
      console.log(colors.highlight(`${index + 1}. ${agent.emoji || '🤖'} ${agent.name}`));
      console.log(`   Role: ${agent.role}`);
      console.log(`   Style: ${agent.style}`);
      console.log(`   Description: ${agent.description}`);
      
      if (agent.skills && Object.keys(agent.skills).length > 0) {
        console.log(`   Skills:`);
        Object.entries(agent.skills).forEach(([skill, level]) => {
          const bars = '█'.repeat(Number(level)) + '░'.repeat(10 - Number(level));
          console.log(`     ${skill}: ${bars} ${level}/10`);
        });
      }
      console.log();
    });
  } else {
    console.log(colors.info('\n⏳ The Team Builder is analyzing your request...'));
    console.log(colors.info('💡 Squad recommendations will appear in the thread.'));
  }
  
  console.log(colors.info('\n📺 To monitor progress:'));
  
  // Determine app URL based on API URL
  const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  let appUrl = 'https://app.graphyn.xyz';
  
  if (apiUrl.includes('localhost')) {
    // In development, use localhost:3000 for the app
    appUrl = 'http://localhost:3000';
  }
  
  console.log(colors.info('   Visit the thread at'), colors.highlight(`${appUrl}/threads/${response.thread_id}`));
  console.log(colors.info('   Or stream updates using the API at'), colors.highlight(response.stream_url));
}

async function saveSquadInfo(squad: any, userMessage: string) {
  const configManager = new ConfigManager();
  
  await configManager.set('lastSquadRecommendation', {
    squad,
    userMessage,
    timestamp: new Date().toISOString(),
  });
  
  console.log(colors.info('\n📌 Squad recommendation saved'));
  console.log(colors.info('You can now create these agents in the Graphyn platform'));
}

async function checkAndOfferExampleAgents(token: string, userMessage: string) {
  try {
    // Check if user has any agents
    const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    const response = await fetch(`${apiUrl}/api/internal/agents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(colors.warning('\n⚠️  Could not check existing agents'));
      return;
    }

    const data = await response.json() as { agents: any[] };
    const existingAgents = data.agents || [];
    
    // Filter out the Team Builder agent
    const userAgents = existingAgents.filter((agent: any) => 
      !agent.name.toLowerCase().includes('builder') && 
      !agent.name.toLowerCase().includes('team')
    );

    if (userAgents.length === 0) {
      console.log(colors.info('\n📊 No custom agents found in your organization.'));
      console.log(colors.info('🎯 Here are some recommended agents based on your request:\n'));
      
      // Get recommended agents based on user message
      const recommendedAgents = getRecommendedAgents(userMessage);
      
      // Display recommended agents
      displayRecommendedAgents(recommendedAgents);
      
      console.log(colors.info('\n💡 To create these agents automatically, run:'));
      console.log(colors.highlight('   graphyn squad create-examples'));
      console.log(colors.info('\n   Or create them manually in the Graphyn platform.'));
    } else {
      console.log(colors.info(`\n✅ Found ${userAgents.length} existing agents in your organization.`));
    }
  } catch (error) {
    console.log(colors.warning('\n⚠️  Could not check existing agents:', error));
  }
}

function displayRecommendedAgents(agents: any[]) {
  console.log(chalk.yellow('\n┌─────────────────────── Your Dev Squad for Authentication ───────────────────────┐'));
  console.log(chalk.yellow('│                                                                                  │'));
  
  agents.forEach((agent, index) => {
    console.log(chalk.yellow('│') + `  ${agent.emoji || '⚡'} ${chalk.cyan.bold(agent.name)} (${agent.formation})` + ' '.repeat(Math.max(0, 84 - agent.name.length - agent.formation.length - 6)) + chalk.yellow('│'));
    
    // Skills line
    const skillEntries = Object.entries(agent.skills).slice(0, 3);
    let skillsLine = '│     Skills: ';
    skillEntries.forEach(([skill, level], idx) => {
      const numLevel = Number(level);
      const bars = '█'.repeat(numLevel) + '░'.repeat(10 - numLevel);
      const barColor = numLevel >= 8 ? chalk.green : numLevel >= 5 ? chalk.yellow : chalk.red;
      skillsLine += skill + ' ' + barColor(bars);
      if (idx < skillEntries.length - 1) skillsLine += ' | ';
    });
    console.log(chalk.yellow(skillsLine) + ' '.repeat(Math.max(0, 84 - skillsLine.length + 1)) + chalk.yellow('│'));
    
    console.log(chalk.yellow('│') + `     Role: ${agent.role}` + ' '.repeat(Math.max(0, 73 - agent.role.length)) + chalk.yellow('│'));
    console.log(chalk.yellow('│') + `     Style: ${agent.style}` + ' '.repeat(Math.max(0, 72 - agent.style.length)) + chalk.yellow('│'));
    
    if (index < agents.length - 1) {
      console.log(chalk.yellow('│                                                                                  │'));
    }
  });
  
  console.log(chalk.yellow('└──────────────────────────────────────────────────────────────────────────────────┘'));
}

async function launchInteractiveSquadBuilder(threadId: string, token: string) {
  const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  
  return new Promise<any[]>((resolve) => {
    const { unmount } = render(
      React.createElement(InteractiveSquadBuilder, {
        threadId,
        token,
        apiUrl,
        onSquadApproved: (agents) => {
          unmount();
          resolve(agents);
        },
        onExit: () => {
          console.log(colors.info('\n👋 Exiting interactive mode...'));
          unmount();
          resolve([]);
        }
      })
    );
  });
}

async function handleSquadApproval(agents: any[], token: string) {
  console.log(colors.success('\n✅ Squad configuration approved!'));
  console.log(colors.info(`Total agents: ${agents.length}`));
  agents.forEach((agent, idx) => {
    console.log(colors.highlight(`${idx + 1}. ${agent.emoji} ${agent.name}`));
  });
  
  // Launch squad naming flow
  const squadInfo = await launchSquadNaming(agents);
  
  if (squadInfo) {
    // Get current user info
    const configManager = new ConfigManager();
    const currentUser = await configManager.get('auth.user');
    
    // Save squad to backend
    const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
    try {
      // First, let's try to understand what the backend expects
      console.log(colors.info('\n🔍 Attempting to save squad to backend...'));
      console.log(colors.info('Current user info:'), currentUser);
      
      const response = await fetch(`${apiUrl}/api/squads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: squadInfo.name,
          description: squadInfo.description,
          // Backend still expects 'agents' field, not 'agent_configs'
          agents: agents.map(agent => ({
            id: agent.id || `agent-${Date.now()}-${Math.random()}`,
            name: agent.name,
            emoji: agent.emoji || '🤖',
            role: agent.role,
            systemPrompt: agent.systemPrompt || `You are ${agent.name}, a ${agent.role} expert. ${agent.description || ''}`,
            capabilities: agent.capabilities || (agent.skills ? Object.keys(agent.skills) : []),
            skills: agent.skills || {},
            metadata: {
              ...agent.metadata,
              style: agent.style,
              formation: agent.formation,
              description: agent.description
            }
          }))
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(colors.error(`Response status: ${response.status} ${response.statusText}`));
        console.error(colors.error(`Response body: ${errorText}`));
        throw new Error(`Failed to save squad: ${response.statusText}`);
      }
      
      const savedSquad = await response.json() as { id: string; name: string };
      console.log(colors.success('\n✅ Squad saved successfully!'));
      console.log(colors.info(`Squad ID: ${savedSquad.id}`));
      console.log(colors.info(`Squad Name: ${savedSquad.name}`))
      
      // Get the original user message from config
      const configManager = new ConfigManager();
      const lastSquadRecommendation = await configManager.get('lastSquadRecommendation');
      const userMessage = lastSquadRecommendation?.userMessage || 'Build the requested features';
      
      // Squad is now saved only on graphyn.xyz backend
      // No local storage needed
      
      // Generate tasks using Claude
      console.log(colors.info('\n🤖 Generating tasks with Claude...'));
      const { ClaudeTaskGenerator } = await import('../services/claude-task-generator.js');
      const taskGenerator = new ClaudeTaskGenerator();
      
      const generatedTasks = await taskGenerator.generateTasks({
        userQuery: userMessage,
        agents: agents,
        repoContext: await analyzeRepositoryForContext(),
        squadName: savedSquad.name
      });
      
      // Launch task review
      const tasks = await launchTaskReview({
        tasks: generatedTasks,
        agents: agents,
        squadId: savedSquad.id,
        userQuery: userMessage
      });
      
      if (tasks && tasks.length > 0) {
        console.log(colors.success('\n✅ Tasks approved!'));
        console.log(colors.info(`Total tasks: ${tasks.length}`));
        
        // Launch new Squad Executor interface
        console.log(colors.info('\n🚀 Launching Squad Executor...'));
        const { SquadExecutor } = await import('../components/SquadExecutor.js');
        
        const repoContext = await analyzeRepositoryForContext();
        
        const squadData = {
          id: savedSquad.id,
          name: savedSquad.name,
          description: squadInfo.description,
          agents: agents,
          created_at: new Date().toISOString(),
          workspace: process.cwd()
        };
        
        // Launch the UI and wait for completion
        await new Promise<void>((resolve) => {
          const { unmount } = render(
            React.createElement(SquadExecutor, {
              tasks,
              agents,
              squad: squadData,
              repoContext,
              workDir: process.cwd(),
              claudePath: process.env.CLAUDE_PATH || 'claude',
              onComplete: () => {
                unmount();
                resolve();
              }
            })
          );
        });
        
        console.log(colors.success('\n✨ Squad session completed!'));
        console.log(colors.info('Your AI development team has finished working on the tasks.'));
      } else {
        console.log(colors.warning('\n⚠️  Task generation was cancelled'));
      }
      
    } catch (error) {
      console.error(colors.error('\n❌ Failed to save squad:'), error);
    }
  }
}

async function launchSquadNaming(agents: any[]) {
  const { SquadNaming } = await import('../components/SquadNaming.js');
  
  return new Promise<{ name: string; description?: string } | null>((resolve) => {
    const { unmount } = render(
      React.createElement(SquadNaming, {
        agents,
        onSquadNamed: (name, description) => {
          unmount();
          resolve({ name, description });
        },
        onCancel: () => {
          console.log(colors.info('\n👋 Squad naming cancelled'));
          unmount();
          resolve(null);
        }
      })
    );
  });
}

async function launchTaskReview(params: {
  tasks: any[];
  agents: any[];
  squadId: string;
  userQuery: string;
}) {
  const { TaskReview } = await import('../ink/components/TaskReview.js');
  
  return new Promise<any[] | null>((resolve) => {
    const { unmount } = render(
      React.createElement(TaskReview, {
        tasks: params.tasks,
        agents: params.agents,
        onApprove: (approvedTasks) => {
          unmount();
          resolve(approvedTasks);
        },
        onRegenerate: async () => {
          unmount();
          // Regenerate tasks
          console.log(colors.info('\n🔄 Regenerating tasks...'));
          const { ClaudeTaskGenerator } = await import('../services/claude-task-generator.js');
          const taskGenerator = new ClaudeTaskGenerator();
          
          const newTasks = await taskGenerator.generateTasks({
            userQuery: params.userQuery,
            agents: params.agents,
            repoContext: await analyzeRepositoryForContext(),
            squadName: params.squadId
          });
          
          // Re-launch review with new tasks
          const reviewedTasks = await launchTaskReview({
            ...params,
            tasks: newTasks
          });
          resolve(reviewedTasks);
        },
        onCancel: () => {
          console.log(colors.info('\n👋 Task generation cancelled'));
          unmount();
          resolve(null);
        }
      })
    );
  });
}

async function analyzeRepositoryForContext() {
  // Get cached analysis or build new context
  const cachedAnalysis = await getCachedAnalysis();
  if (cachedAnalysis) {
    return cachedAnalysis.context;
  }
  
  // Build context using the modular system
  const contextBuilder = contextBuilders.basic;
  return await contextBuilder(process.cwd());
}

async function selectExistingSquad(token: string, apiUrl: string): Promise<any | null> {
  const { SquadSelector } = await import('../components/SquadSelector.js');
  const { SquadEditor } = await import('../components/SquadEditor.js');
  
  const selectSquad = (): Promise<any | null> => {
    return new Promise<any | null>((resolve) => {
      const { unmount } = render(
        React.createElement(SquadSelector, {
          token,
          apiUrl,
          onSquadSelected: (squad) => {
            unmount();
            resolve(squad);
          },
          onCreateNew: () => {
            unmount();
            resolve(null); // Continue with new squad creation
          },
          onEditSquad: async (squad) => {
            unmount();
            // Launch squad editor
            const editResult = await editSquad(squad, token, apiUrl);
            if (editResult === 'deleted') {
              // Squad was deleted, show selector again
              console.log(colors.success('\n✅ Squad deleted successfully'));
              const result = await selectSquad();
              resolve(result);
            } else {
              // Back button was pressed, show selector again
              const result = await selectSquad();
              resolve(result);
            }
          },
          onExit: () => {
            console.log(colors.info('\n👋 Squad selection cancelled'));
            unmount();
            process.exit(0);
          }
        })
      );
    });
  };
  
  return selectSquad();
}

async function editSquad(squad: any, token: string, apiUrl: string): Promise<'deleted' | 'back'> {
  const { SquadEditor } = await import('../components/SquadEditor.js');
  
  return new Promise<'deleted' | 'back'>((resolve) => {
    const { unmount } = render(
      React.createElement(SquadEditor, {
        squad,
        token,
        apiUrl,
        onBack: () => {
          unmount();
          resolve('back');
        },
        onDelete: () => {
          unmount();
          resolve('deleted');
        }
      })
    );
  });
}

async function useExistingSquad(squad: any, token: string, userMessage: string) {
  const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  
  try {
    // Squad data is loaded from graphyn.xyz backend
    console.log(colors.info('\n📁 Squad loaded from backend'));
    
    // Normalize agents to ensure they have proper names
    if (squad.agents && Array.isArray(squad.agents)) {
      squad.agents = squad.agents.map((agent: any) => ({
        ...agent,
        name: agent.name || agent.agent_name || 'Unknown Agent',
        emoji: agent.emoji || '🤖',
        id: agent.id || agent.agent_id || `agent-${Date.now()}-${Math.random()}`
      }));
      
      console.log(colors.info(`Squad has ${squad.agents.length} agents: ${squad.agents.map((a: any) => `${a.emoji} ${a.name}`).join(', ')}`));
    }
    
    // Generate tasks using Claude
    console.log(colors.info('\n🤖 Generating tasks with Claude...'));
    const { ClaudeTaskGenerator } = await import('../services/claude-task-generator.js');
    const taskGenerator = new ClaudeTaskGenerator();
    
    const generatedTasks = await taskGenerator.generateTasks({
      userQuery: userMessage,
      agents: squad.agents || [],
      repoContext: await analyzeRepositoryForContext(),
      squadName: squad.name
    });
    
    // Launch task review
    const tasks = await launchTaskReview({
      tasks: generatedTasks,
      agents: squad.agents || [],
      squadId: squad.id,
      userQuery: userMessage
    });
    
    if (tasks && tasks.length > 0) {
      console.log(colors.success('\n✅ Tasks approved!'));
      console.log(colors.info(`Total tasks: ${tasks.length}`));
      
      // Load agent configurations from Graphyn
      console.log(colors.info('\n📥 Loading agent configurations...'));
      const { AgentLoader } = await import('../services/agent-loader.js');
      const agentLoader = new AgentLoader(apiUrl, token);
      
      let agentConfigs;
      try {
        agentConfigs = await agentLoader.loadSquadAgents(squad);
      } catch (error) {
        console.log(colors.warning('⚠️  Failed to load agents from API, using backend configs'));
        // Parse agents if they're stored as JSON strings and transform to AgentConfig
        agentConfigs = (squad.agents || []).map((agent: any) => {
          let parsedAgent = agent;
          if (typeof agent === 'string' && agent.startsWith('{')) {
            try {
              parsedAgent = JSON.parse(agent);
            } catch (e) {
              console.error('Failed to parse agent:', e);
              return null;
            }
          }
          
          // Transform to AgentConfig format
          const systemPrompt = parsedAgent.systemPrompt || parsedAgent.system_prompt || 
            `You are ${parsedAgent.name}, ${parsedAgent.role || 'an AI assistant'}.`;
          
          return {
            id: parsedAgent.id || parsedAgent.agent_id || `agent-${Date.now()}-${Math.random()}`,
            name: parsedAgent.name || 'Unknown Agent',
            role: parsedAgent.role || 'AI Assistant',
            emoji: parsedAgent.emoji || '🤖',
            systemPrompt: systemPrompt,
            capabilities: parsedAgent.capabilities || [],
            skills: parsedAgent.skills || {},
            metadata: parsedAgent.metadata || {}
          };
        }).filter(Boolean);
      }
      
      // Launch new Squad Executor interface
      console.log(colors.info('\n🚀 Launching Squad Executor...'));
      const { SquadExecutor } = await import('../components/SquadExecutor.js');
      
      const repoContext = await analyzeRepositoryForContext();
      
      // Launch the UI and wait for completion
      await new Promise<void>((resolve) => {
        const { unmount } = render(
          React.createElement(SquadExecutor, {
            tasks,
            agents: agentConfigs,
            squad: squad,
            repoContext,
            workDir: process.cwd(),
            claudePath: process.env.CLAUDE_PATH || 'claude',
            onComplete: () => {
              unmount();
              resolve();
            }
          })
        );
      });
      
      // Collect feedback
      console.log(colors.info('\n📝 Collecting feedback...'));
      const feedback = await collectSquadFeedback(tasks);
      
      // Save feedback
      if (feedback) {
        await saveSquadFeedback(squad.id, feedback, token, apiUrl);
      }
      
      console.log(colors.success('\n✨ Squad session completed!'));
    } else {
      console.log(colors.warning('\n⚠️  Task generation was cancelled'));
    }
  } catch (error) {
    console.error(colors.error('\n❌ Failed to use existing squad:'), error);
  }
}

async function collectSquadFeedback(tasks: Task[]): Promise<SquadFeedbackData | null> {
  const { default: SquadFeedback } = await import('../ink/components/SquadFeedback.js');
  
  return new Promise((resolve) => {
    const { unmount } = render(
      React.createElement(SquadFeedback, {
        tasks,
        onSubmit: (feedback) => {
          unmount();
          resolve(feedback);
        },
        onCancel: () => {
          unmount();
          resolve(null);
        }
      })
    );
  });
}

async function saveSquadFeedback(
  squadId: string, 
  feedback: SquadFeedbackData,
  token: string,
  apiUrl: string
): Promise<void> {
  try {
    // Send feedback to API
    try {
      const response = await fetch(`${apiUrl}/api/squads/${squadId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          overall_rating: feedback.overallRating,
          task_ratings: Object.fromEntries(feedback.taskRatings),
          comments: feedback.comments,
          completed_at: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        console.log(colors.success('✓ Feedback sent to server'));
      }
    } catch (error) {
      console.log(colors.warning('⚠️  Failed to send feedback to server (will be saved locally)'));
    }
  } catch (error) {
    console.error(colors.error('Failed to save feedback:'), error);
  }
}