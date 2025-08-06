import chalk from 'chalk';
import inquirer from 'inquirer';
import { GraphynAPIClient, Organization } from '../api-client.js';
import { ConfigManager } from '../config-manager.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold
};

export interface SelectedOrganization {
  id: string;
  name: string;
  slug: string;
}

/**
 * Prompts user to select an organization
 */
export async function promptOrganizationSelection(organizations: Organization[]): Promise<Organization> {
  if (organizations.length === 0) {
    throw new Error('No organizations available');
  }

  if (organizations.length === 1) {
    console.log(colors.info(`\n✓ Auto-selected organization: ${colors.highlight(organizations[0].name)}\n`));
    return organizations[0];
  }

  console.log(colors.bold('\n🏢 Select your organization:\n'));

  const choices = organizations.map(org => ({
    name: org.name,
    value: org.id,
    short: org.name
  }));

  const { orgId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'orgId',
      message: 'Select organization:',
      choices,
      pageSize: 10
    }
  ]);

  const selectedOrg = organizations.find(o => o.id === orgId);
  if (!selectedOrg) {
    throw new Error('Invalid organization selection');
  }

  return selectedOrg;
}

/**
 * Ensures an organization is selected for the current operation
 */
export async function ensureOrganizationSelected(token: string): Promise<SelectedOrganization> {
  const configManager = new ConfigManager();
  
  // Check if we already have an organization selected
  const currentOrg = await configManager.get('currentOrganization');
  if (currentOrg?.id) {
    // Automatically use the current organization without prompting
    console.log(colors.info(`\n✓ Organization selected: ${colors.highlight(currentOrg.name)}\n`));
    return currentOrg;
  }

  // Fetch available organizations
  console.log(colors.info('\n🔄 Fetching your organizations...'));
  
  const apiClient = new GraphynAPIClient({ baseURL: process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz' });
  apiClient.setToken(token);
  
  const organizations = await apiClient.listOrganizations();
  
  if (organizations.length === 0) {
    throw new Error('No organizations found. Please create an organization at https://app.graphyn.xyz');
  }

  // If only one organization, automatically select it
  if (organizations.length === 1) {
    const selectedOrg = organizations[0];
    const orgData: SelectedOrganization = {
      id: selectedOrg.id,
      name: selectedOrg.name,
      slug: selectedOrg.slug
    };
    
    await configManager.set('currentOrganization', orgData);
    console.log(colors.success(`\n✓ Organization selected: ${colors.highlight(selectedOrg.name)}\n`));
    
    return orgData;
  }

  // Multiple organizations - prompt for selection
  const selectedOrg = await promptOrganizationSelection(organizations);
  
  // Save selection
  const orgData: SelectedOrganization = {
    id: selectedOrg.id,
    name: selectedOrg.name,
    slug: selectedOrg.slug
  };
  
  await configManager.set('currentOrganization', orgData);
  console.log(colors.success(`\n✓ Organization selected: ${colors.highlight(selectedOrg.name)}\n`));
  
  return orgData;
}

/**
 * Switches to a different organization
 */
export async function switchOrganization(token: string): Promise<SelectedOrganization> {
  const configManager = new ConfigManager();
  
  // Clear current selection to force re-selection
  await configManager.delete('currentOrganization');
  
  // Use the same flow as ensure organization selected
  return ensureOrganizationSelected(token);
}