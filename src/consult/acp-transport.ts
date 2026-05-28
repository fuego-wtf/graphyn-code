/**
 * Tier-2 ACP-over-stdio transport for cross-harness consult.
 *
 * SHIP-GATE: Do NOT enable by default. Two latent desktop ACP bugs must be
 * fixed before Gemini-ACP Tier-2 ships:
 *   1. transport.rs:166 filter swallows `initialize` responses in the Rust
 *      ACP session handler — the harness never gets a valid handshake reply.
 *   2. agent.rs misses `session/prompt` response-level stopReason — only
 *      notification-path turn-end is handled, so single-shot models (Gemini)
 *      that return stopReason in the response are silently truncated.
 *
 * Tier-2 is EXPERIMENTAL and OPT-IN (env GRAPHYN_CONSULT_TIER=acp or
 * explicit `tier: 'acp'` option). Tier-1 one-shot subprocess remains default.
 *
 * Protocol: newline-delimited JSON-RPC 2.0 (NOT LSP Content-Length).
 * ACP spec: protocolVersion integer 1.
 * Handshake sequence: initialize → session/new → session/prompt.
 * Answer stream: `session/update` notifications (method "session/update") with
 *   params.update.sessionUpdate == "agent_message_chunk" and
 *   params.update.content.text;  turn-end from EITHER:
 *   a) a `session/update` notification with stopReason set, or
 *   b) the `session/prompt` JSON-RPC response body having stopReason set.
 *
 * Design ref: docs/loops/w274-cross-harness-consult/README.md §Wave-4 spike.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ─── JSON-RPC 2.0 wire types ──────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg;
}

function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return !('id' in msg) || (msg as JsonRpcResponse).id === null;
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** Result returned by a successful ACP Tier-2 transport run. */
export interface AcpTransportResult {
  /** Accumulated answer text from all agent_message_chunk notifications. */
  answerText: string;
  /** Session id returned by session/new. */
  sessionId: string;
  /** Model id reported by session/new, if present. */
  modelId?: string;
  /** Stop reason from either the session/prompt response or a session/update notification. */
  stopReason?: string;
  /** Wall-clock duration of the full run (spawn → answer complete), in milliseconds. */
  durationMs: number;
}

export interface AcpTransportOptions {
  /** Binary to spawn (e.g. 'gemini'). */
  harnessBin: string;
  /** The question text to forward. */
  prompt: string;
  /** Hard timeout in milliseconds. Defaults to 120 000. */
  timeoutMs?: number;
  /** Pre-sanitised env for the child process. */
  env?: NodeJS.ProcessEnv;
}

export type AcpTransportError =
  | 'ACP_SPAWN_ERROR'
  | 'ACP_TIMEOUT'
  | 'ACP_HANDSHAKE_FAILED'
  | 'ACP_SESSION_NEW_FAILED'
  | 'ACP_PROMPT_FAILED'
  | 'ACP_EMPTY_ANSWER';

export interface AcpTransportFailure {
  ok: false;
  errorCode: AcpTransportError;
  error: string;
}

export type AcpTransportOutcome =
  | ({ ok: true } & AcpTransportResult)
  | AcpTransportFailure;

// ─── Core implementation ──────────────────────────────────────────────────────

/**
 * Spawn `<harnessBin> --acp`, perform the ACP handshake, issue a prompt, and
 * accumulate the streamed answer.  Returns a structured result or a typed
 * failure — never throws.
 */
