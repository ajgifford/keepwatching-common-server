import { MediaType } from '../../src/services/contentDiscoveryService';
import {
  DiscoverAndSearchResponse,
  DiscoverAndSearchResult,
  DiscoverChangesQuery,
  DiscoverTopQuery,
  DiscoverTrendingQuery,
} from '../../src/types/discoverAndSearchTypes';
import { ProfileMovie, RecentMovie, UpcomingMovie } from '../../src/types/movieTypes';
import { AccountNotification, AdminNotification } from '../../src/types/notificationTypes';
import {
  ContinueWatchingShow,
  NextEpisode,
  ProfileEpisode,
  ProfileSeason,
  ProfileShow,
  ProfileShowWithSeasons,
} from '../../src/types/showTypes';

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

export interface MockAccountService {
  login: jest.Mock<Promise<any>>;
  register: jest.Mock<Promise<any>>;
  googleLogin: jest.Mock<Promise<any>>;
  logout: jest.Mock<Promise<void>>;
  editAccount: jest.Mock<Promise<any>>;
}

export interface MockProfileService {
  getProfilesByAccountId: jest.Mock<Promise<any[]>>;
  getProfile: jest.Mock<Promise<any>>;
  findProfileById: jest.Mock<Promise<any | null>>;
  createProfile: jest.Mock<Promise<any>>;
  updateProfileName: jest.Mock<Promise<any>>;
  updateProfileImage: jest.Mock<Promise<any>>;
  deleteProfile: jest.Mock<Promise<boolean>>;
  createProfileObject: jest.Mock<any>;
  invalidateProfileCache: jest.Mock<void>;
}

export interface MockShowService {
  getShowsForProfile: jest.Mock<Promise<ProfileShow[]>>;
  getShowDetailsForProfile: jest.Mock<Promise<ProfileShowWithSeasons>>;
  getEpisodesForProfile: jest.Mock<
    Promise<{
      recentEpisodes: any[];
      upcomingEpisodes: any[];
      nextUnwatchedEpisodes: ContinueWatchingShow[];
    }>
  >;
  getNextUnwatchedEpisodesForProfile: jest.Mock<Promise<ContinueWatchingShow[]>>;
  addShowToFavorites: jest.Mock<Promise<any>>;
  removeShowFromFavorites: jest.Mock<Promise<any>>;
  updateShowWatchStatus: jest.Mock<Promise<boolean>>;
  updateShowWatchStatusForNewContent: jest.Mock<Promise<void>>;
  getShowRecommendations: jest.Mock<Promise<any[]>>;
  getSimilarShows: jest.Mock<Promise<any[]>>;
  getProfileShowStatistics: jest.Mock<Promise<any>>;
  getProfileWatchProgress: jest.Mock<Promise<any>>;
  invalidateProfileCache: jest.Mock<void>;
  invalidateAccountCache: jest.Mock<Promise<void>>;
}

export interface MockMoviesService {
  getMoviesForProfile: jest.Mock<Promise<ProfileMovie[]>>;
  getRecentMoviesForProfile: jest.Mock<Promise<RecentMovie[]>>;
  getUpcomingMoviesForProfile: jest.Mock<Promise<UpcomingMovie[]>>;
  addMovieToFavorites: jest.Mock<Promise<any>>;
  removeMovieFromFavorites: jest.Mock<Promise<any>>;
  updateMovieWatchStatus: jest.Mock<Promise<boolean>>;
  getProfileMovieStatistics: jest.Mock<Promise<any>>;
  invalidateProfileMovieCache: jest.Mock<void>;
  invalidateAccountCache: jest.Mock<Promise<void>>;
}

export interface MockStatisticsService {
  getProfileStatistics: jest.Mock<Promise<any>>;
  getAccountStatistics: jest.Mock<Promise<any>>;
}

export interface MockEpisodesService {
  updateEpisodeWatchStatus: jest.Mock<Promise<any>>;
  updateNextEpisodeWatchStatus: jest.Mock<Promise<any>>;
  getEpisodesForSeason: jest.Mock<Promise<ProfileEpisode[]>>;
  getUpcomingEpisodesForProfile: jest.Mock<Promise<any[]>>;
  getRecentEpisodesForProfile: jest.Mock<Promise<any[]>>;
}

export interface MockSeasonsService {
  updateSeasonWatchStatus: jest.Mock<Promise<boolean>>;
  getSeasonsForShow: jest.Mock<Promise<ProfileSeason[]>>;
  updateSeasonWatchStatusForNewEpisodes: jest.Mock<Promise<void>>;
}

export interface MockContentDiscoveryService {
  discoverTopContent: jest.Mock<Promise<DiscoverAndSearchResponse>>;
  discoverChangesContent: jest.Mock<Promise<DiscoverAndSearchResponse>>;
  discoverTrendingContent: jest.Mock<Promise<DiscoverAndSearchResponse>>;
  searchMedia: jest.Mock<Promise<any>>;
}

export interface MockNotificationsService {
  getNotifications: jest.Mock<Promise<AccountNotification[]>>;
  dismissNotification: jest.Mock<Promise<boolean>>;
  getAllNotifications: jest.Mock<Promise<AdminNotification[]>>;
  addNotification: jest.Mock<Promise<void>>;
  updateNotification: jest.Mock<Promise<AdminNotification>>;
  deleteNotification: jest.Mock<Promise<void>>;
}

export interface MockContentUpdatesService {
  updateMovies: jest.Mock<Promise<void>>;
  updateShows: jest.Mock<Promise<void>>;
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
