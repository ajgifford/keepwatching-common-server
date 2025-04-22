import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
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
  httpLogger: {
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

  // Set up common content utility mocks
  (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
  (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
  (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
  (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
  (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

  // Set up TMDB service mock with default implementation
  (getTMDBService as jest.Mock).mockReturnValue({
    getShowDetails: jest.fn(),
    getSeasonDetails: jest.fn(),
    getShowRecommendations: jest.fn(),
    getShowChanges: jest.fn(),
    getSimilarShows: jest.fn(),
  });
}
