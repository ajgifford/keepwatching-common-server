import { afterEach, vi } from 'vitest';

// Set a longer timeout for certain tests
vi.setConfig({ testTimeout: 10000 });

// Global cleanup after each test to prevent memory leaks and hanging processes
afterEach(() => {
  vi.clearAllMocks();
  //vi.restoreAllMocks()
  vi.resetModules();
  vi.useRealTimers();
});
