import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { GraphynAPIClient } from '../api-client.js';
import { SquadsAPI, AskSquadRequest } from '../api/squads.js';
import { getCachedAnalysis } from './analyze.js';
import { ConfigManager } from '../config-manager.js';
import { buildAskRequest, detectRepository, contextBuilders } from '../services/request-builder.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
};

export async function createSquad(userMessage: string, options: any = {}) {
  const organizationId = options.organizationId;
  
  console.log(chalk.blue('\n🔍 DEBUG: createSquad called'));
  console.log(chalk.gray('User message:'), userMessage);
  console.log(chalk.gray('Organization ID:'), organizationId);
  console.log(chalk.gray('Options:'), JSON.stringify(options, null, 2));
  
  try {
    console.log(colors.info('🤖 Creating your AI development squad...\n'));

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

    // Get configuration
    const configManager = new ConfigManager();
    const currentUser = await configManager.get('auth.user');
    
    if (!organizationId) {
      console.log(colors.error('❌ No organization selected. This should not happen.'));
      return;
    }
    
    // Determine context mode
    const contextMode = options.contextMode || 'basic';
    console.log(chalk.blue('\n🔧 DEBUG: Building context'));
    console.log(chalk.gray('Context mode:'), contextMode);
    
    // Check for cached analysis
    const cachedAnalysis = await getCachedAnalysis();
    let context = options.context;
    
    if (!context && cachedAnalysis) {
      console.log(colors.info('📊 Using cached repository analysis'));
      console.log(chalk.gray('Cached context:'), JSON.stringify(cachedAnalysis.context, null, 2));
      context = cachedAnalysis.context;
    } else if (!context) {
      // Build context using the modular system
      console.log(colors.info('🔍 Analyzing repository...'));
      const contextBuilder = contextBuilders[contextMode];
      context = await contextBuilder(process.cwd());
      console.log(chalk.gray('Built context:'), JSON.stringify(context, null, 2));
    }
    
    // Build the request using the modular system
    console.log(chalk.blue('\n🔨 DEBUG: Detecting repository info'));
    const repoInfo = await detectRepository(process.cwd());
    console.log(chalk.gray('Repository info:'), JSON.stringify(repoInfo, null, 2));
    
    // Build a minimal request - the backend seems to expect minimal parameters
    const request: AskSquadRequest = {
      user_message: userMessage,
      organization_id: organizationId,
    };
    
    console.log(chalk.blue('\n🎯 DEBUG: Building request'));
    console.log(chalk.gray('Base request:'), JSON.stringify(request, null, 2));
    
    // Only add optional fields if they exist
    if (repoInfo.url) {
      request.repo_url = repoInfo.url;
      console.log(chalk.gray('Added repo_url:'), repoInfo.url);
    }
    if (repoInfo.branch) {
      request.repo_branch = repoInfo.branch;
      console.log(chalk.gray('Added repo_branch:'), repoInfo.branch);
    }
    
    // Only add context if it's not empty
    if (context && Object.keys(context).length > 0) {
      request.context = context;
      console.log(chalk.gray('Added context with keys:'), Object.keys(context));
    }

    // Initialize API
    const squadsAPI = new SquadsAPI(token);

    console.log(colors.info('🔄 Analyzing your request...'));
    
    console.log(chalk.blue('\n📤 DEBUG: Final request to be sent'));
    console.log(chalk.gray(JSON.stringify(request, null, 2)));
    
    // Call API
    console.log(chalk.blue('\n🚀 DEBUG: Calling askForSquad API'));
    const response = await squadsAPI.askForSquad(request);
    
    console.log(chalk.green('\n✔️ DEBUG: API call successful'));
    console.log(chalk.gray('Response:'), JSON.stringify(response, null, 2));
    
    // The response contains a squad recommendation (group of agents)
    // This is not persisted as a "current squad" since each request creates a new squad

    // Display results
    displaySquadCreationResponse(response);

    // Save squad info if available
    if (response.squad) {
      await saveSquadInfo(response.squad, userMessage);
    }

  } catch (error) {
    console.log(chalk.red('\n🚨 DEBUG: Error in createSquad'));
    console.log(chalk.red('Error type:'), error?.constructor?.name);
    console.log(chalk.red('Error message:'), error?.message);
    console.log(chalk.red('Error stack:'), error?.stack);
    
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
  console.log(colors.info('   Visit the thread at'), colors.highlight(`https://app.graphyn.xyz/threads/${response.thread_id}`));
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