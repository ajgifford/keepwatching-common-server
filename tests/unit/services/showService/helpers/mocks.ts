import { mockTMDBResponses } from './fixtures';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { errorService } from '@services/errorService';
import { createShowService, resetShowService } from '@services/showService';
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
jest.mock('@services/notificationsService');
jest.mock('@services/seasonChangesService');
jest.mock('@services/socketService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@services/watchStatusService');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  appLogger: {
    info: jest.fn(),
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
  (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([8, 9]);

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
  resetShowService();
  const mockCache = createMockCache();

  // Create a fresh instance with the mock cache
  const service = createShowService({ cacheService: mockCache });

  return {
    service,
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
  (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
  (showsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
  (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1, 2, 3]);

  // Default seasonsDb implementations
  (seasonsDb.updateSeason as jest.Mock).mockImplementation((season) => 200 + (season.season_number || 1));
  (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

  // Default episodesDb implementations
  (episodesDb.updateEpisode as jest.Mock).mockImplementation((episode) => 300 + (episode.episode_number || 1));
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
