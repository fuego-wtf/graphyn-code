import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { createExampleAgents } from '../services/example-agents.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
};

export async function createExampleAgentsCommand(options: any = {}) {
  try {
    console.log(colors.info('🤖 Creating example agents for your organization...\n'));

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

    console.log(colors.info('📦 Creating the following agents:'));
    console.log(colors.info('   - Backend Auth Specialist'));
    console.log(colors.info('   - Frontend Auth Expert'));
    console.log(colors.info('   - Testing Specialist'));
    console.log(colors.info('   - Security Defender'));
    console.log(colors.info('   - Integration Midfielder'));
    console.log(colors.info('   - Task Coordinator'));
    console.log(colors.info('   - DevOps Engineer'));
    console.log(colors.info('   - Database Architect\n'));

    // Create the agents
    const createdAgents = await createExampleAgents(token);

    if (createdAgents.length > 0) {
      console.log(colors.success(`\n✅ Successfully created ${createdAgents.length} agents!\n`));
      
      console.log(colors.info('Your new agents:'));
      createdAgents.forEach((agent: any) => {
        console.log(colors.highlight(`   - ${agent.name} (ID: ${agent.id})`));
      });
      
      console.log(colors.info('\n🎯 Next steps:'));
      console.log(colors.info('   1. Run "graphyn squad" to get squad recommendations'));
      console.log(colors.info('   2. Visit https://app.graphyn.xyz to manage your agents'));
      console.log(colors.info('   3. Start a conversation with any agent using the API'));
    } else {
      console.log(colors.error('\n❌ Failed to create agents. Please check your authentication and try again.'));
    }

  } catch (error) {
    console.error(colors.error('❌ Failed to create example agents:'), error);
  }
}