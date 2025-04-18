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
