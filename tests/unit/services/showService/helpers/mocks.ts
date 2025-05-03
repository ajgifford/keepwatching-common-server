import { mockTMDBResponses } from './fixtures';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@services/profileService');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/seasonChangesService');
jest.mock('@services/socketService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  appLogger: {
    error: jest.fn(),
  },
}));

/**
 * Creates a mock Cache service for testing
 */
export function createMockCache() {
  return {
    getOrSet: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    invalidatePattern: jest.fn(),
    invalidateProfileShows: jest.fn(),
    invalidateAccount: jest.fn(),
    invalidateProfileMovies: jest.fn(),
    invalidateProfileStatistics: jest.fn(),
    invalidateAccountStatistics: jest.fn(),
    flushAll: jest.fn(),
    getStats: jest.fn(),
    keys: jest.fn(),
  } as any;
}

/**
 * Sets up common mocks with default behaviors
 */
export function setupMocks() {
  // Reset all mocks
  jest.clearAllMocks();

  // Set up error service to re-throw errors
  (errorService.handleError as jest.Mock).mockImplementation((error) => {
    throw error;
  });

  // Set up assertExists to pass through or throw as needed
  (errorService.assertExists as jest.Mock).mockImplementation((item) => {
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  });

  // Set up common content utility mocks
  (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
  (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
  (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
  (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
  (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

  // Set up TMDB service mock with default implementation
  (getTMDBService as jest.Mock).mockReturnValue({
    getShowDetails: jest.fn().mockResolvedValue(mockTMDBResponses.showDetails),
    getSeasonDetails: jest.fn().mockResolvedValue(mockTMDBResponses.seasonDetails),
    getShowRecommendations: jest.fn().mockResolvedValue(mockTMDBResponses.showRecommendations),
    getSimilarShows: jest.fn().mockResolvedValue(mockTMDBResponses.similarShows),
    getShowChanges: jest.fn().mockResolvedValue(mockTMDBResponses.showChanges),
  });

  // Set up Socket service mock with default implementation
  (socketService.notifyShowsUpdate as jest.Mock).mockImplementation(() => {});
  (socketService.notifyShowDataLoaded as jest.Mock).mockImplementation(() => {});
}

/**
 * Sets up ShowService with a mock cache
 * @returns Object containing the service instance and the mock cache
 */
export function setupShowService() {
  setupMocks();
  const mockCache = createMockCache();

  // Create a fresh instance to avoid test cross-contamination
  Object.setPrototypeOf(showService, ShowService.prototype);
  (showService as any).cache = mockCache;

  return {
    service: showService,
    mockCache,
  };
}

/**
 * Sets up mock database functions with common implementations
 * @param overrides Optional overrides for specific mock implementations
 */
export function setupDbMocks(
  overrides: {
    showsDb?: Partial<typeof showsDb>;
    seasonsDb?: Partial<typeof seasonsDb>;
    episodesDb?: Partial<typeof episodesDb>;
  } = {},
) {
  // Default showsDb implementations
  (showsDb.createShow as jest.Mock).mockImplementation((...args) => ({
    id: 123,
    tmdb_id: args[0],
    title: args[1],
    description: args[2],
    release_date: args[3],
    poster_image: args[4],
    backdrop_image: args[5],
    user_rating: args[6],
    content_rating: args[7],
    season_count: args[10],
    episode_count: args[11],
    genreIds: args[12],
    status: args[13],
    type: args[14],
    in_production: args[15],
    last_air_date: args[16],
    last_episode_to_air: args[17],
    next_episode_to_air: args[18],
    network: args[19],
  }));

  (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
  (showsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
  (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1, 2, 3]);
  (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
  (showsDb.updateAllWatchStatuses as jest.Mock).mockResolvedValue(true);

  // Default seasonsDb implementations
  (seasonsDb.createSeason as jest.Mock).mockImplementation(
    (showId, tmdbId, name, overview, seasonNumber, releaseDate, posterImage, numberOfEpisodes) => ({
      id: 200 + seasonNumber,
      show_id: showId,
      tmdb_id: tmdbId,
      name,
      overview,
      season_number: seasonNumber,
      release_date: releaseDate,
      poster_image: posterImage,
      number_of_episodes: numberOfEpisodes,
    }),
  );

  (seasonsDb.updateSeason as jest.Mock).mockImplementation((season) => ({
    ...season,
    id: season.id || 200 + (season.season_number || 1),
  }));

  (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

  // Default episodesDb implementations
  (episodesDb.createEpisode as jest.Mock).mockImplementation(
    (
      tmdbId,
      showId,
      seasonId,
      episodeNumber,
      episodeType,
      seasonNumber,
      title,
      overview,
      airDate,
      runtime,
      stillImage,
    ) => ({
      id: 300 + (episodeNumber || 1),
      tmdb_id: tmdbId,
      show_id: showId,
      season_id: seasonId,
      episode_number: episodeNumber,
      episode_type: episodeType,
      season_number: seasonNumber,
      title,
      overview,
      air_date: airDate,
      runtime,
      still_image: stillImage,
    }),
  );

  (episodesDb.updateEpisode as jest.Mock).mockImplementation((episode) => ({
    ...episode,
    id: episode.id || 300 + (episode.episode_number || 1),
  }));

  (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

  // Apply any overrides
  if (overrides.showsDb) {
    Object.entries(overrides.showsDb).forEach(([key, value]) => {
      (showsDb as any)[key] = value;
    });
  }

  if (overrides.seasonsDb) {
    Object.entries(overrides.seasonsDb).forEach(([key, value]) => {
      (seasonsDb as any)[key] = value;
    });
  }

  if (overrides.episodesDb) {
    Object.entries(overrides.episodesDb).forEach(([key, value]) => {
      (episodesDb as any)[key] = value;
    });
  }
}

/**
 * Common testing utilities for async operations
 */
export const testUtils = {
  /**
   * Creates a mock setTimeout that executes immediately
   */
  mockImmediateTimeout: () => {
    return jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as NodeJS.Timeout;
    });
  },

  /**
   * Creates a Promise that resolves after specified milliseconds
   */
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};
