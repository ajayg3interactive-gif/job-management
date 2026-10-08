import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    env: { VITE_API_URL: 'http://localhost:4000' },
    setupFiles: ['./src/test/setup.ts'],
  },
});
