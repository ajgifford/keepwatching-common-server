import { mockTMDBResponses } from './fixtures';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

/**
 * Sets up default mocks for all adminShowService tests
 */
export function setupDefaultMocks(mockCacheService: jest.Mocked<any>) {
  // Setup cache service
  jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

  // Setup content utilities
  (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
  (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
  (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
  (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
  (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([8, 9]);

  // Setup TMDB service
  (getTMDBService as jest.Mock).mockReturnValue({
    getShowDetails: jest.fn().mockResolvedValue(mockTMDBResponses.showDetails),
    getSeasonDetails: jest.fn().mockResolvedValue(mockTMDBResponses.seasonDetails),
    getShowRecommendations: jest.fn().mockResolvedValue(mockTMDBResponses.showRecommendations),
    getSimilarShows: jest.fn().mockResolvedValue(mockTMDBResponses.similarShows),
    getShowChanges: jest.fn().mockResolvedValue(mockTMDBResponses.showChanges),
  });

  // Setup socket service
  (socketService.notifyShowsUpdate as jest.Mock).mockImplementation(() => {});
  (socketService.notifyShowDataLoaded as jest.Mock).mockImplementation(() => {});

  // Setup error service
  (errorService.handleError as jest.Mock).mockImplementation((err) => {
    throw err;
  });
}

/**
 * Creates a mock cache service with common methods
 */
export function createMockCacheService(): jest.Mocked<any> {
  return {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
    invalidatePattern: jest.fn(),
    invalidateProfileShows: jest.fn(),
  };
}
