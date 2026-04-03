import { describe, expect, it } from 'vitest';
import { emitDeterministicFailureEnvelope } from '../../../src/commands/consult.js';

describe('consult failure envelope', () => {
  it('emits AUTH_REQUIRED with actionable message', () => {
    const out = emitDeterministicFailureEnvelope('AUTH_REQUIRED');
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('unexpected success envelope');
    expect(out.error.code).toBe('AUTH_REQUIRED');
    expect(out.error.actionable.length).toBeGreaterThan(0);
  });

  it('contains all deterministic codes', () => {
    const codes = [
      'AUTH_REQUIRED',
      'AGENT_NOT_FOUND',
      'MACHINE_NOT_FOUND',
      'MACHINE_OFFLINE',
      'RUNTIME_UNREACHABLE',
      'PERMISSION_DENIED',
    ] as const;

    for (const code of codes) {
      const out = emitDeterministicFailureEnvelope(code);
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error('unexpected success envelope');
      expect(out.error.code).toBe(code);
      expect(out.error.message.length).toBeGreaterThan(0);
      expect(out.error.actionable.length).toBeGreaterThan(0);
    }
  });
});
