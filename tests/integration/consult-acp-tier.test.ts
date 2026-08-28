/**
 * Consult tier parsing plus the RED-125 Gemini removal gate.
 * The lower-level ACP transport remains covered with a mocked child process in
 * tests/unit/consult/acp-transport.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { runHarnessConsult, SUPPORTED_HARNESSES } from '../../src/consult/harness-adapter.js';
import { parseHarnessConsultArgs } from '../../src/index.js';

describe('Gemini consult gate', () => {
  it('keeps Gemini typed for compatibility but unreachable at runtime', async () => {
    expect(SUPPORTED_HARNESSES).not.toContain('gemini');
    const result = await runHarnessConsult({
      toHarness: 'gemini',
      question: 'This must never reach a Gemini subprocess.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Gemini unexpectedly remained reachable');
    expect(result.errorCode).toBe('HARNESS_NOT_WIRED');
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
