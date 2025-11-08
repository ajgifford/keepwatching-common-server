import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['dist', 'tests', 'src/index.ts', 'src/testing/**/*'],
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    server: {
      deps: {
        inline: ['fs', 'path', 'crypto'],
      },
    },
  },
  resolve: {
    alias: {
      '@config': path.resolve(process.cwd(), './src/config'),
      '@constants': path.resolve(process.cwd(), './src/constants'),
      '@db': path.resolve(process.cwd(), './src/db'),
      '@logger': path.resolve(process.cwd(), './src/logger'),
      '@middleware': path.resolve(process.cwd(), './src/middleware'),
      '@schema': path.resolve(process.cwd(), './src/schema'),
      '@services': path.resolve(process.cwd(), './src/services'),
      '@utils': path.resolve(process.cwd(), './src/utils'),
    },
  },
});
