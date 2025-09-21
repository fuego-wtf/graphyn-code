/**
 * CLI Orchestration Integration Tests
 * 
 * End-to-end tests covering the complete CLI orchestration workflow
 * from user input to agent execution and transparency reporting.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const CLI_PATH = path.resolve(process.cwd(), 'apps/cli/dist/index.js');

const BASE_ENV = {
  PATH: process.env.PATH,
  GRAPHYN_TEST_MODE: 'true',
  GRAPHYN_USE_MOCK_MCP: 'true',
  USE_MOCK_DB: 'true',
  ANTHROPIC_API_KEY: 'test-key',
};

function buildEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...BASE_ENV, ...overrides })
      .filter(([_, value]) => value !== undefined)
  ) as Record<string, string>;
}

describe('Real Agent Orchestration (Stubbed Claude)', () => {
  let tempHome: string;
  let stubClaudePath: string;

  beforeAll(async () => {
    const cliBuilt = await fs.access(CLI_PATH).then(() => true).catch(() => false);
    if (!cliBuilt) {
      throw new Error(`CLI not built. Run 'pnpm --filter @graphyn/cli build' first.`);
    }

    tempHome = await fs.mkdtemp(path.join(process.cwd(), 'tmp-real-agent-'));
    stubClaudePath = path.join(tempHome, 'claude-stub.js');

    const stubScript = `#!/usr/bin/env node\n` +
      `console.log(JSON.stringify({ content: 'Stub execution success', tokensUsed: 24, toolsUsed: [] }));\n`;
    await fs.writeFile(stubClaudePath, stubScript, { mode: 0o755 });
  });

  afterAll(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await fs.rm(path.join(tempHome, '.graphyn'), { recursive: true, force: true }).catch(() => {});
  });

  test('graphyn orchestrate produces transparency logs and audit bundles', async () => {
    const env = buildEnv({
      HOME: tempHome,
      USER: 'graphyn-test',
      CLAUDE_CLI_PATH: stubClaudePath,
    });

    const result = await runCli(
      ['orchestrate', 'generate a hello world module'],
      env,
      30000,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('📝 Goal captured');

    const sessionsRoot = path.join(tempHome, '.graphyn', 'graphyn-test', 'sessions');
    const sessions = await fs.readdir(sessionsRoot);
    expect(sessions.length).toBeGreaterThan(0);

    const sessionId = sessions[0];
    const sessionDir = path.join(sessionsRoot, sessionId);

    const knowledgeEntries = await fs.readdir(path.join(sessionDir, 'knowledge')).catch(() => []);
    expect(Array.isArray(knowledgeEntries)).toBe(true);

    const logsDir = path.join(sessionDir, 'logs');
    const transparencyLog = path.join(logsDir, 'transparency.log');
    const logContent = await fs.readFile(transparencyLog, 'utf-8');
    expect(logContent).toContain('task_planned');
    expect(logContent).toContain('task_completed');

    const agentsDir = path.join(sessionDir, 'agents');
    const agents = await fs.readdir(agentsDir);
    expect(agents.length).toBeGreaterThan(0);

    for (const agentId of agents) {
      const auditsDir = path.join(agentsDir, agentId, 'audits');
      const audits = await fs.readdir(auditsDir);
      expect(audits.length).toBeGreaterThan(0);
    }
  }, 60000);
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(
  args: string[],
  env: Record<string, string>,
  timeoutMs = 20000
): Promise<RunResult> {
  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
