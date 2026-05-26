/**
 * Cross-harness consult — the agent-to-agent (A2A) junction leaf.
 *
 * This is the "graphyn CLI as junction" path: a caller (Claude, or any agent /
 * human via `@code`) asks `graphyn consult --to <harness> "question"`, and the
 * junction routes the question to an external coding-agent harness (Gemini in
 * V1), enforces a read-only/advisory posture, normalizes the answer, and returns
 * a receipt.
 *
 * Distinct from `commands/consult.ts`, which is the `.af`<->`.af` Desktop-ACP
 * relay (machine-tag based, RUNTIME_REQUIRED in CLI-only mode). This file is
 * harness<->harness and runs entirely from the CLI.
 *
 * Design ref: docs/desktop/research/w273-research-cli-a2a-harness-junction/
 *   99-synthesis-and-design.md (HarnessAdapter behind CapabilityRouter).
 *
 * V1 scope: Gemini + Codex leaves, read-only one-shot subprocess (Tier 1, proven live).
 * Fast-follow: Claude leaf, then Tier 2 ACP-over-stdio. See §8 of the synthesis doc.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { applyConsultTransformPolicy, redactSecrets, type TransformReceipt } from './transform-policy.js';

// Re-export so any existing callers that import redactSecrets from this file keep working.
// (Canonical implementation now lives in transform-policy.ts.)
export { redactSecrets } from './transform-policy.js';

export type HarnessId = 'gemini' | 'codex' | 'claude';

/** Harnesses with a wired adapter in this build. */
export const SUPPORTED_HARNESSES: readonly HarnessId[] = ['gemini', 'codex'];

export interface HarnessConsultRequest {
  /** Who is asking. Defaults to 'claude' (the most common caller via @code). */
  fromHarness?: string;
  /** Which harness answers. */
  toHarness: HarnessId;
  /** The question to forward. */
  question: string;
  /** Optional model override passed to the leaf harness. */
  model?: string;
  /** Read-only/advisory posture. Defaults true; a consult must never mutate. */
  readOnly?: boolean;
  /** Hard timeout for the leaf process. Defaults to 120s. */
  timeoutMs?: number;
}

export interface HarnessConsultReceipt {
  /** Deterministic transform-policy receipt (stage chain + SHA-256 hashes). */
  transform: TransformReceipt;
  /** True when secrets were detected and stripped from the question. */
  redacted: boolean;
  /** True when the junction confirmed the leaf made no filesystem writes. */
  readOnlyEnforced: boolean;
  /** Exact argv the junction handed to the leaf (for audit). */
  invocationArgv: string[];
  /** Recursion depth at which this junction was invoked (G3 audit). */
  junctionDepth: number;
  /** Trace id propagated across the full agent-calling-agent chain (G3 audit). */
  junctionTraceId: string;
  /** Number of env keys stripped from the leaf environment (G2 audit). */
  strippedEnvKeyCount: number;
}

export interface HarnessConsultSuccess {
  ok: true;
  fromHarness: string;
  toHarness: HarnessId;
  /** Model the leaf reported answering with, when available. */
  answeredByModel?: string;
  response: string;
  durationMs: number;
  receipt: HarnessConsultReceipt;
}

export type HarnessConsultErrorCode =
  | 'BAD_REQUEST'
  | 'HARNESS_NOT_WIRED'
  | 'HARNESS_UNAVAILABLE'
  | 'HARNESS_TIMEOUT'
  | 'HARNESS_FAILED'
  | 'HARNESS_UNPARSEABLE'
  | 'HARNESS_UNSAFE_OUTPUT'
  | 'JUNCTION_DEPTH_EXCEEDED';

export interface HarnessConsultFailure {
  ok: false;
  toHarness: HarnessId | string;
  errorCode: HarnessConsultErrorCode;
  error: string;
  actionable: string;
}

export type HarnessConsultResult = HarnessConsultSuccess | HarnessConsultFailure;

// ─── G2: Secret-stripped leaf environment ─────────────────────────────────────
// Build a sanitised copy of process.env for the leaf harness subprocess.
// Strips any env key whose name matches the secret-shaped pattern plus an
// explicit allowlist of known Graphyn/provider secret keys.
// Non-secret vars (HOME, PATH, TMPDIR, etc.) are preserved so the leaf CLIs
// can still locate their file-based auth (~/.codex, ~/.gemini, etc.).

/** Pattern matching env key NAMES that are likely to carry secret values. */
const SECRET_KEY_PATTERN = /(^|_)(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)($|_)/i;

/** Explicit additional key names to strip regardless of the above pattern. */
const EXPLICIT_SECRET_KEYS = new Set([
  'GRAPHYN_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
]);

function buildLeafEnv(
  base: NodeJS.ProcessEnv,
  overrides: Record<string, string>,
): { env: NodeJS.ProcessEnv; strippedCount: number } {
  let strippedCount = 0;
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (EXPLICIT_SECRET_KEYS.has(key) || SECRET_KEY_PATTERN.test(key)) {
      strippedCount++;
      continue;
    }
    env[key] = value;
  }
  // Apply caller-supplied overrides AFTER stripping (depth/trace propagation).
  Object.assign(env, overrides);
  return { env, strippedCount };
}

