import { afterEach, vi } from 'vitest';

// Set a longer timeout for certain tests
vi.setConfig({ testTimeout: 10000 });

// vi.mock('mysql2/promise', () => ({
//   default: {
//     createPool: vi.fn(() => ({
//       query: vi.fn().mockResolvedValue([]),
//       execute: vi.fn().mockResolvedValue([]),
//       end: vi.fn().mockResolvedValue(undefined),
//     })),
//   },
//   createPool: vi.fn(() => ({
//     query: vi.fn().mockResolvedValue([]),
//     execute: vi.fn().mockResolvedValue([]),
//     end: vi.fn().mockResolvedValue(undefined),
//   })),
// }));

// vi.mock('ioredis', () => ({
//   default: vi.fn().mockImplementation(() => ({
//     get: vi.fn(),
//     set: vi.fn(),
//     del: vi.fn(),
//     on: vi.fn(),
//     multi: vi.fn(),
//     hgetall: vi.fn(),
//     keys: vi.fn(),
//     quit: vi.fn().mockResolvedValue(undefined),
//     connect: vi.fn().mockResolvedValue(undefined),
//   })),
// }));

// Mock dbMonitoring globally to prevent Redis connections during tests
// vi.mock('@utils/dbMonitoring', () => {
//   const mockInstance = {
//     executeWithTiming: vi.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
//       return await queryFn();
//     }),
//     getStats: vi.fn().mockResolvedValue([]),
//     logStats: vi.fn().mockResolvedValue(undefined),
//     clearStats: vi.fn().mockResolvedValue(undefined),
//     disconnect: vi.fn().mockResolvedValue(undefined),
//   };

//   return {
//     DbMonitor: {
//       getInstance: vi.fn(() => mockInstance),
//       resetInstance: vi.fn(),
//     },
//   };
// });

// Global cleanup after each test to prevent memory leaks and hanging processes
afterEach(() => {
  vi.clearAllMocks();
  // Don't use vi.restoreAllMocks() or vi.resetModules() as they clear global mocks
  vi.useRealTimers();
});
