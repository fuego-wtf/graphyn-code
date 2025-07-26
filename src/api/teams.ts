import { config } from '../config.js';
import { withRetry, isRetryableError } from '../utils/retry.js';
import chalk from 'chalk';

export interface Team {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string;
  organization_id?: string;
}

export interface SquadRecommendation {
  agents: AgentRecommendation[];
  reasoning: string;
  formation: string;
}

export interface AgentRecommendation {
  name: string;
  role: string;
  skills: Record<string, number>; // skill name to proficiency (0-10)
  description: string;
  style: string;
  formation: string;
  emoji?: string;
}

export interface AskSquadRequest {
  user_message: string;
  repo_url?: string;
  repo_branch?: string;
  team_id: string;
  context?: {
    detected_stack?: string[];
    patterns?: string[];
    framework?: string;
    language?: string;
  };
}

export interface AskSquadResponse {
  squad: SquadRecommendation;
  message: string;
  adjustable: boolean;
}

export class TeamsAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getTeams(): Promise<Team[]> {
    return withRetry(async () => {
      const response = await fetch(`${config.apiBaseUrl}/v1/auth/teams`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error: any = new Error(`Failed to fetch teams: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data: any = await response.json();
      return data.teams || [];
    }, {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
        console.log(chalk.yellow(`\n⚠️  Retrying teams fetch (attempt ${attempt}/3)...`));
      }
    });
  }

  async askForSquad(request: AskSquadRequest): Promise<AskSquadResponse> {
    return withRetry(async () => {
      const response = await fetch(`${config.apiBaseUrl}/api/code/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error: any = new Error(`Failed to get squad recommendation: ${errorText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      return data as AskSquadResponse;
    }, {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
        console.log(chalk.yellow(`\n⚠️  Retrying squad recommendation (attempt ${attempt}/3)...`));
      }
    });
  }
}