// ─── Subprocess runner ──────────────────────────────────────────────────────────

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: NodeJS.ErrnoException;
}

function runProcess(
  command: string,
  argv: string[],
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, argv, { stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr, timedOut, spawnError: err });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** Extract a JSON object from possibly-noisy stdout (gemini prints clean JSON to stdout). */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('no JSON object found in harness output');
  }
}

// ─── Adapter interface + leaves ───────────────────────────────────────────────

interface HarnessAdapter {
  readonly id: HarnessId;
  /** The leaf binary on PATH. */
  readonly binary: string;
  buildArgv(prompt: string, req: HarnessConsultRequest): string[];
  /** Parse the leaf's stdout into a normalized answer + read-only verification. */
  parseOutput(stdout: string): { response: string; model?: string; readOnlyVerified: boolean };
}

class GeminiHarnessAdapter implements HarnessAdapter {
  readonly id = 'gemini' as const;
  readonly binary = 'gemini';

  buildArgv(prompt: string, req: HarnessConsultRequest): string[] {
    // `--approval-mode plan` = read-only mode; `-o json` = machine-parseable envelope.
    const argv = ['-p', prompt, '--approval-mode', 'plan', '-o', 'json'];
    if (req.model) argv.push('-m', req.model);
    return argv;
  }

  parseOutput(stdout: string): { response: string; model?: string; readOnlyVerified: boolean } {
    const parsed = extractJson(stdout) as {
      response?: string;
      stats?: {
        models?: Record<string, unknown>;
        files?: { totalLinesAdded?: number; totalLinesRemoved?: number };
      };
    };
    const response = (parsed.response ?? '').trim();
    const linesAdded = parsed.stats?.files?.totalLinesAdded ?? 0;
    const linesRemoved = parsed.stats?.files?.totalLinesRemoved ?? 0;
    const model = parsed.stats?.models ? Object.keys(parsed.stats.models)[0] : undefined;
    return { response, model, readOnlyVerified: linesAdded === 0 && linesRemoved === 0 };
  }
}

class CodexHarnessAdapter implements HarnessAdapter {
  readonly id = 'codex' as const;
  readonly binary = 'codex';

  buildArgv(prompt: string, req: HarnessConsultRequest): string[] {
    // `-s read-only` sandboxes the leaf at the OS level (no writes, no escalation).
    // `--ignore-user-config` is MANDATORY: the operator's ~/.codex/config.toml is
    // `danger-full-access` / `approval_policy = never` (W273 §6) and a consult must
    // never inherit it. `--skip-git-repo-check` lets the consult run outside a git repo.
    const argv = ['exec', '--skip-git-repo-check', '--ignore-user-config', '-s', 'read-only', '--json'];
    if (req.model) argv.push('-m', req.model);
    argv.push(prompt);
    return argv;
  }

  parseOutput(stdout: string): { response: string; model?: string; readOnlyVerified: boolean } {
    // codex --json emits JSONL events; the answer is the text of the last
    // `item.completed` event whose `item.type` is `agent_message`. Non-JSON noise
    // lines (e.g. "Reading additional input from stdin…") are skipped.
    const messages: string[] = [];
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt: { type?: string; item?: { type?: string; text?: string } };
      try {
        evt = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (evt.type === 'item.completed' && evt.item?.type === 'agent_message' && typeof evt.item.text === 'string') {
        messages.push(evt.item.text);
      }
    }
    const response = (messages.at(-1) ?? '').trim();
    // Read-only is guaranteed by the `-s read-only` OS sandbox in buildArgv (not
    // self-reported in the JSON), so a clean parse is sufficient verification.
    // codex --json does not surface the answering model, so `model` stays undefined.
    return { response, readOnlyVerified: true };
  }
}

const ADAPTERS: Partial<Record<HarnessId, HarnessAdapter>> = {
  gemini: new GeminiHarnessAdapter(),
  codex: new CodexHarnessAdapter(),
};

function fail(
  toHarness: HarnessId | string,
  errorCode: HarnessConsultErrorCode,
  error: string,
  actionable: string,
): HarnessConsultFailure {
  return { ok: false, toHarness, errorCode, error, actionable };
}

// ─── The junction entry point ─────────────────────────────────────────────────

/**
 * Route a consult to an external harness through the graphyn junction.
 * Read-only by default; redacts secrets; returns a receipt.
 */
