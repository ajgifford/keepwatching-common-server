import {
  MockAccountService,
  MockAdminMovieService,
  MockAdminShowService,
  MockCacheService,
  MockContentDiscoveryService,
  MockContentUpdatesService,
  MockEpisodesService,
  MockErrorService,
  MockMoviesService,
  MockNotificationsService,
  MockProfileService,
  MockScheduledJobsService,
  MockSeasonsService,
  MockShowService,
  MockSocketService,
  MockStatisticsService,
  createTypedServiceMock,
} from './mockFactory';

// Create and export mock services that can be used by external projects
export const accountService = createTypedServiceMock<MockAccountService>([
  'login',
  'register',
  'googleLogin',
  'logout',
  'getAccounts',
  'editAccount',
  'deleteAccount',
  'findAccountById',
  'findAccountIdByProfileId',
  'updateAccountImage',
]);

export const profileService = createTypedServiceMock<MockProfileService>([
  'getProfilesByAccountId',
  'getProfileWithContent',
  'findProfileById',
  'createProfile',
  'updateProfileName',
  'updateProfileImage',
  'deleteProfile',
  'createProfileObject',
  'invalidateProfileCache',
]);

export const adminMovieService = createTypedServiceMock<MockAdminMovieService>([
  'getAllMovies',
  'getMovieDetails',
  'getMovieProfiles',
  'getMovieWatchProgress',
  'getCompleteMovieInfo',
  'invalidateMovieCache',
]);

export const adminShowService = createTypedServiceMock<MockAdminShowService>([
  'getAllShows',
  'getAllShowReferences',
  'getShowDetails',
  'getShowSeasons',
  'getShowSeasonsWithEpisodes',
  'getSeasonEpisodes',
  'getShowProfiles',
  'getShowWatchProgress',
  'getCompleteShowInfo',
  'invalidateShowCache',
]);

export const showService = createTypedServiceMock<MockShowService>([
  'getShowsForProfile',
  'getShowDetailsForProfile',
  'getShowCastMembers',
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
  'getMovieCastMembers',
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

export const contentUpdatesService = createTypedServiceMock<MockContentUpdatesService>([
  'updateMovies',
  'updateMovieById',
  'updateShows',
  'updateShowById',
]);

export const scheduledJobsService = createTypedServiceMock<MockScheduledJobsService>([
  'runShowsUpdateJob',
  'runMoviesUpdateJob',
  'runEmailDigestJob',
  'getNextScheduledRun',
  'initScheduledJobs',
  'getJobsStatus',
  'pauseJobs',
  'resumeJobs',
  'shutdownJobs',
]);

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

export const databaseService = {
  getInstance: jest.fn().mockReturnThis(),
  getPool: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue([[], []]),
    query: jest.fn().mockResolvedValue([[], []]),
    getConnection: jest.fn().mockResolvedValue({
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      execute: jest.fn().mockResolvedValue([[], []]),
      query: jest.fn().mockResolvedValue([[], []]),
    }),
    end: jest.fn().mockResolvedValue(undefined),
  }),
  isInShutdownMode: jest.fn().mockReturnValue(false),
  shutdown: jest.fn().mockResolvedValue(undefined),
  static: {
    reset: jest.fn(),
  },
  // Helper for setting up test data
  setupMockData: jest.fn((data = {}) => {
    databaseService.getPool().query.mockImplementation((sql: any) => {
      // Simple parsing of SQL to determine which table's data to return
      const tableMatch = sql.toString().match(/from\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1] : null;
      return Promise.resolve([data[table] || [], []]);
    });

    databaseService.getPool().execute.mockImplementation((sql: any) => {
      if (sql.toString().match(/^insert/i)) {
        return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
      } else if (sql.toString().match(/^update|delete/i)) {
        return Promise.resolve([{ affectedRows: 1 }, []]);
      } else {
        const tableMatch = sql.toString().match(/from\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        return Promise.resolve([data[table] || [], []]);
      }
    });
  }),
  // Helper to reset mocks
  clearMocks: jest.fn(() => {
    databaseService.getPool().query.mockReset().mockResolvedValue([[], []]);
    databaseService.getPool().execute.mockReset().mockResolvedValue([[], []]);
  }),
};
