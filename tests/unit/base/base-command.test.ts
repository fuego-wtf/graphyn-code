import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBaseCommand } from '../../../src/commands/base.js';

describe('base command', () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('emits deterministic INVALID_INPUT for conflicting mode flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runBaseCommand('base --docs-only --agents-only plan auth');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? '{}'));
    expect(payload.ok).toBe(false);
    expect(payload.stage).toBe('base');
    expect(payload.error.code).toBe('INVALID_INPUT');
    expect(typeof payload.error.actionable).toBe('string');
    expect(payload.error.actionable.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(1);
  });

  it('shows base help without setting failure exit code', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runBaseCommand('base --help');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = String(logSpy.mock.calls[0]?.[0] ?? '');
    expect(output).toContain('Usage:');
    expect(output).toContain('graphyn base');
    expect(process.exitCode).toBeUndefined();
  });
});
