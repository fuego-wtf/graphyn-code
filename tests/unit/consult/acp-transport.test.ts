/**
 * Unit tests for the Tier-2 ACP-over-stdio transport.
 *
 * The child_process.spawn call is mocked entirely — no real `gemini` binary is
 * needed.  Each test drives a fake JSON-RPC 2.0 / ACP wire exchange using a
 * pair of in-process streams, asserting:
 *   - initialize → session/new → session/prompt handshake ORDER
 *   - text accumulation from agent_message_chunk notifications
 *   - turn-end detection via NOTIFICATION path (Claude-style harnesses)
 *   - turn-end detection via RESPONSE path (Gemini-style single-shot harnesses)
 *   - timeout handling and clean kill
 *   - empty-answer detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// We mock child_process before importing the module under test.
vi.mock('node:child_process', () => {
  return { spawn: vi.fn() };
});

import { spawn } from 'node:child_process';
import { runAcpTransport } from '../../../src/consult/acp-transport.js';

// ─── Fake child-process factory ───────────────────────────────────────────────

interface FakeChild extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

/** Create a fake child that captures what the SUT writes to stdin. */
function makeFakeChild(): { child: FakeChild; capturedRequests: () => string[] } {
  const child = new EventEmitter() as FakeChild;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();

  const captured: string[] = [];
  child.stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) captured.push(line.trim());
    }
  });

  return { child, capturedRequests: () => captured };
}

/** Write a JSON-RPC response to the child's stdout so the SUT can parse it. */
function sendResponse(child: FakeChild, id: number | string, result: unknown): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n';
  child.stdout.push(msg);
}

/** Write a JSON-RPC notification (no id) to the child's stdout. */
function sendNotification(child: FakeChild, method: string, params: unknown): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  child.stdout.push(msg);
}

