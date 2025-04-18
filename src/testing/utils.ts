// Mock utility functions for external projects

// Image utility mocks
export const buildTMDBImagePath = jest.fn((path, size = 'w185') => `https://image.tmdb.org/t/p/${size}${path}`);
export const getProfileImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getAccountImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));
export const getPhotoForGoogleAccount = jest.fn((name, photoURL, image) =>
  image ? `image-url/${image}` : (photoURL ?? `default-image/${name}`),
);

// Database utility mocks
export const getDbPool = jest.fn(() => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn(() => ({
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    execute: jest.fn(),
    query: jest.fn(),
  })),
}));
export const createDbPool = jest.fn(getDbPool);
export const resetDbPool = jest.fn();

// Genre utility mocks
export const generateGenreArrayFromIds = jest.fn((genreIds) => {
  // Mock implementation that returns fake genre names
  return genreIds.map((id: any) => `Genre-${id}`);
});

// Filter utility mocks
export const filterUSOrEnglishShows = jest.fn((shows) => {
  // Mock implementation that returns the input array
  return shows;
});

// Retry utility mocks
export const isRetriableError = jest.fn(() => false);
export const isRetriableStatus = jest.fn(() => false);
export const calculateRetryDelay = jest.fn(() => 1000);
export const withRetry = jest.fn(async (fn) => fn());

// Date range utility mock
export const generateDateRange = jest.fn((lookBackDays) => {
  const currentDate = new Date();
  const pastDate = new Date();
  pastDate.setDate(currentDate.getDate() - lookBackDays);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    currentDate: formatDate(currentDate),
    pastDate: formatDate(pastDate),
  };
});

// Sleep utility mock
export const sleep = jest.fn((ms: number) => Promise.resolve());

// Transaction helper mock
export class TransactionHelper {
  executeInTransaction = jest.fn(async (callback) => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      execute: jest.fn().mockReturnValue([{ insertId: 1, affectedRows: 1 }]),
      query: jest.fn().mockReturnValue([[{ id: 1 }]]),
    };
    return await callback(connection);
  });
}

// Content utility mocks
export const getUSNetwork = jest.fn((networks) => networks[0]?.name || null);
export const getUSRating = jest.fn(() => 'TV-G');
export const getInProduction = jest.fn((show) => (show.in_production ? 1 : 0));
export const getEpisodeToAirId = jest.fn((episode) => episode?.id || null);
export const getUSMPARating = jest.fn(() => 'PG');
export const stripPrefix = jest.fn((input) => input.replace(/^(tv\/|movie\/)/, ''));
export const getStreamingPremieredDate = jest.fn((showType, result) =>
  showType === 'movie' ? result.releaseYear : result.firstAirYear,
);
export const getTMDBPremieredDate = jest.fn((showType, result) =>
  showType === 'movie' ? result.release_date : result.first_air_date,
);
export const getTMDBItemName = jest.fn((searchType, result) => (searchType === 'movie' ? result.title : result.name));

// Watch providers utility mocks
export const getCachedStreamingServiceIds = jest.fn(() => [8, 9, 337, 350, 1899]);
export const setCachedStreamingServiceIds = jest.fn();
export const getUSWatchProviders = jest.fn((content, defaultProvider) => [defaultProvider]);
export const loadStreamingService = jest.fn();

// Streaming service mock class
export class StreamingAvailabilityService {
  private static instance: StreamingAvailabilityService;
  private client = {
    showsApi: {
      getTopShows: jest.fn(),
    },
    changesApi: {
      getChanges: jest.fn(),
    },
  };

  static getInstance(): StreamingAvailabilityService {
    if (!StreamingAvailabilityService.instance) {
      StreamingAvailabilityService.instance = new StreamingAvailabilityService();
    }
    return StreamingAvailabilityService.instance;
  }

  getClient() {
    return this.client;
  }
}
