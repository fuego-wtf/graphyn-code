export type QueryIntent = 'orchestrate' | 'help' | 'version' | 'unknown';

export interface QueryClassification {
  intent: QueryIntent;
  query: string;
  raw: string;
}

const HELP_KEYWORDS = new Set(['help', '--help', '-h']);
const VERSION_KEYWORDS = new Set(['--version', '-v', 'version']);

export function classifyQuery(raw: string): QueryClassification {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { intent: 'unknown', query: trimmed, raw };
  }

  const normalized = trimmed.toLowerCase();

  if (HELP_KEYWORDS.has(normalized)) {
    return { intent: 'help', query: '', raw };
  }

  if (VERSION_KEYWORDS.has(normalized)) {
    return { intent: 'version', query: '', raw };
  }

  return {
    intent: 'orchestrate',
    query: trimmed,
    raw,
  };
}
