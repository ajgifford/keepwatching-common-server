import {
  MockAccountService,
  MockContentDiscoveryService,
  MockContentUpdatesService,
  MockEpisodesService,
  MockErrorService,
  MockMoviesService,
  MockNotificationsService,
  MockProfileService,
  MockSeasonsService,
  MockShowService,
  MockSocketService,
  MockStatisticsService,
  MockTMDBService,
  createTypedServiceMock,
} from './mockFactory';

export const accountService = createTypedServiceMock<MockAccountService>([
  'login',
  'register',
  'googleLogin',
  'logout',
  'editAccount',
]);

export const profileService: MockProfileService = createTypedServiceMock<MockProfileService>([
  'getProfilesByAccountId',
  'getProfile',
  'findProfileById',
  'createProfile',
  'updateProfileName',
  'updateProfileImage',
  'deleteProfile',
  'createProfileObject',
  'invalidateProfileCache',
]);

export const showService: MockShowService = createTypedServiceMock<MockShowService>([
  'getShowsForProfile',
  'getShowDetailsForProfile',
  'getEpisodesForProfile',
  'getNextUnwatchedEpisodesForProfile',
  'addShowToFavorites',
  'removeShowFromFavorites',
  'updateShowWatchStatus',
  'updateShowWatchStatusForNewContent',
  'getShowRecommendations',
  'getSimilarShows',
  'getProfileShowStatistics',
  'getProfileWatchProgress',
  'invalidateProfileCache',
  'invalidateAccountCache',
]);

export const moviesService: MockMoviesService = createTypedServiceMock<MockMoviesService>([
  'getMoviesForProfile',
  'getRecentMoviesForProfile',
  'getUpcomingMoviesForProfile',
  'addMovieToFavorites',
  'removeMovieFromFavorites',
  'updateMovieWatchStatus',
  'getProfileMovieStatistics',
  'invalidateProfileMovieCache',
  'invalidateAccountCache',
]);

export const statisticsService: MockStatisticsService = createTypedServiceMock<MockStatisticsService>([
  'getProfileStatistics',
  'getAccountStatistics',
]);

export const episodesService: MockEpisodesService = createTypedServiceMock<MockEpisodesService>([
  'updateEpisodeWatchStatus',
  'updateNextEpisodeWatchStatus',
  'getEpisodesForSeason',
  'getUpcomingEpisodesForProfile',
  'getRecentEpisodesForProfile',
]);

export const seasonsService: MockSeasonsService = createTypedServiceMock<MockSeasonsService>([
  'updateSeasonWatchStatus',
  'getSeasonsForShow',
  'updateSeasonWatchStatusForNewEpisodes',
]);

export const contentDiscoveryService: MockContentDiscoveryService = createTypedServiceMock<MockContentDiscoveryService>(
  ['discoverTopContent', 'discoverChangesContent', 'discoverTrendingContent', 'searchMedia'],
);

export const notificationsService: MockNotificationsService = createTypedServiceMock<MockNotificationsService>([
  'getNotifications',
  'dismissNotification',
  'getAllNotifications',
  'addNotification',
  'updateNotification',
  'deleteNotification',
]);

export const contentUpdatesService: MockContentUpdatesService = createTypedServiceMock<MockContentUpdatesService>([
  'updateMovies',
  'updateShows',
]);

// Utility services with custom implementations
export const errorService: MockErrorService = {
  handleError: jest.fn((error) => {
    throw error;
  }),
  assertExists: jest.fn((item, entityName, id) => {
    if (!item) throw new Error(`${entityName} with ID ${id} not found`);
    return item;
  }),
  assertNotExists: jest.fn((item, entityName, fieldName, fieldValue) => {
    if (item) throw new Error(`${entityName} with ${fieldName} ${fieldValue} already exists`);
  }),
};

// Create the mock socket service with proper typing
export const socketService: MockSocketService = {
  getInstance: jest.fn(() => socketService),
  initialize: jest.fn(),
  notifyShowsUpdate: jest.fn(),
  notifyMoviesUpdate: jest.fn(),
  notifyShowDataLoaded: jest.fn(),
  disconnectUserSockets: jest.fn(),
  isInitialized: jest.fn(() => true),
  getServer: jest.fn(),
};

// Mocks for database functions
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

// Create a mock CacheService
export class CacheService {
  private static instance: CacheService;

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  getOrSet = jest.fn().mockImplementation((key, fn, ttl) => fn());
  get = jest.fn();
  set = jest.fn();
  invalidate = jest.fn();
  invalidatePattern = jest.fn();
  invalidateAccount = jest.fn();
  invalidateProfile = jest.fn();
  invalidateProfileShows = jest.fn();
  invalidateProfileMovies = jest.fn();
  invalidateProfileStatistics = jest.fn();
  invalidateAccountStatistics = jest.fn();
  flushAll = jest.fn();
  getStats = jest.fn();
  keys = jest.fn();
}

// Mock TMDB service
export const getTMDBService = jest.fn(
  (): MockTMDBService => ({
    searchShows: jest.fn(),
    searchMovies: jest.fn(),
    getShowDetails: jest.fn(),
    getMovieDetails: jest.fn(),
    getSeasonDetails: jest.fn(),
    getTrending: jest.fn(),
    getShowRecommendations: jest.fn(),
    getMovieRecommendations: jest.fn(),
    getSimilarShows: jest.fn(),
    getSimilarMovies: jest.fn(),
    getShowChanges: jest.fn(),
    getMovieChanges: jest.fn(),
    getSeasonChanges: jest.fn(),
    clearCache: jest.fn(),
  }),
);

// Mock StreamingAvailabilityService
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

// Mock utility functions
export const buildTMDBImagePath = jest.fn((path, size = 'w185') => `https://image.tmdb.org/t/p/${size}${path}`);

export const getProfileImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));

export const getAccountImage = jest.fn((image, name) => (image ? `image-url/${image}` : `default-image/${name}`));

export const getPhotoForGoogleAccount = jest.fn((name, photoURL, image) =>
  image ? `image-url/${image}` : (photoURL ?? `default-image/${name}`),
);

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

export const generateGenreArrayFromIds = jest.fn((genreIds) => {
  // Mock implementation that returns fake genre names
  return genreIds.map((id) => `Genre-${id}`);
});

export const filterUSOrEnglishShows = jest.fn((shows) => {
  // Mock implementation that returns the input array
  return shows;
});

export const isRetriableError = jest.fn(() => false);
export const isRetriableStatus = jest.fn(() => false);
export const calculateRetryDelay = jest.fn(() => 1000);
export const withRetry = jest.fn(async (fn) => fn());

// Export mock middleware
export const errorHandler = jest.fn();

// Export error classes
export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errorCode: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, originalError: any) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class TransientApiError extends CustomError {
  constructor(
    message: string,
    public statusCode: number = 503,
    public retryAfter: number = 60,
  ) {
    super(message, statusCode, 'TRANSIENT_API_ERROR');
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class NoAffectedRowsError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'NO_AFFECTED_ROWS');
  }
}
