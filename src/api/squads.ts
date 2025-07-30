import { config } from '../config.js';
import { withRetry, isRetryableError } from '../utils/retry.js';
import chalk from 'chalk';
import { debug, debugError, debugSuccess } from '../utils/debug.js';

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
  team_id?: string;
  context?: {
    detected_stack?: string[];
    patterns?: string[];
    framework?: string;
    language?: string;
    dependencies?: Record<string, string>;
    structure?: {
      hasTests?: boolean;
      hasCI?: boolean;
      hasDocs?: boolean;
    };
  };
  repo_url?: string;
  repo_branch?: string;
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
      
      debug('🔍 askForSquad called');
      debug('Endpoint:', endpoint);
      debug('Request payload:');
      debug(JSON.stringify(request, null, 2));
      debug('Token (first 10 chars):', this.token?.substring(0, 10) + '...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      debug('📡 Response received');
      debug('Status:', response.status);
      debug('Headers:');
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'authorization') {
          debug(`  ${key}: ${value}`);
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        debugError('❌ Request failed');
        debugError('Error response body:', errorText);
        
        const error: any = new Error(`Failed to get squad recommendation: ${errorText}`);
        error.status = response.status;
        throw error;
      }

      const responseText = await response.text();
      debugSuccess('✅ Success response');
      debug('Response body:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        debugError('Failed to parse response as JSON');
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      debugSuccess('Parsed response:');
      debug(JSON.stringify(data, null, 2));
      
      return data as AskSquadResponse;
    }, {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
        console.log(chalk.yellow(`\n⚠️  Retrying squad recommendation (attempt ${attempt}/3)...`));
      }
    });
  }
}