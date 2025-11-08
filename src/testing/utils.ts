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
