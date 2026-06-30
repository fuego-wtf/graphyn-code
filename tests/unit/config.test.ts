import { afterEach, describe, expect, it } from 'vitest';
import { config, getConfig } from '../../src/config';

const ENV_KEYS = [
  'NODE_ENV',
  'GRAPHYN_API_URL',
  'GRAPHYN_APP_URL',
  'GRAPHYN_CODE_API_URL',
  'GRAPHYN_DEV_MODE',
  'GRAPHYN_OAUTH_REDIRECT_URI',
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function resetEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(resetEnv);

describe('Graphyn code config', () => {
  it('uses graphyn.ai service hosts in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GRAPHYN_API_URL;
    delete process.env.GRAPHYN_APP_URL;
    delete process.env.GRAPHYN_CODE_API_URL;
    delete process.env.GRAPHYN_DEV_MODE;
    delete process.env.GRAPHYN_OAUTH_REDIRECT_URI;

    expect(getConfig()).toMatchObject({
      apiBaseUrl: 'https://api.graphyn.ai',
      appUrl: 'https://app.graphyn.ai',
      codeApiUrl: 'https://code.graphyn.ai',
      isDev: false,
    });
    expect(config.oauth.redirectUri).toBe('https://cli.graphyn.ai/callback');
  });

  it('keeps localhost defaults in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GRAPHYN_API_URL;
    delete process.env.GRAPHYN_APP_URL;
    delete process.env.GRAPHYN_CODE_API_URL;
    delete process.env.GRAPHYN_DEV_MODE;

    expect(getConfig()).toMatchObject({
      apiBaseUrl: 'http://localhost:4000',
      appUrl: 'http://localhost:3000',
      codeApiUrl: 'http://localhost:4000',
      isDev: true,
    });
  });

  it('keeps explicit production overrides authoritative', () => {
    process.env.NODE_ENV = 'production';
    process.env.GRAPHYN_API_URL = 'https://api.example.test';
    process.env.GRAPHYN_APP_URL = 'https://app.example.test';
    process.env.GRAPHYN_CODE_API_URL = 'https://code.example.test';
    process.env.GRAPHYN_OAUTH_REDIRECT_URI = 'https://cli.example.test/callback';

    expect(getConfig()).toMatchObject({
      apiBaseUrl: 'https://api.example.test',
      appUrl: 'https://app.example.test',
      codeApiUrl: 'https://code.example.test',
      isDev: false,
    });
    expect(config.oauth.redirectUri).toBe('https://cli.example.test/callback');
  });
});
