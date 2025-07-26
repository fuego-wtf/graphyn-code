import chalk from 'chalk';
import { OAuthManager } from '../auth/oauth.js';
import { TeamsAPI, AskSquadRequest } from '../api/teams.js';
import { detectClaude } from '../utils/claude-detector.js';
import { getRepositoryInfo } from '../utils/git.js';
import { SSEClient } from '../utils/sse-client.js';
import { detectTechStack } from '../context/index.js';
import inquirer from 'inquirer';
import path from 'path';
import { config } from '../config.js';

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
    if (!(await oauthManager.isAuthenticated())) {
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
      throw new Error('You are not a member of any teams. Please create a team at localhost:3000');
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
    
    let context: any = {
      detected_stack: [],
      patterns: []
    };

    if (repoInfo) {
      context.repo_url = repoInfo.url;
      context.repo_branch = repoInfo.branch;
      
      // Use enhanced context detection
      const techStack = await detectTechStack(process.cwd());
      context = {
        ...context,
        ...techStack
      };
      
      // Display detected stack
      if (context.detected_stack.length > 0) {
        console.log(colors.success('✓ Detected technologies:'));
        context.detected_stack.forEach((tech: string) => {
          console.log(colors.info(`  • ${tech}`));
        });
      }
      
      if (context.databases && context.databases.length > 0) {
        console.log(colors.info(`\n  Databases: ${context.databases.join(', ')}`));
      }
      
      if (context.authentication && context.authentication.length > 0) {
        console.log(colors.info(`  Authentication: ${context.authentication.join(', ')}`));
      }
    }

    // Ask for squad recommendation
    console.log(colors.info('\nAnalyzing your request...'));
    console.log(colors.info(`Request: "${userMessage}"`));
    
    const squadRequest: AskSquadRequest = {
      user_message: userMessage,
      team_id: selectedTeam.id,
      repo_url: context.repo_url,
      repo_branch: context.repo_branch,
      context: {
        detected_stack: context.detected_stack || [],
        patterns: context.patterns || [],
        framework: context.framework,
        language: context.primaryLanguage
      }
    };
    
    const squadResponse = await teamsAPI.askForSquad(squadRequest);
    
    // Display squad recommendation
    console.log(colors.success('\n✓ I\'ve analyzed your repository. Here\'s your recommended dev squad:\n'));
    
    // Football Manager style presentation
    console.log(chalk.cyan('┌─────────────────────── Your Dev Squad for ' + userMessage.substring(0, 30) + '... ───────────────────────┐'));
    console.log(chalk.cyan('│                                                                                  │'));
    
    squadResponse.squad.agents.forEach((agent, index) => {
      const emoji = agent.emoji || ['⚡', '🎨', '🧪', '🔒', '🔌', '📋'][index] || '👨‍💻';
      console.log(chalk.cyan('│  ') + chalk.yellow.bold(`${emoji} ${agent.name} (${agent.formation})`.padEnd(78)) + chalk.cyan(' │'));
      
      // Skills bar
      const skillsText = Object.entries(agent.skills)
        .slice(0, 3)
        .map(([skill, level]) => {
          const filled = '█'.repeat(Math.floor(level));
          const empty = '░'.repeat(10 - Math.floor(level));
          return `${skill} ${filled}${empty}`;
        })
        .join(' | ');
      console.log(chalk.cyan('│     ') + colors.info('Skills: ' + skillsText.padEnd(72)) + chalk.cyan(' │'));
      
      console.log(chalk.cyan('│     ') + colors.info('Role: ' + agent.role.substring(0, 72).padEnd(74)) + chalk.cyan(' │'));
      console.log(chalk.cyan('│     ') + colors.info('Style: ' + agent.style.substring(0, 71).padEnd(73)) + chalk.cyan(' │'));
      
      if (index < squadResponse.squad.agents.length - 1) {
        console.log(chalk.cyan('│                                                                                  │'));
      }
    });
    
    console.log(chalk.cyan('└──────────────────────────────────────────────────────────────────────────────────┘'));
    
    console.log(`\n${squadResponse.message}`);
    
    // Ask if user wants to adjust the squad
    if (squadResponse.adjustable) {
      const { adjustSquad } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'adjustSquad',
          message: 'Would you like to adjust the squad composition?',
          default: false
        }
      ]);
      
      if (adjustSquad) {
        const { adjustment } = await inquirer.prompt([
          {
            type: 'input',
            name: 'adjustment',
            message: 'What would you like to change? (e.g., "Add a DevOps specialist", "Remove testing agent")'
          }
        ]);
        
        // Make another request with the adjustment
        const adjustedRequest = {
          ...squadRequest,
          user_message: `${userMessage}. ${adjustment}`
        };
        
        console.log(colors.info('\nAdjusting squad...'));
        const adjustedResponse = await teamsAPI.askForSquad(adjustedRequest);
        
        // Display adjusted squad (simplified)
        console.log(colors.success('\n✓ Squad adjusted:\n'));
        adjustedResponse.squad.agents.forEach(agent => {
          console.log(colors.highlight(`• ${agent.emoji || '👨‍💻'} ${agent.name} - ${agent.role}`));
        });
      }
    }
    
    console.log(colors.success('\n✓ Squad recommendation complete!'));
    console.log(colors.info('\nNext steps:'));
    console.log(colors.info('1. Launch Claude Code with your squad context'));
    console.log(colors.info('2. Start implementing with your AI dev team'));
    console.log(colors.info('3. Each agent will help with their specialized area'));

  } catch (error: any) {
    console.error(colors.error('\n❌ Failed to create squad:'));
    
    // Provide helpful error messages
    if (error.message?.includes('authentication')) {
      console.error(colors.error('Authentication failed. Please run `graphyn auth` to login again.'));
    } else if (error.message?.includes('teams')) {
      console.error(colors.error('Unable to fetch teams. Please check your internet connection.'));
    } else if (error.message?.includes('network')) {
      console.error(colors.error('Network error. Please check your internet connection and try again.'));
    } else {
      console.error(colors.error(error.message || 'An unknown error occurred'));
    }
    
    // Show debug info if verbose
    if (process.env.DEBUG) {
      console.error(colors.info('\nDebug info:'), error);
    }
    
    process.exit(1);
  }
}