import { vi } from 'vitest';

// Image utility mocks
export const getProfileImage = vi.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getAccountImage = vi.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getPhotoForGoogleAccount = vi.fn((name, photoURL, image) =>
  image ? `image-url/${image}` : (photoURL ?? `default-image/${name}`),
);

// Watch providers utility mocks
export const getCachedStreamingServiceIds = vi.fn(() => [8, 9, 337, 350, 1899]);
export const setCachedStreamingServiceIds = vi.fn();
export const getUSWatchProviders = vi.fn((content, defaultProvider) => [defaultProvider]);
export const loadStreamingService = vi.fn();

// Firebase mocks
export const initializeFirebase = vi.fn();
export const getFirebaseAdmin = vi.fn();

// DbMonitor mock - simple implementation that just executes the query
export const mockDbMonitorInstance = {
  executeWithTiming: vi.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
    return await queryFn();
  }),
  getStats: vi.fn().mockResolvedValue([]),
  logStats: vi.fn().mockResolvedValue(undefined),
  clearStats: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

export const DbMonitor = {
  getInstance: vi.fn(() => mockDbMonitorInstance),
  createInstance: vi.fn(() => mockDbMonitorInstance),
  resetInstance: vi.fn(),
};
