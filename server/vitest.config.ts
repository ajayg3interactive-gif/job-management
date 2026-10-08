import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Tests must run against the separate test database (DATABASE_URL in .env.test)
    env: { NODE_ENV: 'test' },
  },
});
