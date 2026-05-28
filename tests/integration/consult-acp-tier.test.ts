/**
 * Integration tests for Tier-2 ACP consult path.
 *
 * SKIP-BY-DEFAULT: These tests exercise the real `gemini --acp` binary over
 * the ACP-over-stdio JSON-RPC 2.0 transport.  They require:
 *   - `gemini` CLI on PATH and authenticated.
 *   - Network access to the Gemini API.
 *
 * Enable with:
 *   RUN_ACP_LIVE=1 bunx --bun vitest run tests/integration/consult-acp-tier.test.ts
 *
 * SHIP-GATE reminder (from acp-transport.ts): Tier-2 is still EXPERIMENTAL.
 * Two desktop ACP bugs must be fixed before this path ships as a default:
 *   1. transport.rs:166 filter swallows `initialize` responses.
 *   2. agent.rs misses prompt-response stopReason for single-shot models.
 * These tests validate the CLI transport layer only; desktop integration is
 * a separate gate.
 */

import { describe, it, expect } from 'vitest';
import { runHarnessConsult, type HarnessConsultSuccess } from '../../src/consult/harness-adapter.js';
import { parseHarnessConsultArgs } from '../../src/index.js';

const RUN_ACP_LIVE = !!process.env.RUN_ACP_LIVE;

describe.skipIf(!RUN_ACP_LIVE)('Tier-2 ACP consult — live integration (RUN_ACP_LIVE=1)', () => {
  it('returns a structured answer from gemini --acp with readOnlyEnforced=true', async () => {
    const result = await runHarnessConsult({
      toHarness: 'gemini',
      question: 'What is 2 + 2? Answer in one sentence.',
      tier: 'acp',
      timeoutMs: 60_000,
    });

    // Basic shape check.
    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`ACP consult failed [${result.errorCode}]: ${result.error}`);
    }

    const success = result as HarnessConsultSuccess;

    // Must have a non-empty answer.
    expect(typeof success.response).toBe('string');
    expect(success.response.length).toBeGreaterThan(0);

    // Duration must be recorded.
    expect(typeof success.durationMs).toBe('number');
    expect(success.durationMs).toBeGreaterThan(0);

    // answeredByModel: gemini --acp is expected to populate session/new modelId.
    // May be undefined if the harness does not report it — just type-check.
    expect(
      success.answeredByModel === undefined || typeof success.answeredByModel === 'string',
    ).toBe(true);

    // Receipt shape.
    const { receipt } = success;
    expect(receipt).toBeDefined();
    expect(receipt.readOnlyEnforced).toBe(true);
    expect(typeof receipt.junctionTraceId).toBe('string');
    expect(receipt.junctionTraceId.length).toBeGreaterThan(0);
    expect(typeof receipt.junctionDepth).toBe('number');
    expect(typeof receipt.strippedEnvKeyCount).toBe('number');
    // invocationArgv must include the binary and --acp flag.
    expect(receipt.invocationArgv).toContain('gemini');
    expect(receipt.invocationArgv).toContain('--acp');
    // Transform receipt must be present.
    expect(receipt.transform).toBeDefined();
  }, 90_000); // generous wall-clock budget for a real network call

  it('resolves --acp shorthand flag via parseHarnessConsultArgs', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--acp', 'what is 2+2']);
    expect(parsed.tier).toBe('acp');
    expect(parsed.toHarness).toBe('gemini');
    expect(parsed.question).toBe('what is 2+2');
  });

  it('resolves --tier acp flag via parseHarnessConsultArgs', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--tier', 'acp', 'what is 2+2']);
    expect(parsed.tier).toBe('acp');
  });
});

// ── Unit-level flag parsing (always runs regardless of RUN_ACP_LIVE) ──────────

describe('parseHarnessConsultArgs — --tier / --acp flag parsing (always)', () => {
  it('defaults tier to undefined (subprocess is harness-adapter default)', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', 'hello']);
    expect(parsed.tier).toBeUndefined();
  });

  it('--acp sets tier to acp', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--acp', 'hello']);
    expect(parsed.tier).toBe('acp');
  });

  it('--tier acp sets tier to acp', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--tier', 'acp', 'hello']);
    expect(parsed.tier).toBe('acp');
  });

  it('--tier subprocess sets tier to subprocess', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--tier', 'subprocess', 'hello']);
    expect(parsed.tier).toBe('subprocess');
  });

  it('--acp does not consume the following question token', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--acp', 'what is 2+2']);
    expect(parsed.question).toBe('what is 2+2');
    expect(parsed.tier).toBe('acp');
  });

  it('--tier acp does not consume the following question token', () => {
    const parsed = parseHarnessConsultArgs(['consult', '--to', 'gemini', '--tier', 'acp', 'what is 2+2']);
    expect(parsed.question).toBe('what is 2+2');
  });

  it('existing flags still work alongside --tier', () => {
    const parsed = parseHarnessConsultArgs([
      'consult', '--to', 'gemini', '--from', 'claude', '--model', 'gemini-2.0', '--json',
      '--timeout', '30000', '--tier', 'acp', 'a question',
    ]);
    expect(parsed.toHarness).toBe('gemini');
    expect(parsed.from).toBe('claude');
    expect(parsed.model).toBe('gemini-2.0');
    expect(parsed.json).toBe(true);
    expect(parsed.timeoutMs).toBe(30000);
    expect(parsed.tier).toBe('acp');
    expect(parsed.question).toBe('a question');
  });
});
