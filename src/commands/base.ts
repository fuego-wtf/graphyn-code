import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

type ProviderPreference = 'claude_code' | 'codex' | 'gemini';
type SessionMode = 'ask' | 'plan-first' | 'code';

type BaseErrorCode =
  | 'AUTH_FILE_MISSING'
  | 'AUTH_FILE_UNREADABLE'
  | 'AUTH_JSON_INVALID'
  | 'AUTH_SCHEMA_INVALID'
  | 'AUTH_INVALID'
  | 'BASE_BINARY_NOT_FOUND'
  | 'BASE_QUERY_FAILED'
  | 'INVALID_INPUT';

interface BaseFailureEnvelope {
  ok: false;
  stage: 'base';
  error: {
    code: BaseErrorCode;
    message: string;
    actionable: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

interface BaseDocResult {
  path: string;
  snippet: string;
  score: number;
  doc_type: string;
  last_modified: string | null;
}

interface BaseAgentResult {
  id: string;
  specialty: string;
  system_prompt: string;
  provider_preference: ProviderPreference;
  session_mode: SessionMode;
  relevance_score: number;
}

interface BaseSuccessEnvelope {
  query: string;
  org: string;
  took_ms: number;
  docs: BaseDocResult[];
  agents: BaseAgentResult[];
  agent_threshold_met: boolean;
  suggest_create: boolean;
  suggested_name?: string;
  create_hint?: string;
}

interface BaseAuthUser {
  email?: string;
  name?: string;
  orgID?: string;
  userID?: string;
}

interface BaseAuthData {
  valid: boolean;
  apiKey: string;
  authenticatedAt?: string;
  user?: BaseAuthUser | null;
}

interface RawSearchResult {
  document?: {
    title?: string;
    content?: string;
    doc_type?: string;
    metadata?: unknown;
    updated_at?: string;
    created_at?: string;
  };
  score?: number;
}

interface RawAgentSearchResult {
  agent?: {
    id?: string;
    name?: string;
    description?: string;
    system_prompt?: string;
    model?: string | null;
  };
  score?: number;
}

interface ParsedBaseInput {
  help: boolean;
  task: string;
  docsOnly: boolean;
  agentsOnly: boolean;
  docsLimit: number;
  agentsLimit: number;
  threshold: number;
}

const DEFAULT_DOC_LIMIT = 20;
const DEFAULT_AGENT_LIMIT = 10;
const MAX_AGENT_RESULTS = 3;
const DEFAULT_AGENT_THRESHOLD = 0.7;

const ERROR_DETAILS: Record<BaseErrorCode, { message: string; actionable: string }> = {
  AUTH_FILE_MISSING: {
    message: 'Authentication file not found.',
    actionable: 'Authenticate first so ~/.graphyn/auth.json exists, then retry.',
  },
  AUTH_FILE_UNREADABLE: {
    message: 'Authentication file could not be read.',
    actionable: 'Check filesystem permissions for ~/.graphyn/auth.json and retry.',
  },
  AUTH_JSON_INVALID: {
    message: 'Authentication file contains invalid JSON.',
    actionable: 'Fix or recreate ~/.graphyn/auth.json and retry.',
  },
  AUTH_SCHEMA_INVALID: {
    message: 'Authentication file does not match expected schema.',
    actionable: 'Refresh authentication and retry.',
  },
  AUTH_INVALID: {
    message: 'Authentication data is invalid.',
    actionable: 'Run authentication flow and retry.',
  },
  BASE_BINARY_NOT_FOUND: {
    message: 'Graphyn base binary could not be resolved.',
    actionable:
      'Set GRAPHYN_BASE_BIN or install/build packages/base so graphyn-base (or graphyn-kb) is available.',
  },
  BASE_QUERY_FAILED: {
    message: 'Base retrieval command failed.',
    actionable: 'Validate graphyn-base runtime health and retry.',
  },
  INVALID_INPUT: {
    message: 'Invalid base command input.',
    actionable: 'Run `graphyn base --help` and retry with a valid task.',
  },
};

function createFailure(
  code: BaseErrorCode,
  details?: Record<string, unknown>,
): BaseFailureEnvelope {
  const detail = ERROR_DETAILS[code];
  return {
    ok: false,
    stage: 'base',
    error: {
      code,
      message: detail.message,
      actionable: detail.actionable,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };
}

function emitFailure(code: BaseErrorCode, details?: Record<string, unknown>): void {
  console.log(JSON.stringify(createFailure(code, details), null, 2));
}

function toTokenList(rawQuery: string): string[] {
  return rawQuery
    .trim()
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function parseThreshold(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}

function parseBaseInput(rawQuery: string): ParsedBaseInput | null {
  const tokens = toTokenList(rawQuery);
  if (tokens.length === 0 || tokens[0] !== 'base') {
    return null;
  }

  let help = false;
  let docsOnly = false;
  let agentsOnly = false;
  let docsLimit = DEFAULT_DOC_LIMIT;
  let agentsLimit = DEFAULT_AGENT_LIMIT;
  let threshold = DEFAULT_AGENT_THRESHOLD;

  const taskParts: string[] = [];
  let index = 1;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === '--') {
      taskParts.push(...tokens.slice(index + 1));
      break;
    }

    if (token === '--help' || token === '-h') {
      help = true;
      index += 1;
      continue;
    }

    if (token === '--docs-only') {
      docsOnly = true;
      index += 1;
      continue;
    }

    if (token === '--agents-only') {
      agentsOnly = true;
      index += 1;
      continue;
    }

    if (token === '--docs-limit') {
      const parsed = parsePositiveInteger(tokens[index + 1]);
      if (parsed === null) return null;
      docsLimit = parsed;
      index += 2;
      continue;
    }

    if (token === '--agents-limit') {
      const parsed = parsePositiveInteger(tokens[index + 1]);
      if (parsed === null) return null;
      agentsLimit = parsed;
      index += 2;
      continue;
    }

    if (token === '--threshold') {
      const parsed = parseThreshold(tokens[index + 1]);
      if (parsed === null) return null;
      threshold = parsed;
      index += 2;
      continue;
    }

    if (token.startsWith('--')) {
      return null;
    }

    taskParts.push(token);
    index += 1;
  }

  if (docsOnly && agentsOnly) {
    return null;
  }

  return {
    help,
    task: taskParts.join(' ').trim(),
    docsOnly,
    agentsOnly,
    docsLimit,
    agentsLimit,
    threshold,
  };
}

function showBaseHelp(): void {
  console.log(`Usage:
  graphyn base [options] "<task>"

Options:
  --docs-only          Return docs only
  --agents-only        Return agents only
  --docs-limit <n>     Docs limit (default: ${DEFAULT_DOC_LIMIT})
  --agents-limit <n>   Agent candidate limit before top-3 trim (default: ${DEFAULT_AGENT_LIMIT})
  --threshold <0..1>   Agent threshold (default: ${DEFAULT_AGENT_THRESHOLD})
  --help, -h           Show this help
`);
}

function readAuthFileStrict(): BaseAuthData | BaseFailureEnvelope {
  const authPath = path.join(os.homedir(), '.graphyn', 'auth.json');

  if (!fs.existsSync(authPath)) {
    return createFailure('AUTH_FILE_MISSING', { path: authPath });
  }

  let raw: string;
  try {
    raw = fs.readFileSync(authPath, 'utf8');
  } catch (error) {
    return createFailure('AUTH_FILE_UNREADABLE', {
      path: authPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return createFailure('AUTH_JSON_INVALID', {
      path: authPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return createFailure('AUTH_SCHEMA_INVALID', { path: authPath });
  }

  const auth = parsed as Partial<BaseAuthData>;
  if (auth.valid !== true || typeof auth.apiKey !== 'string' || auth.apiKey.trim().length === 0) {
    return createFailure('AUTH_INVALID', { path: authPath });
  }

  if (auth.user !== undefined && auth.user !== null && typeof auth.user !== 'object') {
    return createFailure('AUTH_SCHEMA_INVALID', { path: authPath, field: 'user' });
  }

  return {
    valid: true,
    apiKey: auth.apiKey,
    authenticatedAt: auth.authenticatedAt,
    user: (auth.user as BaseAuthUser | null | undefined) ?? null,
  };
}

function resolveOrg(auth: BaseAuthData): string {
  const envOrg = process.env.GRAPHYN_ORG?.trim();
  if (envOrg) return envOrg;

  const orgId = auth.user?.orgID?.trim();
  if (orgId) return orgId;

  return 'unknown';
}

function isExecutablePath(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return false;
    if (process.platform === 'win32') return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseBinary(): string | null {
  const executableName = process.platform === 'win32' ? 'graphyn.exe' : 'graphyn';
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const envBinary = process.env.GRAPHYN_BASE_BIN?.trim();

  const absoluteCandidates: string[] = [];
  const commandCandidates: string[] = ['graphyn-base', 'graphyn-kb'];

  if (envBinary) {
    if (path.isAbsolute(envBinary)) {
      absoluteCandidates.push(envBinary);
    } else {
      commandCandidates.unshift(envBinary);
    }
  }

  absoluteCandidates.push(path.join(os.homedir(), '.graphyn', 'bin', 'graphyn-base'));
  absoluteCandidates.push(path.join(os.homedir(), '.graphyn', 'bin', 'graphyn-kb'));
  absoluteCandidates.push(path.join(os.homedir(), '.cargo', 'bin', 'graphyn-base'));
  absoluteCandidates.push(path.join(repoRoot, 'packages', 'base', 'target', 'release', executableName));
  absoluteCandidates.push(path.join(repoRoot, 'packages', 'base', 'target', 'debug', executableName));

  for (const candidate of absoluteCandidates) {
    if (isExecutablePath(candidate)) {
      return candidate;
    }
  }

  return commandCandidates[0] ?? null;
}

function executeJsonCommand(binary: string, args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      reject(error);
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(
          new Error(
            `Command failed (${code}): ${stderr.trim() || stdout.trim() || 'no output'}`,
          ),
        );
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(new Error('Command returned empty stdout.'));
        return;
      }

      try {
        resolve(JSON.parse(trimmed));
      } catch (error) {
        reject(
          new Error(
            `Invalid JSON output: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  });
}

function toNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeSnippet(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 280);
}

function resolveDocPath(raw: RawSearchResult): string {
  const metadata = raw.document?.metadata;
  if (metadata && typeof metadata === 'object' && metadata !== null) {
    const meta = metadata as Record<string, unknown>;
    const candidates = ['path', 'file_path', 'source_path', 'source'] as const;
    for (const key of candidates) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
  }
  return raw.document?.title ?? '';
}

function normalizeProvider(model: string | null | undefined): ProviderPreference {
  const normalized = (model ?? '').toLowerCase();
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('claude')) return 'claude_code';
  return 'codex';
}

function mapDocs(raw: unknown): BaseDocResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => item as RawSearchResult)
    .map(item => ({
      path: resolveDocPath(item),
      snippet: normalizeSnippet(toStringValue(item.document?.content)),
      score: toNumber(item.score),
      doc_type: toStringValue(item.document?.doc_type, 'other'),
      last_modified: item.document?.updated_at ?? item.document?.created_at ?? null,
    }))
    .filter(item => item.path.length > 0 || item.snippet.length > 0);
}

function mapAgents(raw: unknown): BaseAgentResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => item as RawAgentSearchResult)
    .map(item => {
      const name = toStringValue(item.agent?.name, 'unknown');
      const specialty = toStringValue(item.agent?.description, name);
      return {
        id: toStringValue(item.agent?.id, name),
        specialty,
        system_prompt: toStringValue(item.agent?.system_prompt),
        provider_preference: normalizeProvider(item.agent?.model),
        session_mode: 'ask' as SessionMode,
        relevance_score: toNumber(item.score),
      };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, MAX_AGENT_RESULTS);
}

function toSuggestedName(task: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (!slug) return 'new-specialist';
  return slug.slice(0, 64);
}

export async function runBaseCommand(rawQuery: string): Promise<void> {
  const parsed = parseBaseInput(rawQuery);
  if (!parsed) {
    emitFailure('INVALID_INPUT', { rawQuery });
    process.exitCode = 1;
    return;
  }

  if (parsed.help) {
    showBaseHelp();
    return;
  }

  if (!parsed.task) {
    emitFailure('INVALID_INPUT', { reason: 'Missing task query.' });
    process.exitCode = 1;
    return;
  }

  const authResult = readAuthFileStrict();
  if ('ok' in authResult) {
    console.log(JSON.stringify(authResult, null, 2));
    process.exitCode = 1;
    return;
  }
  const auth = authResult;

  const binary = resolveBaseBinary();
  if (!binary) {
    emitFailure('BASE_BINARY_NOT_FOUND');
    process.exitCode = 1;
    return;
  }

  const start = performance.now();

  try {
    const docsPromise = parsed.agentsOnly
      ? Promise.resolve([])
      : executeJsonCommand(binary, [
          'search',
          parsed.task,
          '--limit',
          String(parsed.docsLimit),
          '--json',
        ]);

    const agentsPromise = parsed.docsOnly
      ? Promise.resolve([])
      : executeJsonCommand(binary, [
          'search-agents',
          parsed.task,
          '--limit',
          String(parsed.agentsLimit),
          '--json',
        ]);

    const [docsRaw, agentsRaw] = await Promise.all([docsPromise, agentsPromise]);
    const docs = mapDocs(docsRaw);
    const agents = mapAgents(agentsRaw);

    const thresholdMet =
      !parsed.docsOnly &&
      agents.length > 0 &&
      agents[0] !== undefined &&
      agents[0].relevance_score >= parsed.threshold;

    const suggestCreate = !parsed.docsOnly && !thresholdMet;

    const envelope: BaseSuccessEnvelope = {
      query: parsed.task,
      org: resolveOrg(auth),
      took_ms: Math.round(performance.now() - start),
      docs,
      agents,
      agent_threshold_met: thresholdMet,
      suggest_create: suggestCreate,
    };

    if (suggestCreate) {
      envelope.suggested_name = toSuggestedName(parsed.task);
      envelope.create_hint =
        "No specialist above threshold. Create one via Graphyn Desktop's System Designer mode, or author a .af file directly.";
    }

    console.log(JSON.stringify(envelope, null, 2));
  } catch (error) {
    emitFailure('BASE_QUERY_FAILED', {
      reason: error instanceof Error ? error.message : String(error),
      binary,
    });
    process.exitCode = 1;
  }
}
