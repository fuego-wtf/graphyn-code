import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // setupFiles: ['./src/ink/test/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/ink/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@ink': resolve(__dirname, './src/ink'),
      // @anthropic-ai/claude-code v2.x ships as a CLI binary only — it has no
      // JS/ESM entry point and cannot be resolved by Bun/vitest at test time.
      // Alias it to a stub so tests that indirectly invoke loadClaudeCodeSdk()
      // receive a structured error rather than a module-resolution crash.
      '@anthropic-ai/claude-code': resolve(__dirname, './tests/__stubs__/claude-code-sdk.ts'),
    },
  },
});