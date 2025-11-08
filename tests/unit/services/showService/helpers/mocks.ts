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
import { type Mock, vi } from 'vitest';

vi.mock('@db/showsDb');
vi.mock('@db/seasonsDb');
vi.mock('@db/episodesDb');
vi.mock('@services/profileService');
vi.mock('@services/cacheService');
vi.mock('@services/errorService');
vi.mock('@services/notificationsService');
vi.mock('@services/seasonChangesService');
vi.mock('@services/socketService');
vi.mock('@services/tmdbService');
vi.mock('@utils/db');
vi.mock('@utils/contentUtility');
vi.mock('@utils/watchProvidersUtility');
vi.mock('@services/watchStatusService');
vi.mock('@logger/logger', () => ({
  cliLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  appLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Creates a mock Cache service for testing
 */
export function createMockCache() {
  return {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    invalidatePattern: vi.fn(),
    invalidateProfileShows: vi.fn(),
    invalidateAccount: vi.fn(),
    invalidateProfileMovies: vi.fn(),
    invalidateProfileStatistics: vi.fn(),
    invalidateAccountStatistics: vi.fn(),
    flushAll: vi.fn(),
    getStats: vi.fn(),
    keys: vi.fn(),
  } as any;
}

/**
 * Sets up common mocks with default behaviors
 */
export function setupMocks() {
  // Reset all mocks
  vi.clearAllMocks();

  // Set up error service to re-throw errors
  (errorService.handleError as Mock).mockImplementation((error) => {
    throw error;
  });

  // Set up assertExists to pass through or throw as needed
  (errorService.assertExists as Mock).mockImplementation((item) => {
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  });

  // Set up common content utility mocks
  (contentUtility.getUSRating as Mock).mockReturnValue('TV-14');
  (contentUtility.getInProduction as Mock).mockReturnValue(1);
  (contentUtility.getEpisodeToAirId as Mock).mockReturnValue(null);
  (contentUtility.getUSNetwork as Mock).mockReturnValue('HBO');
  (watchProvidersUtility.getUSWatchProvidersShow as Mock).mockReturnValue([8, 9]);

  // Set up TMDB service mock with default implementation
  (getTMDBService as Mock).mockReturnValue({
    getShowDetails: vi.fn().mockResolvedValue(mockTMDBResponses.showDetails),
    getSeasonDetails: vi.fn().mockResolvedValue(mockTMDBResponses.seasonDetails),
    getShowRecommendations: vi.fn().mockResolvedValue(mockTMDBResponses.showRecommendations),
    getSimilarShows: vi.fn().mockResolvedValue(mockTMDBResponses.similarShows),
    getShowChanges: vi.fn().mockResolvedValue(mockTMDBResponses.showChanges),
  });

  // Set up Socket service mock with default implementation
  (socketService.notifyShowsUpdate as Mock).mockImplementation(() => {});
  (socketService.notifyShowDataLoaded as Mock).mockImplementation(() => {});
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
  (showsDb.updateShow as Mock).mockResolvedValue(true);
  (showsDb.saveFavorite as Mock).mockResolvedValue(undefined);
  (showsDb.getProfilesForShow as Mock).mockResolvedValue([1, 2, 3]);

  // Default seasonsDb implementations
  (seasonsDb.updateSeason as Mock).mockImplementation((season) => 200 + (season.season_number || 1));
  (seasonsDb.saveFavorite as Mock).mockResolvedValue(undefined);

  // Default episodesDb implementations
  (episodesDb.updateEpisode as Mock).mockImplementation((episode) => 300 + (episode.episode_number || 1));
  (episodesDb.saveFavorite as Mock).mockResolvedValue(undefined);

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
    return vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as NodeJS.Timeout;
    });
  },

  /**
   * Creates a Promise that resolves after specified milliseconds
   */
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};
