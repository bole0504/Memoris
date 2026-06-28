import { defineConfig } from 'vitest/config';

// Unit tests for the framework-agnostic lib/ logic (brain wiring, capture loop).
// Entrypoints/UI are exercised by the WXT build + manual load, not vitest.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
