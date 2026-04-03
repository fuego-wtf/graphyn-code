import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/index.js';

describe('parse consult flags', () => {
  it('parses --agent-uuid and --machine with query', () => {
    const { options, query } = parseArgs([
      '--agent-uuid', 'agent-123',
      '--machine', 'mac-studio',
      'how do I fix this?',
    ]);

    expect(options.agentUuid).toBe('agent-123');
    expect(options.machine).toBe('mac-studio');
    expect(query).toBe('how do I fix this?');
  });

  it('supports existing flags with consult flags', () => {
    const { options, query } = parseArgs([
      '--dev',
      '--agent-uuid', 'agent-abc',
      '--machine', 'mbp',
      'summarize auth flow',
    ]);

    expect(options.dev).toBe(true);
    expect(options.agentUuid).toBe('agent-abc');
    expect(options.machine).toBe('mbp');
    expect(query).toBe('summarize auth flow');
  });
});
