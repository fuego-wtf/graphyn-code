import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { ConfigManager } from '../config-manager.js';
import { GraphynAPIClient } from '../api-client.js';
import { switchOrganization } from '../utils/squad-selection.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

export async function switchSquad() {
  try {
    // Initialize OAuth manager
    const oauthManager = new OAuthManager();

    // Check if authenticated
    if (!(await oauthManager.isAuthenticated())) {
      console.log(colors.error('❌ Not authenticated. Please run "graphyn auth" first.'));
      return;
    }

    // Get valid token
    const token = await oauthManager.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Switch organization (squads are agent groups, not workspaces)
    const selectedOrg = await switchOrganization(token);
    console.log(colors.success(`\n✓ Switched to organization: ${colors.highlight(selectedOrg.name)}`));
    console.log(colors.info('\nNote: Squads are AI agent groups created for each project.'));
    
  } catch (error) {
    console.error(colors.error('Failed to switch organization:'), error instanceof Error ? error.message : error);
  }
}

export async function showCurrentSquad() {
  try {
    const configManager = new ConfigManager();
    const currentOrg = await configManager.get('currentOrganization');
    
    if (!currentOrg) {
      console.log(colors.info('No organization currently selected.'));
      console.log(colors.info('Run "graphyn squad switch" to select an organization.'));
      return;
    }

    console.log(colors.success(`Current organization: ${currentOrg.name}`));
    console.log(colors.info('\nNote: Squads are AI agent groups created for each project request.'));
    
  } catch (error) {
    console.error(colors.error('Failed to get current organization:'), error);
  }
}

export async function clearSquadSelection() {
  try {
    const configManager = new ConfigManager();
    await configManager.delete('currentOrganization');
    
    console.log(colors.success('✓ Organization selection cleared'));
    
  } catch (error) {
    console.error(colors.error('Failed to clear organization selection:'), error);
  }
}