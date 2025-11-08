import { mockTMDBResponses } from './fixtures';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';
import { type Mock, vi } from 'vitest';

/**
 * Sets up default mocks for all adminShowService tests
 */
export function setupDefaultMocks(mockCacheService: any) {
  // Setup cache service
  vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

  // Setup content utilities
  (contentUtility.getUSRating as Mock).mockReturnValue('TV-14');
  (contentUtility.getInProduction as Mock).mockReturnValue(1);
  (contentUtility.getEpisodeToAirId as Mock).mockReturnValue(null);
  (contentUtility.getUSNetwork as Mock).mockReturnValue('HBO');
  (watchProvidersUtility.getUSWatchProvidersShow as Mock).mockReturnValue([8, 9]);

  // Setup TMDB service
  (getTMDBService as Mock).mockReturnValue({
    getShowDetails: vi.fn().mockResolvedValue(mockTMDBResponses.showDetails),
    getSeasonDetails: vi.fn().mockResolvedValue(mockTMDBResponses.seasonDetails),
    getShowRecommendations: vi.fn().mockResolvedValue(mockTMDBResponses.showRecommendations),
    getSimilarShows: vi.fn().mockResolvedValue(mockTMDBResponses.similarShows),
    getShowChanges: vi.fn().mockResolvedValue(mockTMDBResponses.showChanges),
  });

  // Setup socket service
  (socketService.notifyShowsUpdate as Mock).mockImplementation(() => {});
  (socketService.notifyShowDataLoaded as Mock).mockImplementation(() => {});

  // Setup error service
  (errorService.handleError as Mock).mockImplementation((err) => {
    throw err;
  });
}

/**
 * Creates a mock cache service with common methods
 */
export function createMockCacheService(): any {
  return {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
    invalidatePattern: vi.fn(),
    invalidateProfileShows: vi.fn(),
  };
}
