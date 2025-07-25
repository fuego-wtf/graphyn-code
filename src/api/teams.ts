import { config } from '../config';

export interface Team {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string;
}

export class TeamsAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getTeams(): Promise<Team[]> {
    const response = await fetch(`${config.apiBaseUrl}/v1/auth/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.statusText}`);
    }

    const data = await response.json();
    return data.teams || [];
  }

  async createSquad(teamId: string, userMessage: string, context?: any): Promise<any> {
    const response = await fetch(`${config.apiBaseUrl}/api/code/ask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_message: userMessage,
        team_id: teamId,
        context: context || {},
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create squad: ${error}`);
    }

    return response.json();
  }
}