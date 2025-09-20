import { afterEach, beforeEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// Global test configuration
export const TEST_CONFIG = {
  TEST_DB_PATH: resolve(process.cwd(), 'tests/fixtures/test-graphyn-tasks.db'),
  MCP_SERVER_TIMEOUT: 5000,
  CLAUDE_PROCESS_TIMEOUT: 30000,
  WORKSPACE_DIR: resolve(process.cwd(), 'tests/fixtures/workspaces')
};

// Clean up test databases before and after each test
beforeEach(async () => {
  cleanupTestDatabases();
});

afterEach(async () => {
  cleanupTestDatabases();
});

export function cleanupTestDatabases(): void {
  const dbFiles = [
    TEST_CONFIG.TEST_DB_PATH,
    `${TEST_CONFIG.TEST_DB_PATH}-wal`,
    `${TEST_CONFIG.TEST_DB_PATH}-wal2`, 
    `${TEST_CONFIG.TEST_DB_PATH}-shm`
  ];

  dbFiles.forEach(file => {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch (error) {
        // Ignore errors - file may be locked
      }
    }
  });
}

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.GRAPHYN_WORKSPACE = TEST_CONFIG.WORKSPACE_DIR;