// Test setup file
import { beforeEach, afterEach } from 'vitest';

// Mock environment
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.GRAPHYN_API_URL = 'http://localhost:4000';
});

// Clean up
afterEach(() => {
  delete process.env.GRAPHYN_API_KEY;
  delete process.env.GRAPHYN_API_URL;
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};