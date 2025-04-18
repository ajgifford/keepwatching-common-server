import {
  MockAccountService,
  MockCacheService,
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

// Create and export mock services that can be used by external projects
export const accountService = createTypedServiceMock<MockAccountService>([
  'login',
  'register',
  'googleLogin',
  'logout',
  'editAccount',
]);

export const profileService = createTypedServiceMock<MockProfileService>([
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

export const showService = createTypedServiceMock<MockShowService>([
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

export const moviesService = createTypedServiceMock<MockMoviesService>([
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

export const statisticsService = createTypedServiceMock<MockStatisticsService>([
  'getProfileStatistics',
  'getAccountStatistics',
]);

export const episodesService = createTypedServiceMock<MockEpisodesService>([
  'updateEpisodeWatchStatus',
  'updateNextEpisodeWatchStatus',
  'getEpisodesForSeason',
  'getUpcomingEpisodesForProfile',
  'getRecentEpisodesForProfile',
]);

export const seasonsService = createTypedServiceMock<MockSeasonsService>([
  'updateSeasonWatchStatus',
  'getSeasonsForShow',
  'updateSeasonWatchStatusForNewEpisodes',
]);

export const contentDiscoveryService = createTypedServiceMock<MockContentDiscoveryService>([
  'discoverTopContent',
  'discoverChangesContent',
  'discoverTrendingContent',
  'searchMedia',
]);

export const notificationsService = createTypedServiceMock<MockNotificationsService>([
  'getNotifications',
  'dismissNotification',
  'getAllNotifications',
  'addNotification',
  'updateNotification',
  'deleteNotification',
]);

export const contentUpdatesService = createTypedServiceMock<MockContentUpdatesService>(['updateMovies', 'updateShows']);

// Custom implementations for services that need special handling
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

// Socket service mock
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

// Factory function for CacheService mock
export const mockCacheService = (): MockCacheService => ({
  getOrSet: jest.fn().mockImplementation((key, fn) => fn()),
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  invalidatePattern: jest.fn(),
  invalidateAccount: jest.fn(),
  invalidateProfile: jest.fn(),
  invalidateProfileShows: jest.fn(),
  invalidateProfileMovies: jest.fn(),
  invalidateProfileStatistics: jest.fn(),
  invalidateAccountStatistics: jest.fn(),
  flushAll: jest.fn(),
  getStats: jest.fn(),
  keys: jest.fn(),
});

// CacheService class with mock implementation
export class CacheService {
  private static instance: CacheService;
  public mockImpl: MockCacheService;

  constructor() {
    this.mockImpl = mockCacheService();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  getOrSet = (...args: any[]) => this.mockImpl.getOrSet(...args);
  get = (...args: any[]) => this.mockImpl.get(...args);
  set = (...args: any[]) => this.mockImpl.set(...args);
  invalidate = (...args: any[]) => this.mockImpl.invalidate(...args);
  invalidatePattern = (...args: any[]) => this.mockImpl.invalidatePattern(...args);
  invalidateAccount = (...args: any[]) => this.mockImpl.invalidateAccount(...args);
  invalidateProfile = (...args: any[]) => this.mockImpl.invalidateProfile(...args);
  invalidateProfileShows = (...args: any[]) => this.mockImpl.invalidateProfileShows(...args);
  invalidateProfileMovies = (...args: any[]) => this.mockImpl.invalidateProfileMovies(...args);
  invalidateProfileStatistics = (...args: any[]) => this.mockImpl.invalidateProfileStatistics(...args);
  invalidateAccountStatistics = (...args: any[]) => this.mockImpl.invalidateAccountStatistics(...args);
  flushAll = (...args: any[]) => this.mockImpl.flushAll(...args);
  getStats = (...args: any[]) => this.mockImpl.getStats(...args);
  keys = (...args: any[]) => this.mockImpl.keys(...args);
}

// Factory function for TMDB service
export const getTMDBService = jest.fn(() => ({
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
}));
