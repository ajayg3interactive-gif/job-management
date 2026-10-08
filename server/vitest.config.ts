import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Points DATABASE_URL at TEST_DATABASE_URL and refuses to run against the dev database.
    setupFiles: ['./tests/setup.ts'],
    env: { NODE_ENV: 'test' },
    // Test files share one database, so they must not run in parallel.
    fileParallelism: false,
  },
});
