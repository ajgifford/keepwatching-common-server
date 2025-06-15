import { mockTMDBResponses } from './fixtures';
import { errorService } from '@services/errorService';
import { MoviesService, moviesService } from '@services/moviesService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

jest.mock('@db/moviesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/profileService');
jest.mock('@utils/contentUtility', () => ({
  getUSMPARating: jest.fn().mockReturnValue('PG-13'),
}));
jest.mock('@utils/watchProvidersUtility', () => ({
  getUSWatchProviders: jest.fn().mockReturnValue([8, 9]),
}));
jest.mock('@services/tmdbService', () => ({
  getTMDBService: jest.fn(),
}));
jest.mock('@logger/logger', () => ({
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
  jest.clearAllMocks();

  (errorService.handleError as jest.Mock).mockImplementation((error) => {
    throw error;
  });

  (errorService.assertExists as jest.Mock).mockImplementation((item) => {
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  });

  (contentUtility.getUSMPARating as jest.Mock).mockReturnValue('PG13');
  (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

  (getTMDBService as jest.Mock).mockReturnValue({
    getMovieRecommendations: jest.fn().mockResolvedValue(mockTMDBResponses.movieRecommendations),
    getSimilarMovies: jest.fn().mockResolvedValue(mockTMDBResponses.similarMovies),
  });
}

/**
 * Sets up MoviesService with a mock cache
 * @returns Object containing the service instance and the mock cache
 */
export function setupMoviesService() {
  setupMocks();
  const mockCache = createMockCache();

  // Create a fresh instance to avoid test cross-contamination
  Object.setPrototypeOf(moviesService, MoviesService.prototype);
  (moviesService as any).cache = mockCache;

  return {
    service: moviesService,
    mockCache,
  };
}
