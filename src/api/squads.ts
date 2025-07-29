import { config } from '../config.js';
import { withRetry, isRetryableError } from '../utils/retry.js';
import chalk from 'chalk';

// Squad represents a group of AI agents created for a specific project
export interface Squad {
  id: string;
  name: string;
  agents: AgentRecommendation[];
  formation: string;
  reasoning: string;
  organization_id: string;
  created_at?: string;
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
  team_id?: string;
  organization_id?: string;
  context?: {
    detected_stack?: string[];
    patterns?: string[];
    framework?: string;
    language?: string;
  };
}

export interface AskSquadResponse {
  thread_id: string;
  message: string;
  stream_url: string;
  squad?: SquadRecommendation;
}

export class SquadsAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  // Note: Squads are created dynamically per request, not persisted
  // Organizations (workspaces) are fetched via GraphynAPIClient.listOrganizations()

  async askForSquad(request: AskSquadRequest): Promise<AskSquadResponse> {
    return withRetry(async () => {
      // Use the code proxy endpoint for Team Builder
      const apiUrl = config.apiBaseUrl;
      const endpoint = `${apiUrl}/api/code/ask`;
      
      console.log(chalk.blue('\n🔍 DEBUG: askForSquad called'));
      console.log(chalk.gray('Endpoint:'), endpoint);
      console.log(chalk.gray('Request payload:'));
      console.log(chalk.gray(JSON.stringify(request, null, 2)));
      console.log(chalk.gray('Token (first 10 chars):'), this.token?.substring(0, 10) + '...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      console.log(chalk.blue('\n📡 DEBUG: Response received'));
      console.log(chalk.gray('Status:'), response.status);
      console.log(chalk.gray('Headers:'));
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'authorization') {
          console.log(chalk.gray(`  ${key}: ${value}`));
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(chalk.red('\n❌ DEBUG: Request failed'));
        console.log(chalk.red('Error response body:'), errorText);
        
        const error: any = new Error(`Failed to get squad recommendation: ${errorText}`);
        error.status = response.status;
        throw error;
      }

      const responseText = await response.text();
      console.log(chalk.green('\n✅ DEBUG: Success response'));
      console.log(chalk.gray('Response body:'), responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log(chalk.red('Failed to parse response as JSON'));
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      console.log(chalk.green('Parsed response:'));
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
      
      return data as AskSquadResponse;
    }, {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
        console.log(chalk.yellow(`\n⚠️  Retrying squad recommendation (attempt ${attempt}/3)...`));
      }
    });
  }
}