/** Simulate the child process exiting. */
function closeChild(child: FakeChild, code = 0): void {
  child.stdout.push(null); // EOF
  child.emit('close', code);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runAcpTransport', () => {
  const spawnMock = spawn as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Handshake order ────────────────────────────────────────────────────────

  it('sends initialize → session/new → session/prompt in order', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({
      harnessBin: 'gemini',
      prompt: 'What is 2+2?',
      timeoutMs: 5000,
    });

    // Wait for initialize to arrive, then respond.
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    const initReq = JSON.parse(capturedRequests()[0]);
    expect(initReq.method).toBe('initialize');
    expect(initReq.params.protocolVersion).toBe(1);
    sendResponse(child, initReq.id, { protocolVersion: 1, serverInfo: { name: 'gemini-acp' } });

    // session/new arrives next.
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    const snReq = JSON.parse(capturedRequests()[1]);
    expect(snReq.method).toBe('session/new');
    sendResponse(child, snReq.id, { sessionId: 'sess-abc', modelId: 'gemini-2.0' });

    // session/prompt arrives next.
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);
    expect(spReq.method).toBe('session/prompt');
    expect(spReq.params.sessionId).toBe('sess-abc');
    expect(spReq.params.prompt[0].type).toBe('text');
    expect(spReq.params.prompt[0].text).toBe('What is 2+2?');

    // Stream an answer chunk then end turn via notification.
    sendNotification(child, 'session/update', {
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '4' } },
    });
    sendNotification(child, 'session/update', {
      update: { sessionUpdate: 'agent_message_chunk', stopReason: 'end_turn', content: { type: 'text', text: '' } },
    });
    sendResponse(child, spReq.id, { stopReason: undefined });
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('4');
    expect(result.sessionId).toBe('sess-abc');
    expect(result.modelId).toBe('gemini-2.0');
  });

  // ── Text accumulation ──────────────────────────────────────────────────────

  it('accumulates multiple agent_message_chunk notifications', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'gemini', prompt: 'tell me a story', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    sendResponse(child, JSON.parse(capturedRequests()[0]).id, { protocolVersion: 1 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-1' });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    // Multiple chunks.
    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Once ' } } });
    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'upon ' } } });
    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'a time.' } } });
    // Turn-end via notification.
    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', stopReason: 'end_turn', content: { type: 'text', text: '' } } });
    sendResponse(child, spReq.id, {});
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('Once upon a time.');
  });

  // ── Turn-end via NOTIFICATION path ────────────────────────────────────────

  it('detects turn-end from session/update notification stopReason', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'claude', prompt: 'ping', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    sendResponse(child, JSON.parse(capturedRequests()[0]).id, { protocolVersion: 1 });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-c' });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'pong' } } });
    // Notification carries stopReason — this is the "Claude path".
    sendNotification(child, 'session/update', { update: { stopReason: 'end_turn', sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '' } } });
    sendResponse(child, spReq.id, {});
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('pong');
    expect(result.stopReason).toBe('end_turn');
  });

  // ── Turn-end via RESPONSE path ─────────────────────────────────────────────
  // Gemini returns stopReason in the session/prompt JSON-RPC response, NOT in
  // a subsequent notification.

  it('detects turn-end from session/prompt response stopReason (Gemini path)', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'gemini', prompt: 'hello', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    sendResponse(child, JSON.parse(capturedRequests()[0]).id, { protocolVersion: 1 });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-g' });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    // Chunks arrive as normal notifications.
    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hi there' } } });
    // The session/prompt RESPONSE carries stopReason (Gemini single-shot path).
    sendResponse(child, spReq.id, { stopReason: 'end_turn' });
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('Hi there');
    expect(result.stopReason).toBe('end_turn');
  });

  // ── Timeout handling ───────────────────────────────────────────────────────

  it('returns ACP_TIMEOUT when the harness does not respond within timeoutMs', async () => {
    const { child } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    // Use a very short timeout; never send any response.
    const runPromise = runAcpTransport({
      harnessBin: 'gemini',
      prompt: 'hang',
      timeoutMs: 50,
    });

    const result = await runPromise;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errorCode).toBe('ACP_TIMEOUT');
    // The child must have been killed.
    expect(child.kill).toHaveBeenCalled();
  });

  // ── ENOENT / spawn error ───────────────────────────────────────────────────

  it('returns ACP_SPAWN_ERROR when spawn throws synchronously', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });

    const result = await runAcpTransport({ harnessBin: 'no-such-binary', prompt: 'x', timeoutMs: 1000 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errorCode).toBe('ACP_SPAWN_ERROR');
  });

  // ── Empty answer ───────────────────────────────────────────────────────────

  it('returns ACP_EMPTY_ANSWER when harness streams no text', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'gemini', prompt: 'silent', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    sendResponse(child, JSON.parse(capturedRequests()[0]).id, { protocolVersion: 1 });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-empty' });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    // No text chunks — send only a stopReason.
    sendNotification(child, 'session/update', { update: { stopReason: 'end_turn', content: { type: 'text', text: '' } } });
    sendResponse(child, spReq.id, {});
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errorCode).toBe('ACP_EMPTY_ANSWER');
  });

  // ── Partial line buffering ─────────────────────────────────────────────────

  it('handles JSON split across multiple data chunks', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'gemini', prompt: 'split', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    const initReq = JSON.parse(capturedRequests()[0]);

    // Push the response in two split chunks (simulate TCP fragmentation).
    const full = JSON.stringify({ jsonrpc: '2.0', id: initReq.id, result: { protocolVersion: 1 } }) + '\n';
    const half = Math.floor(full.length / 2);
    child.stdout.push(full.slice(0, half));
    child.stdout.push(full.slice(half));

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-split' });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } } });
    sendNotification(child, 'session/update', { update: { stopReason: 'end_turn', content: { type: 'text', text: '' } } });
    sendResponse(child, spReq.id, {});
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('ok');
  });

  // ── Non-JSON noise lines are skipped ──────────────────────────────────────

  it('ignores non-JSON noise lines in stdout', async () => {
    const { child, capturedRequests } = makeFakeChild();
    spawnMock.mockReturnValue(child);

    const runPromise = runAcpTransport({ harnessBin: 'gemini', prompt: 'noisy', timeoutMs: 5000 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(1));
    const initReq = JSON.parse(capturedRequests()[0]);
    // Inject noise before the real response.
    child.stdout.push('Loading models...\n');
    child.stdout.push('WARNING: experimental feature\n');
    sendResponse(child, initReq.id, { protocolVersion: 1 });

    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(2));
    sendResponse(child, JSON.parse(capturedRequests()[1]).id, { sessionId: 'sess-noisy' });
    await vi.waitFor(() => expect(capturedRequests().length).toBeGreaterThanOrEqual(3));
    const spReq = JSON.parse(capturedRequests()[2]);

    sendNotification(child, 'session/update', { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'clean' } } });
    sendNotification(child, 'session/update', { update: { stopReason: 'end_turn', content: { type: 'text', text: '' } } });
    sendResponse(child, spReq.id, {});
    closeChild(child);

    const result = await runPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.answerText).toBe('clean');
  });
});
