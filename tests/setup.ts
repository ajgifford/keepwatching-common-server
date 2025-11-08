import { afterEach, beforeEach, vi } from 'vitest';

// Set a longer timeout for certain tests
vi.setConfig({ testTimeout: 10000 });

// Global setup before each test
beforeEach(() => {
  // Ensure we start with a clean state
  vi.clearAllMocks();
});

// Global cleanup after each test to prevent memory leaks and hanging processes
afterEach(() => {
  // Clear all mocks (already configured in vitest.config.ts with clearMocks: true)
  vi.clearAllMocks();

  // Reset all modules to prevent state leakage between tests
  vi.resetModules();

  // Restore real timers to prevent timer-related issues
  // This is critical for tests that use vi.useFakeTimers()
  vi.useRealTimers();
});
