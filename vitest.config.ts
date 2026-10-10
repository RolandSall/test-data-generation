import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['packages/test-data/src/**/*.ts'], exclude: ['**/index.ts'], reporter: ['text', 'html', 'json-summary'], thresholds: { statements: 85, branches: 80, functions: 85, lines: 90 } },
  },
});
