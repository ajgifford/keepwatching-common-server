import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Digest', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('getTrendingShows', () => {
    it('should return trending shows', async () => {
      (showsDb.getTrendingShows as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Show 1' }]);

      const result = await service.getTrendingShows();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Show 1' }]);
    });

    it('should handle errors when getting trending shows', async () => {
      const mockError = new Error('Database error');
      (showsDb.getTrendingShows as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getTrendingShows()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTrendingShows(10)');
    });
  });

  describe('getNewlyAddedShows', () => {
    it('should return newly added shows', async () => {
      (showsDb.getNewlyAddedShows as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Show 1' }]);

      const result = await service.getNewlyAddedShows();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Show 1' }]);
    });

    it('should handle errors when getting newly added shows', async () => {
      const mockError = new Error('Database error');
      (showsDb.getNewlyAddedShows as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getNewlyAddedShows()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getNewlyAddedShows(10)');
    });
  });

  describe('getTopRatedShows', () => {
    it('should return top rated shows', async () => {
      (showsDb.getTopRatedShows as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Show 1' }]);

      const result = await service.getTopRatedShows();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Show 1' }]);
    });

    it('should handle errors when getting top rated shows', async () => {
      const mockError = new Error('Database error');
      (showsDb.getTopRatedShows as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getTopRatedShows()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTopRatedShows(10)');
    });
  });
});
