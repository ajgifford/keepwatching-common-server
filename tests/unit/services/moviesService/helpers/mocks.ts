import { mockTMDBResponses } from './fixtures';
import { errorService } from '@services/errorService';
import { MoviesService, moviesService } from '@services/moviesService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';
import { type Mock, vi } from 'vitest';

vi.mock('@db/moviesDb');
vi.mock('@services/cacheService');
vi.mock('@services/errorService');
vi.mock('@services/profileService');
vi.mock('@utils/contentUtility', () => ({
  getUSMPARating: vi.fn().mockReturnValue('PG-13'),
}));
vi.mock('@utils/watchProvidersUtility', () => ({
  getUSWatchProvidersMovie: vi.fn().mockReturnValue([8, 9]),
}));
vi.mock('@services/tmdbService', () => ({
  getTMDBService: vi.fn(),
}));
vi.mock('@logger/logger', () => ({
  appLogger: {
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
  vi.clearAllMocks();

  (errorService.handleError as Mock).mockImplementation((error) => {
    throw error;
  });

  (errorService.assertExists as Mock).mockImplementation((item) => {
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  });

  (contentUtility.getUSMPARating as Mock).mockReturnValue('PG13');
  (watchProvidersUtility.getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);

  (getTMDBService as Mock).mockReturnValue({
    getMovieRecommendations: vi.fn().mockResolvedValue(mockTMDBResponses.movieRecommendations),
    getSimilarMovies: vi.fn().mockResolvedValue(mockTMDBResponses.similarMovies),
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
