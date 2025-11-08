import { type Mock, vi } from 'vitest';

/**
 * Creates mock functions for all methods of a service
 * @param methodNames Array of method names to mock
 * @returns Object with mocked methods
 */
export function createTypedServiceMock<T>(methodNames: Array<keyof T>): T {
  const mock: Record<string, Mock> = {};
  for (const methodName of methodNames) {
    mock[methodName as string] = vi.fn();
  }
  return mock as unknown as T;
}

// Define interfaces for your mock services
// These provide proper typing for external projects using your mocks

export interface MockAccountService {
  login: Mock;
  register: Mock;
  googleLogin: Mock;
  logout: Mock;
  getAccounts: Mock;
  editAccount: Mock;
  deleteAccount: Mock;
  findAccountById: Mock;
  findAccountIdByProfileId: Mock;
  updateAccountImage: Mock;
}

export interface MockProfileService {
  getProfilesByAccountId: Mock;
  getProfileWithContent: Mock;
  findProfileById: Mock;
  createProfile: Mock;
  updateProfileName: Mock;
  updateProfileImage: Mock;
  deleteProfile: Mock;
  createProfileObject: Mock;
  invalidateProfileCache: Mock;
}

export interface MockAdminShowService {
  getAllShows: Mock;
  getAllShowReferences: Mock;
  getShowDetails: Mock;
  getShowSeasons: Mock;
  getShowSeasonsWithEpisodes: Mock;
  getSeasonEpisodes: Mock;
  getShowProfiles: Mock;
  getShowWatchProgress: Mock;
  getCompleteShowInfo: Mock;
  invalidateShowCache: Mock;
}

export interface MockAdminMovieService {
  getAllMovies: Mock;
  getMovieDetails: Mock;
  getMovieProfiles: Mock;
  getMovieWatchProgress: Mock;
  getCompleteMovieInfo: Mock;
  invalidateMovieCache: Mock;
}

export interface MockShowService {
  getShowsForProfile: Mock;
  getShowDetailsForProfile: Mock;
  getShowCastMembers: Mock;
  getEpisodesForProfile: Mock;
  getNextUnwatchedEpisodesForProfile: Mock;
  addShowToFavorites: Mock;
  removeShowFromFavorites: Mock;
  updateShowWatchStatus: Mock;
  updateShowWatchStatusForNewContent: Mock;
  getShowRecommendations: Mock;
  getSimilarShows: Mock;
  getProfileShowStatistics: Mock;
  getProfileWatchProgress: Mock;
  invalidateProfileCache: Mock;
  invalidateAccountCache: Mock;
}

export interface MockMoviesService {
  getMoviesForProfile: Mock;
  getMovieCastMembers: Mock;
  getRecentMoviesForProfile: Mock;
  getUpcomingMoviesForProfile: Mock;
  addMovieToFavorites: Mock;
  removeMovieFromFavorites: Mock;
  updateMovieWatchStatus: Mock;
  getProfileMovieStatistics: Mock;
  invalidateProfileMovieCache: Mock;
  invalidateAccountCache: Mock;
}

export interface MockEpisodesService {
  updateEpisodeWatchStatus: Mock;
  updateNextEpisodeWatchStatus: Mock;
  getEpisodesForSeason: Mock;
  getUpcomingEpisodesForProfile: Mock;
  getRecentEpisodesForProfile: Mock;
}

export interface MockSeasonsService {
  updateSeasonWatchStatus: Mock;
  getSeasonsForShow: Mock;
  updateSeasonWatchStatusForNewEpisodes: Mock;
}

export interface MockAccountStatisticsService {
  getAccountStatistics: Mock;
  getAccountWatchingVelocity: Mock;
  getAccountActivityTimeline: Mock;
  getAccountBingeWatchingStats: Mock;
  getAccountWatchStreakStats: Mock;
  getAccountTimeToWatchStats: Mock;
  getAccountSeasonalViewingStats: Mock;
  getAccountMilestoneStats: Mock;
  getAccountContentDepthStats: Mock;
  getAccountContentDiscoveryStats: Mock;
  getAccountAbandonmentRiskStats: Mock;
  getAccountUnairedContentStats: Mock;
  getProfileComparison: Mock;
}

export interface MockProfileStatisticsService {
  getProfileStatistics: Mock;
  getWatchingVelocity: Mock;
  getDailyActivity: Mock;
  getWeeklyActivity: Mock;
  getMonthlyActivity: Mock;
  getActivityTimeline: Mock;
  getBingeWatchingStats: Mock;
  getWatchStreakStats: Mock;
  getTimeToWatchStats: Mock;
  getSeasonalViewingStats: Mock;
  getMilestoneStats: Mock;
  getContentDepthStats: Mock;
  getContentDiscoveryStats: Mock;
  getAbandonmentRiskStats: Mock;
  getUnairedContentStats: Mock;
}

export interface MockContentDiscoveryService {
  discoverTopContent: Mock;
  discoverChangesContent: Mock;
  discoverTrendingContent: Mock;
  searchMedia: Mock;
}

export interface MockNotificationsService {
  getNotifications: Mock;
  dismissNotification: Mock;
  getAllNotifications: Mock;
  addNotification: Mock;
  updateNotification: Mock;
  deleteNotification: Mock;
}

export interface MockContentUpdatesService {
  updateMovies: Mock;
  updateMovieById: Mock;
  updateShows: Mock;
  updateShowById: Mock;
}

export interface MockScheduledJobsService {
  runShowsUpdateJob: Mock;
  runMoviesUpdateJob: Mock;
  runEmailDigestJob: Mock;
  getNextScheduledRun: Mock;
  initScheduledJobs: Mock;
  getJobsStatus: Mock;
  pauseJobs: Mock;
  resumeJobs: Mock;
  shutdownJobs: Mock;
}

export interface MockErrorService {
  handleError: Mock;
  assertExists: Mock;
  assertNotExists: Mock;
}

export interface MockSocketService {
  getInstance: Mock;
  initialize: Mock;
  notifyShowsUpdate: Mock;
  notifyMoviesUpdate: Mock;
  notifyShowDataLoaded: Mock;
  disconnectUserSockets: Mock;
  isInitialized: Mock;
  getServer: Mock;
}

export interface MockTMDBService {
  searchShows: Mock;
  searchMovies: Mock;
  getShowDetails: Mock;
  getMovieDetails: Mock;
  getSeasonDetails: Mock;
  getTrending: Mock;
  getShowRecommendations: Mock;
  getMovieRecommendations: Mock;
  getSimilarShows: Mock;
  getSimilarMovies: Mock;
  getShowChanges: Mock;
  getMovieChanges: Mock;
  getSeasonChanges: Mock;
  clearCache: Mock;
}

export interface MockCacheService {
  getOrSet: Mock;
  get: Mock;
  set: Mock;
  invalidate: Mock;
  invalidatePattern: Mock;
  invalidateAccount: Mock;
  invalidateProfile: Mock;
  invalidateProfileShows: Mock;
  invalidateProfileMovies: Mock;
  invalidateProfileStatistics: Mock;
  invalidateAccountStatistics: Mock;
  flushAll: Mock;
  getStats: Mock;
  keys: Mock;
}

export interface MockDatabaseService {
  getInstance: Mock;
  getPool: Mock;
  isInShutdownMode: Mock;
  shutdown: Mock;
  static: {
    reset: Mock;
  };
}