export async function runHarnessConsult(req: HarnessConsultRequest): Promise<HarnessConsultResult> {
  const fromHarness = req.fromHarness ?? 'claude';
  const readOnly = req.readOnly !== false;
  const timeoutMs = req.timeoutMs ?? 120_000;

  // ── Guardrail G3: recursion / depth cap ────────────────────────────────────
  // Read the incoming depth from the env (set by the parent junction, if any).
  const incomingDepth = parseInt(process.env.GRAPHYN_JUNCTION_DEPTH ?? '0', 10) || 0;
  if (incomingDepth >= 3) {
    return fail(
      req.toHarness,
      'JUNCTION_DEPTH_EXCEEDED',
      `Junction recursion depth ${incomingDepth} has reached the maximum of 3.`,
      'An agent-calling-agent chain exceeded the depth cap. Review the calling chain for unbounded recursion.',
    );
  }
  // Resolve (or generate) the trace id propagated across the entire chain.
  const traceId = process.env.GRAPHYN_JUNCTION_TRACE_ID || randomUUID();

  // ── Basic validation ───────────────────────────────────────────────────────
  if (!req.question || !req.question.trim()) {
    return fail(req.toHarness, 'BAD_REQUEST', 'Empty question.', 'Provide a question: graphyn consult --to gemini "your question".');
  }

  const adapter = ADAPTERS[req.toHarness];
  if (!adapter) {
    return fail(
      req.toHarness,
      'HARNESS_NOT_WIRED',
      `Harness "${req.toHarness}" is not wired in this build.`,
      `Supported harnesses: ${SUPPORTED_HARNESSES.join(', ')}. (Codex/Claude leaves are the fast-follow — see W273 §8.)`,
    );
  }

  // ── Guardrail G1 + redaction: apply the full transform chain on the RAW question.
  // Redaction now happens INSIDE applyConsultTransformPolicy (new contract from
  // transform-policy.ts). We pass the raw question; the chain handles redaction
  // before the deterministic transform stages, producing a combined receipt.
  const { transformedInput, receipt, redacted } = applyConsultTransformPolicy(req.question);

  // ── Guardrail G2: build a secret-stripped leaf environment ─────────────────
  // The leaf inherits HOME, PATH, and other non-secret vars so CLIs can locate
  // their file-based auth (~/.codex, ~/.gemini). Secret-shaped keys are stripped.
  // GRAPHYN_JUNCTION_DEPTH and GRAPHYN_JUNCTION_TRACE_ID are explicitly set so
  // any nested consult call is bounded and traceable.
  // TODO(later-wave): junction_budget_usd needs a per-model cost map before USD
  //   budgeting can be enforced here.
  const { env: leafEnv, strippedCount } = buildLeafEnv(process.env, {
    GRAPHYN_JUNCTION_DEPTH: String(incomingDepth + 1),
    GRAPHYN_JUNCTION_TRACE_ID: traceId,
  });

  const argv = adapter.buildArgv(transformedInput, req);
  const started = Date.now();
  const result = await runProcess(adapter.binary, argv, timeoutMs, leafEnv);
  const durationMs = Date.now() - started;

  if (result.spawnError) {
    if (result.spawnError.code === 'ENOENT') {
      return fail(req.toHarness, 'HARNESS_UNAVAILABLE', `"${adapter.binary}" is not installed or not on PATH.`, `Install the ${req.toHarness} CLI and ensure it is on PATH.`);
    }
    return fail(req.toHarness, 'HARNESS_FAILED', `Failed to spawn ${adapter.binary}: ${result.spawnError.message}`, 'Check the harness CLI installation and retry.');
  }
  if (result.timedOut) {
    return fail(req.toHarness, 'HARNESS_TIMEOUT', `${adapter.binary} did not respond within ${timeoutMs}ms.`, 'Increase --timeout or simplify the question.');
  }
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().split('\n').slice(-3).join(' ');
    return fail(req.toHarness, 'HARNESS_FAILED', `${adapter.binary} exited with code ${result.code}. ${detail}`, 'Check the harness CLI auth/config and retry.');
  }

  let parsed: { response: string; model?: string; readOnlyVerified: boolean };
  try {
    parsed = adapter.parseOutput(result.stdout);
  } catch (err) {
    return fail(req.toHarness, 'HARNESS_UNPARSEABLE', `Could not parse ${adapter.binary} output: ${err instanceof Error ? err.message : String(err)}`, 'The harness output format may have changed; inspect raw output.');
  }

  // Read-only enforcement: a consult must never mutate the filesystem.
  if (readOnly && !parsed.readOnlyVerified) {
    return fail(req.toHarness, 'HARNESS_UNSAFE_OUTPUT', `${adapter.binary} reported filesystem writes during a read-only consult.`, 'Refusing to return a non-read-only consult result.');
  }
  if (!parsed.response) {
    return fail(req.toHarness, 'HARNESS_UNPARSEABLE', `${adapter.binary} returned an empty answer.`, 'Retry; if it persists the harness may have errored silently.');
  }

  return {
    ok: true,
    fromHarness,
    toHarness: req.toHarness,
    answeredByModel: parsed.model,
    response: parsed.response,
    durationMs,
    receipt: {
      transform: receipt,
      redacted,
      readOnlyEnforced: readOnly,
      invocationArgv: [adapter.binary, ...argv],
      junctionDepth: incomingDepth,
      junctionTraceId: traceId,
      strippedEnvKeyCount: strippedCount,
    },
  };
}