export async function runAcpTransport(options: AcpTransportOptions): Promise<AcpTransportOutcome> {
  const { harnessBin, prompt, timeoutMs = 120_000, env = process.env } = options;
  const started = Date.now();

  // ── 1. Spawn the harness in ACP mode ──────────────────────────────────────
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(harnessBin, ['--acp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
  } catch (err) {
    return {
      ok: false,
      errorCode: 'ACP_SPAWN_ERROR',
      error: `Failed to spawn ${harnessBin} --acp: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 2. Wire line-buffered reader + request dispatcher ──────────────────────
  // Track pending RPC calls: id → { resolve, reject }
  type PendingEntry = {
    resolve: (result: unknown) => void;
    reject: (err: Error) => void;
  };
  const pending = new Map<number | string, PendingEntry>();
  let lineBuffer = '';
  let reqCounter = 0;

  // Accumulated answer state
  let answerText = '';
  let turnEnded = false;
  let stopReason: string | undefined;
  let promptResolve: ((reason: string | undefined) => void) | undefined;
  let promptReject: ((err: Error) => void) | undefined;

  function nextId(): number {
    return ++reqCounter;
  }

  function sendRequest(method: string, params: unknown): Promise<unknown> {
    const id = nextId();
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const line = JSON.stringify(req) + '\n';

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        child.stdin!.write(line);
      } catch (err) {
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function dispatchMessage(msg: JsonRpcMessage): void {
    if (isResponse(msg)) {
      const entry = msg.id !== null ? pending.get(msg.id) : undefined;
      if (!entry) return;
      pending.delete(msg.id!);
      if (msg.error) {
        entry.reject(new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`));
      } else {
        // Check if session/prompt response itself carries a stopReason.
        const result = msg.result as Record<string, unknown> | undefined;
        if (result && typeof result.stopReason === 'string' && !turnEnded) {
          stopReason = result.stopReason;
          turnEnded = true;
          if (promptResolve) {
            promptResolve(stopReason);
            promptResolve = undefined;
          }
        }
        entry.resolve(msg.result);
      }
      return;
    }

    if (isNotification(msg) && msg.method === 'session/update') {
      const params = msg.params as Record<string, unknown> | undefined;
      const update = params?.update as Record<string, unknown> | undefined;
      if (!update) return;

      const sessionUpdate = update.sessionUpdate as string | undefined;
      const content = update.content as Record<string, unknown> | undefined;

      if (sessionUpdate === 'agent_message_chunk' && typeof content?.text === 'string') {
        answerText += content.text;
      }

      // Turn-end via notification (notification path = primary for Claude-style harnesses).
      const notifStopReason = update.stopReason as string | undefined;
      if (notifStopReason && !turnEnded) {
        stopReason = notifStopReason;
        turnEnded = true;
        if (promptResolve) {
          promptResolve(notifStopReason);
          promptResolve = undefined;
        }
      }
    }
  }

  // Read stdout line by line, handle partial lines across chunks.
  child.stdout!.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString('utf-8');
    let nl: number;
    while ((nl = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, nl).trim();
      lineBuffer = lineBuffer.slice(nl + 1);
      if (!line) continue;
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line) as JsonRpcMessage;
      } catch {
        // Skip non-JSON lines (stderr-level noise occasionally leaks to stdout).
        continue;
      }
      dispatchMessage(msg);
    }
  });

  // Collect stderr (noise only; not an error unless spawn fails).
  let stderrBuf = '';
  child.stderr!.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf-8');
  });

  // ── 3. Global timeout ──────────────────────────────────────────────────────
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    // Reject all pending calls.
    for (const entry of pending.values()) {
      entry.reject(new Error('ACP transport timeout'));
    }
    pending.clear();
    if (promptReject) {
      promptReject(new Error('ACP transport timeout'));
      promptReject = undefined;
    }
  }, timeoutMs);

  // Cleanup on child close.
  const closedPromise = new Promise<void>((resolve) => {
    child.on('close', () => {
      clearTimeout(timer);
      // Drain partial buffer line.
      if (lineBuffer.trim()) {
        try {
          const msg = JSON.parse(lineBuffer.trim()) as JsonRpcMessage;
          dispatchMessage(msg);
        } catch { /* ignore */ }
      }
      // If the harness exited before turning-ended, resolve the prompt wait.
      if (!turnEnded && promptResolve) {
        promptResolve(undefined);
        promptResolve = undefined;
      }
      resolve();
    });
  });

  // ── 4. Handshake: initialize ───────────────────────────────────────────────
  let initResult: unknown;
  try {
    initResult = await sendRequest('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'graphyn-consult', version: '1.0.0' },
    });
  } catch (err) {
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    if (timedOut) {
      return { ok: false, errorCode: 'ACP_TIMEOUT', error: 'Timed out during ACP initialize handshake.' };
    }
    return {
      ok: false,
      errorCode: 'ACP_HANDSHAKE_FAILED',
      error: `initialize failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!initResult || typeof initResult !== 'object') {
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    return { ok: false, errorCode: 'ACP_HANDSHAKE_FAILED', error: 'initialize returned no result.' };
  }

  // ── 5. session/new ────────────────────────────────────────────────────────
  // gemini@0.42+ requires BOTH cwd (absolute path) AND mcpServers (empty array
  // is fine) in session/new params.  Without these two fields together the
  // server returns {"code":-32603,"message":"Internal error"}.  The `id` field
  // is optional (server mints its own sessionId regardless).
  // Empirically verified 2026-05-28: {id} alone → -32603; {cwd,mcpServers:[]} → OK.
  let sessionNewResult: unknown;
  try {
    sessionNewResult = await sendRequest('session/new', {
      cwd: process.cwd(),
      mcpServers: [],
    });
  } catch (err) {
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    if (timedOut) {
      return { ok: false, errorCode: 'ACP_TIMEOUT', error: 'Timed out during session/new.' };
    }
    return {
      ok: false,
      errorCode: 'ACP_SESSION_NEW_FAILED',
      error: `session/new failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const snr = sessionNewResult as Record<string, unknown> | undefined;
  const sessionId = (typeof snr?.sessionId === 'string' ? snr.sessionId : randomUUID());
  const modelId = typeof snr?.modelId === 'string' ? snr.modelId : undefined;

  // ── 6. session/prompt ─────────────────────────────────────────────────────
  // The response from session/prompt may itself carry stopReason (Gemini path).
  // Notifications carry agent_message_chunk text chunks.
  // We wait until EITHER path signals turn-end.
  const turnEndedPromise = new Promise<string | undefined>((resolve, reject) => {
    promptResolve = resolve;
    promptReject = reject;
  });

  try {
    sendRequest('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: prompt }],
    });
    // Fire-and-forget the RPC response registration — turn-end detection handles completion.
  } catch (err) {
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    return {
      ok: false,
      errorCode: 'ACP_PROMPT_FAILED',
      error: `session/prompt dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Wait for turn-end or error.
  try {
    await turnEndedPromise;
  } catch (err) {
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    if (timedOut) {
      return { ok: false, errorCode: 'ACP_TIMEOUT', error: 'Timed out waiting for ACP answer.' };
    }
    return {
      ok: false,
      errorCode: 'ACP_PROMPT_FAILED',
      error: `session/prompt error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 7. Drain + clean shutdown ──────────────────────────────────────────────
  clearTimeout(timer);
  try { child.stdin!.end(); } catch { /* ignore */ }
  try { child.kill('SIGTERM'); } catch { /* ignore */ }
  await closedPromise;

  if (!answerText.trim()) {
    return {
      ok: false,
      errorCode: 'ACP_EMPTY_ANSWER',
      error: `${harnessBin} --acp returned no answer text. stderr: ${stderrBuf.trim().slice(0, 200)}`,
    };
  }

  return {
    ok: true,
    answerText: answerText.trim(),
    sessionId,
    modelId,
    stopReason,
    durationMs: Date.now() - started,
  };
}
