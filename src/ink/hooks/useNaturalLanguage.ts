import { useState } from 'react';
import { useAPI } from './useAPI.js';
import { AgentType } from '../../constants/agents.js';

interface IntentResponse {
  agent: AgentType;
  context: string;
  confidence: number;
  suggestedQuery?: string;
}

export const useNaturalLanguage = () => {
  const api = useAPI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeIntent = async (naturalQuery: string): Promise<IntentResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      // For local development, you can use:
      // GRAPHYN_API_URL=http://localhost:3000 graphyn "add auth"
      const response = await api.post<IntentResponse>('/api/analyze-intent', {
        query: naturalQuery,
        repository: process.cwd(),
        context: {
          // Add any local context that might help
          currentBranch: await getCurrentGitBranch(),
          hasPackageJson: await fileExists('package.json'),
          hasGoMod: await fileExists('go.mod'),
          hasCargo: await fileExists('Cargo.toml'),
        }
      });

      return response as IntentResponse;
    } catch (err) {
      // Fallback to simple keyword matching if backend is unavailable
      return fallbackIntentDetection(naturalQuery);
    } finally {
      setLoading(false);
    }
  };

  return {
    analyzeIntent,
    loading,
    error
  };
};

// Simple fallback when backend is not available
function fallbackIntentDetection(query: string): IntentResponse {
  const lowerQuery = query.toLowerCase();
  
  // Simple keyword matching
  if (lowerQuery.includes('auth') || lowerQuery.includes('api') || lowerQuery.includes('database')) {
    return { agent: 'backend', context: query, confidence: 0.7 };
  }
  if (lowerQuery.includes('ui') || lowerQuery.includes('component') || lowerQuery.includes('style')) {
    return { agent: 'frontend', context: query, confidence: 0.7 };
  }
  if (lowerQuery.includes('design') || lowerQuery.includes('figma')) {
    return { agent: 'design', context: query, confidence: 0.8 };
  }
  if (lowerQuery.includes('architect') || lowerQuery.includes('structure') || lowerQuery.includes('pattern')) {
    return { agent: 'architect', context: query, confidence: 0.6 };
  }
  
  // Default to backend for general queries
  return { agent: 'backend', context: query, confidence: 0.5 };
}

async function getCurrentGitBranch(): Promise<string | null> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const fs = await import('fs');
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}