/**
 * Creates mock functions for all methods of a service
 * @param methodNames Array of method names to mock
 * @returns Object with mocked methods
 */
export function createTypedServiceMock<T>(methodNames: Array<keyof T>): T {
  const mock: Record<string, jest.Mock> = {};
  for (const methodName of methodNames) {
    mock[methodName as string] = jest.fn();
  }
  return mock as unknown as T;
}

// Define interfaces for your mock services
// These provide proper typing for external projects using your mocks

export interface MockAccountService {
  login: jest.Mock;
  register: jest.Mock;
  googleLogin: jest.Mock;
  logout: jest.Mock;
  getAccounts: jest.Mock;
  editAccount: jest.Mock;
  deleteAccount: jest.Mock;
  findAccountById: jest.Mock;
  findAccountIdByProfileId: jest.Mock;
  updateAccountImage: jest.Mock;
}

export interface MockProfileService {
  getProfilesByAccountId: jest.Mock;
  getProfileWithContent: jest.Mock;
  findProfileById: jest.Mock;
  createProfile: jest.Mock;
  updateProfileName: jest.Mock;
  updateProfileImage: jest.Mock;
  deleteProfile: jest.Mock;
  createProfileObject: jest.Mock;
  invalidateProfileCache: jest.Mock;
}

export interface MockAdminShowService {
  getAllShows: jest.Mock;
  getAllShowReferences: jest.Mock;
  getShowDetails: jest.Mock;
  getShowSeasons: jest.Mock;
  getShowSeasonsWithEpisodes: jest.Mock;
  getSeasonEpisodes: jest.Mock;
  getShowProfiles: jest.Mock;
  getShowWatchProgress: jest.Mock;
  getCompleteShowInfo: jest.Mock;
  invalidateShowCache: jest.Mock;
}

export interface MockAdminMovieService {
  getAllMovies: jest.Mock;
  getMovieDetails: jest.Mock;
  getMovieProfiles: jest.Mock;
  getMovieWatchProgress: jest.Mock;
  getCompleteMovieInfo: jest.Mock;
  invalidateMovieCache: jest.Mock;
}

export interface MockShowService {
  getShowsForProfile: jest.Mock;
  getShowDetailsForProfile: jest.Mock;
  getShowCastMembers: jest.Mock;
  getEpisodesForProfile: jest.Mock;
  getNextUnwatchedEpisodesForProfile: jest.Mock;
  addShowToFavorites: jest.Mock;
  removeShowFromFavorites: jest.Mock;
  updateShowWatchStatus: jest.Mock;
  updateShowWatchStatusForNewContent: jest.Mock;
  getShowRecommendations: jest.Mock;
  getSimilarShows: jest.Mock;
  getProfileShowStatistics: jest.Mock;
  getProfileWatchProgress: jest.Mock;
  invalidateProfileCache: jest.Mock;
  invalidateAccountCache: jest.Mock;
}

export interface MockMoviesService {
  getMoviesForProfile: jest.Mock;
  getMovieCastMembers: jest.Mock;
  getRecentMoviesForProfile: jest.Mock;
  getUpcomingMoviesForProfile: jest.Mock;
  addMovieToFavorites: jest.Mock;
  removeMovieFromFavorites: jest.Mock;
  updateMovieWatchStatus: jest.Mock;
  getProfileMovieStatistics: jest.Mock;
  invalidateProfileMovieCache: jest.Mock;
  invalidateAccountCache: jest.Mock;
}

export interface MockEpisodesService {
  updateEpisodeWatchStatus: jest.Mock;
  updateNextEpisodeWatchStatus: jest.Mock;
  getEpisodesForSeason: jest.Mock;
  getUpcomingEpisodesForProfile: jest.Mock;
  getRecentEpisodesForProfile: jest.Mock;
}

export interface MockSeasonsService {
  updateSeasonWatchStatus: jest.Mock;
  getSeasonsForShow: jest.Mock;
  updateSeasonWatchStatusForNewEpisodes: jest.Mock;
}

export interface MockStatisticsService {
  getProfileStatistics: jest.Mock;
  getAccountStatistics: jest.Mock;
}

export interface MockContentDiscoveryService {
  discoverTopContent: jest.Mock;
  discoverChangesContent: jest.Mock;
  discoverTrendingContent: jest.Mock;
  searchMedia: jest.Mock;
}

export interface MockNotificationsService {
  getNotifications: jest.Mock;
  dismissNotification: jest.Mock;
  getAllNotifications: jest.Mock;
  addNotification: jest.Mock;
  updateNotification: jest.Mock;
  deleteNotification: jest.Mock;
}

export interface MockContentUpdatesService {
  updateMovies: jest.Mock;
  updateMovieById: jest.Mock;
  updateShows: jest.Mock;
  updateShowById: jest.Mock;
}

export interface MockScheduledJobsService {
  runShowsUpdateJob: jest.Mock;
  runMoviesUpdateJob: jest.Mock;
  runEmailDigestJob: jest.Mock;
  getNextScheduledRun: jest.Mock;
  initScheduledJobs: jest.Mock;
  getJobsStatus: jest.Mock;
  pauseJobs: jest.Mock;
  resumeJobs: jest.Mock;
  shutdownJobs: jest.Mock;
}

export interface MockErrorService {
  handleError: jest.Mock;
  assertExists: jest.Mock;
  assertNotExists: jest.Mock;
}

export interface MockSocketService {
  getInstance: jest.Mock;
  initialize: jest.Mock;
  notifyShowsUpdate: jest.Mock;
  notifyMoviesUpdate: jest.Mock;
  notifyShowDataLoaded: jest.Mock;
  disconnectUserSockets: jest.Mock;
  isInitialized: jest.Mock;
  getServer: jest.Mock;
}

export interface MockTMDBService {
  searchShows: jest.Mock;
  searchMovies: jest.Mock;
  getShowDetails: jest.Mock;
  getMovieDetails: jest.Mock;
  getSeasonDetails: jest.Mock;
  getTrending: jest.Mock;
  getShowRecommendations: jest.Mock;
  getMovieRecommendations: jest.Mock;
  getSimilarShows: jest.Mock;
  getSimilarMovies: jest.Mock;
  getShowChanges: jest.Mock;
  getMovieChanges: jest.Mock;
  getSeasonChanges: jest.Mock;
  clearCache: jest.Mock;
}

export interface MockCacheService {
  getOrSet: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  invalidate: jest.Mock;
  invalidatePattern: jest.Mock;
  invalidateAccount: jest.Mock;
  invalidateProfile: jest.Mock;
  invalidateProfileShows: jest.Mock;
  invalidateProfileMovies: jest.Mock;
  invalidateProfileStatistics: jest.Mock;
  invalidateAccountStatistics: jest.Mock;
  flushAll: jest.Mock;
  getStats: jest.Mock;
  keys: jest.Mock;
}

export interface MockDatabaseService {
  getInstance: jest.Mock;
  getPool: jest.Mock;
  isInShutdownMode: jest.Mock;
  shutdown: jest.Mock;
  static: {
    reset: jest.Mock;
  };
}
