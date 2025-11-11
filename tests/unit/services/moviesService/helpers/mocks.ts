import { mockTMDBResponses } from './fixtures';
import * as moviesDb from '@db/moviesDb';
import * as personsDb from '@db/personsDb';
import { errorService } from '@services/errorService';
import { createMoviesService, resetMoviesService } from '@services/moviesService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

jest.mock('@db/moviesDb');
jest.mock('@db/personsDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/profileService');
jest.mock('@services/achievementDetectionService', () => ({
  checkAndRecordAchievements: jest.fn().mockResolvedValue(0),
  detectShowCompletion: jest.fn().mockResolvedValue(false),
  batchCheckAchievements: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock('@services/tmdbService');
jest.mock('@services/watchStatusService');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@utils/db');
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
  (contentUtility.getUSMPARating as jest.Mock).mockReturnValue('PG-13');
  (contentUtility.getDirectors as jest.Mock).mockReturnValue('Director A');
  (contentUtility.getUSProductionCompanies as jest.Mock).mockReturnValue('Production A');
  (watchProvidersUtility.getUSWatchProvidersMovie as jest.Mock).mockReturnValue([8, 9]);

  // Set up TMDB service mock with default implementation
  (getTMDBService as jest.Mock).mockReturnValue({
    getMovieDetails: jest.fn().mockResolvedValue(mockTMDBResponses.movieDetails),
    getMovieRecommendations: jest.fn().mockResolvedValue(mockTMDBResponses.movieRecommendations),
    getSimilarMovies: jest.fn().mockResolvedValue(mockTMDBResponses.similarMovies),
    getMovieChanges: jest.fn().mockResolvedValue(mockTMDBResponses.movieChanges),
    getPersonDetails: jest.fn().mockResolvedValue(mockTMDBResponses.personDetails),
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
  const mockCheckAchievements = jest.fn().mockResolvedValue(undefined);

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
  (moviesDb.updateMovie as jest.Mock).mockResolvedValue(true);
  (moviesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
  (moviesDb.removeFavorite as jest.Mock).mockResolvedValue(undefined);
  (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);

  // Default personsDb implementations
  (personsDb.savePerson as jest.Mock).mockResolvedValue(1);
  (personsDb.saveMovieCast as jest.Mock).mockResolvedValue(undefined);

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
