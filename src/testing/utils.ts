// Image utility mocks
export const getProfileImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getAccountImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getPhotoForGoogleAccount = jest.fn((name, photoURL, image) =>
  image ? `image-url/${image}` : (photoURL ?? `default-image/${name}`),
);

// Watch providers utility mocks
export const getCachedStreamingServiceIds = jest.fn(() => [8, 9, 337, 350, 1899]);
export const setCachedStreamingServiceIds = jest.fn();
export const getUSWatchProviders = jest.fn((content, defaultProvider) => [defaultProvider]);
export const loadStreamingService = jest.fn();

// Firebase mocks
export const initializeFirebase = jest.fn();
export const getFirebaseAdmin = jest.fn();

// DbMonitor mock - simple implementation that just executes the query
export const mockDbMonitorInstance = {
  executeWithTiming: jest.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
    return await queryFn();
  }),
  getStats: jest.fn().mockResolvedValue([]),
  logStats: jest.fn().mockResolvedValue(undefined),
  clearStats: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

export const DbMonitor = {
  getInstance: jest.fn(() => mockDbMonitorInstance),
  createInstance: jest.fn(() => mockDbMonitorInstance),
  resetInstance: jest.fn(),
};
