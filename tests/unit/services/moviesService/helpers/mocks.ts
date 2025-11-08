import { mockTMDBResponses } from './fixtures';
import * as moviesDb from '@db/moviesDb';
import * as personsDb from '@db/personsDb';
import { errorService } from '@services/errorService';
import { createMoviesService, resetMoviesService } from '@services/moviesService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';
import { type Mock, vi } from 'vitest';

vi.mock('@db/moviesDb');
vi.mock('@db/personsDb');
vi.mock('@services/cacheService');
vi.mock('@services/errorService');
vi.mock('@services/profileService');
vi.mock('@services/achievementDetectionService', () => ({
  checkAndRecordAchievements: vi.fn().mockResolvedValue(0),
  detectShowCompletion: vi.fn().mockResolvedValue(false),
  batchCheckAchievements: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('@services/tmdbService');
vi.mock('@services/watchStatusService');
vi.mock('@utils/contentUtility');
vi.mock('@utils/watchProvidersUtility');
vi.mock('@utils/db');
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
  (contentUtility.getUSMPARating as Mock).mockReturnValue('PG-13');
  (contentUtility.getDirectors as Mock).mockReturnValue('Director A');
  (contentUtility.getUSProductionCompanies as Mock).mockReturnValue('Production A');
  (watchProvidersUtility.getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);

  // Set up TMDB service mock with default implementation
  (getTMDBService as Mock).mockReturnValue({
    getMovieDetails: vi.fn().mockResolvedValue(mockTMDBResponses.movieDetails),
    getMovieRecommendations: vi.fn().mockResolvedValue(mockTMDBResponses.movieRecommendations),
    getSimilarMovies: vi.fn().mockResolvedValue(mockTMDBResponses.similarMovies),
    getMovieChanges: vi.fn().mockResolvedValue(mockTMDBResponses.movieChanges),
    getPersonDetails: vi.fn().mockResolvedValue(mockTMDBResponses.personDetails),
  });
}

/**
 * Sets up MoviesService with a mock cache
 * @returns Object containing the service instance, the mock cache, and mock checkAchievements
 */
export function setupMoviesService() {
  setupMocks();
  resetMoviesService();
  const mockCache = createMockCache();
  const mockCheckAchievements = vi.fn().mockResolvedValue(undefined);

  // Create a fresh instance with the mock cache and achievement checker using factory pattern
  const service = createMoviesService({
    cacheService: mockCache,
    checkAchievements: mockCheckAchievements,
  });

  return {
    service,
    mockCache,
    mockCheckAchievements,
  };
}

/**
 * Sets up mock database functions with common implementations
 * @param overrides Optional overrides for specific mock implementations
 */
export function setupDbMocks(
  overrides: {
    moviesDb?: Partial<typeof moviesDb>;
    personsDb?: Partial<typeof personsDb>;
  } = {},
) {
  // Default moviesDb implementations
  (moviesDb.updateMovie as Mock).mockResolvedValue(true);
  (moviesDb.saveFavorite as Mock).mockResolvedValue(undefined);
  (moviesDb.removeFavorite as Mock).mockResolvedValue(undefined);
  (moviesDb.updateWatchStatus as Mock).mockResolvedValue(true);

  // Default personsDb implementations
  (personsDb.savePerson as Mock).mockResolvedValue(1);
  (personsDb.saveMovieCast as Mock).mockResolvedValue(undefined);

  // Apply any overrides
  if (overrides.moviesDb) {
    Object.entries(overrides.moviesDb).forEach(([key, value]) => {
      (moviesDb as any)[key] = value;
    });
  }

  if (overrides.personsDb) {
    Object.entries(overrides.personsDb).forEach(([key, value]) => {
      (personsDb as any)[key] = value;
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
