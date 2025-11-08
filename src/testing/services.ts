import {
  MockAccountService,
  MockAccountStatisticsService,
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
  MockProfileStatisticsService,
  MockScheduledJobsService,
  MockSeasonsService,
  MockShowService,
  MockSocketService,
  createTypedServiceMock,
} from './mockFactory';
import { vi } from 'vitest';

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

export const accountStatisticsService = createTypedServiceMock<MockAccountStatisticsService>([
  'getAccountStatistics',
  'getAccountWatchingVelocity',
  `getAccountActivityTimeline`,
  `getAccountBingeWatchingStats`,
  `getAccountWatchStreakStats`,
  `getAccountTimeToWatchStats`,
  `getAccountSeasonalViewingStats`,
  `getAccountMilestoneStats`,
  `getAccountContentDepthStats`,
  `getAccountContentDiscoveryStats`,
  `getAccountAbandonmentRiskStats`,
  `getAccountUnairedContentStats`,
  'getProfileComparison',
]);

export const profileStatisticsService = createTypedServiceMock<MockProfileStatisticsService>([
  'getProfileStatistics',
  `getWatchingVelocity`,
  `getDailyActivity`,
  `getWeeklyActivity`,
  `getMonthlyActivity`,
  `getActivityTimeline`,
  `getBingeWatchingStats`,
  `getWatchStreakStats`,
  `getTimeToWatchStats`,
  `getSeasonalViewingStats`,
  `getMilestoneStats`,
  `getContentDepthStats`,
  `getContentDiscoveryStats`,
  `getAbandonmentRiskStats`,
  `getUnairedContentStats`,
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
  handleError: vi.fn((error) => {
    throw error;
  }),
  assertExists: vi.fn((item, entityName, id) => {
    if (!item) throw new Error(`${entityName} with ID ${id} not found`);
    return item;
  }),
  assertNotExists: vi.fn((item, entityName, fieldName, fieldValue) => {
    if (item) throw new Error(`${entityName} with ${fieldName} ${fieldValue} already exists`);
  }),
};

// Socket service mock
export const socketService: MockSocketService = {
  getInstance: vi.fn(() => socketService),
  initialize: vi.fn(),
  notifyShowsUpdate: vi.fn(),
  notifyMoviesUpdate: vi.fn(),
  notifyShowDataLoaded: vi.fn(),
  disconnectUserSockets: vi.fn(),
  isInitialized: vi.fn(() => true),
  getServer: vi.fn(),
};

// Factory function for CacheService mock
export const mockCacheService = (): MockCacheService => ({
  getOrSet: vi.fn().mockImplementation((key, fn) => fn()),
  get: vi.fn(),
  set: vi.fn(),
  invalidate: vi.fn(),
  invalidatePattern: vi.fn(),
  invalidateAccount: vi.fn(),
  invalidateProfile: vi.fn(),
  invalidateProfileShows: vi.fn(),
  invalidateProfileMovies: vi.fn(),
  invalidateProfileStatistics: vi.fn(),
  invalidateAccountStatistics: vi.fn(),
  flushAll: vi.fn(),
  getStats: vi.fn(),
  keys: vi.fn(),
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

export const getTMDBService = vi.fn(() => ({
  searchShows: vi.fn(),
  searchMovies: vi.fn(),
  getShowDetails: vi.fn(),
  getMovieDetails: vi.fn(),
  getSeasonDetails: vi.fn(),
  getTrending: vi.fn(),
  getShowRecommendations: vi.fn(),
  getMovieRecommendations: vi.fn(),
  getSimilarShows: vi.fn(),
  getSimilarMovies: vi.fn(),
  getShowChanges: vi.fn(),
  getMovieChanges: vi.fn(),
  getSeasonChanges: vi.fn(),
  clearCache: vi.fn(),
}));

export const databaseService = {
  getInstance: vi.fn().mockReturnThis(),
  getPool: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue([[], []]),
    query: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn().mockResolvedValue({
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      execute: vi.fn().mockResolvedValue([[], []]),
      query: vi.fn().mockResolvedValue([[], []]),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  }),
  isInShutdownMode: vi.fn().mockReturnValue(false),
  shutdown: vi.fn().mockResolvedValue(undefined),
  static: {
    reset: vi.fn(),
  },
  // Helper for setting up test data
  setupMockData: vi.fn((data = {}) => {
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
  clearMocks: vi.fn(() => {
    databaseService.getPool().query.mockReset().mockResolvedValue([[], []]);
    databaseService.getPool().execute.mockReset().mockResolvedValue([[], []]);
  }),
};
