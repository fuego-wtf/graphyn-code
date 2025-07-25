import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth';
import { TeamsAPI } from '../api/teams';
import { detectClaude } from '../utils/claude-detector';
import { getRepositoryInfo } from '../utils/git';
import inquirer from 'inquirer';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan
};

export async function createSquad(userMessage: string) {
  try {
    console.log(colors.info('🚀 Graphyn Code - AI Development Squad Creator\n'));

    // Check for Claude Code
    console.log(colors.info('Checking for Claude Code...'));
    const hasClaude = await detectClaude();
    if (hasClaude) {
      console.log(colors.success('✓ Claude Code detected'));
    } else {
      console.log(colors.warning('⚠️  Claude Code not detected. For best results, install Claude Code.'));
    }

    // Initialize OAuth manager
    const oauthManager = new OAuthManager();

    // Check if authenticated
    if (!oauthManager.isAuthenticated()) {
      console.log(colors.info('\nConnecting to Graphyn platform...'));
      console.log(colors.info('Opening browser for authentication...'));
      await oauthManager.authenticate();
    }

    // Get valid token
    const token = await oauthManager.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Get teams
    console.log(colors.info('\nFetching your teams...'));
    const teamsAPI = new TeamsAPI(token);
    const teams = await teamsAPI.getTeams();

    if (teams.length === 0) {
      throw new Error('You are not a member of any teams. Please create a team at app.graphyn.xyz');
    }

    // Select team
    let selectedTeam;
    if (teams.length === 1) {
      selectedTeam = teams[0];
      console.log(colors.info(`Using team: ${colors.highlight(selectedTeam.name)}`));
    } else {
      const { teamId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'teamId',
          message: 'Which team is this repository for?',
          choices: teams.map(team => ({
            name: team.name,
            value: team.id
          }))
        }
      ]);
      selectedTeam = teams.find(t => t.id === teamId)!;
    }

    // Get repository context
    console.log(colors.info('\nAnalyzing repository context...'));
    const repoInfo = await getRepositoryInfo();
    
    const context: any = {
      detected_stack: [],
      patterns: []
    };

    if (repoInfo) {
      context.repo_url = repoInfo.url;
      context.repo_branch = repoInfo.branch;
      
      // TODO: Implement stack detection
      // For now, we'll add placeholder detection
      if (repoInfo.hasFile('package.json')) {
        const packageJson = repoInfo.readFile('package.json');
        if (packageJson?.includes('next')) {
          context.detected_stack.push('nextjs');
        }
        if (packageJson?.includes('react')) {
          context.detected_stack.push('react');
        }
        if (packageJson?.includes('typescript')) {
          context.detected_stack.push('typescript');
        }
      }
    }

    // Create the squad
    console.log(colors.info('\nCreating AI development squad...'));
    console.log(colors.info(`Request: "${userMessage}"`));
    
    const result = await teamsAPI.createSquad(
      selectedTeam.id,
      userMessage,
      context
    );

    console.log(colors.success('\n✓ Squad created successfully!'));
    console.log(colors.info(`Thread ID: ${result.thread_id}`));
    console.log(colors.info(`\n${result.message}`));
    
    // TODO: Connect to SSE stream for real-time updates
    console.log(colors.info('\nYour AI development team is now working on your request...'));
    console.log(colors.info(`Stream URL: ${result.stream_url}`));

  } catch (error) {
    console.error(colors.error('\n❌ Failed to create squad:'), error);
    process.exit(1);
  }
}