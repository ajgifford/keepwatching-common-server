import { mockShows } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Basic Functionality', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('getShowsForProfile', () => {
    it('should return shows from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_shows', expect.any(Function), 600);
      expect(result).toEqual(mockShows);
    });

    it('should fetch shows from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockShows);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowsForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowsForProfile(123)');
    });
  });

  describe('getShowDetailsForProfile', () => {
    const mockShowWithSeasons = {
      show_id: 1,
      title: 'Test Show',
      seasons: [{ season_id: 1, name: 'Season 1', episodes: [] }],
    };

    it('should return show details from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfile('123', '1');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_show_details_1', expect.any(Function), 600);
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should fetch show details from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfile('123', '1');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith('123', '1');
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should throw NotFoundError when show is not found', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowDetailsForProfile('123', '999')).rejects.toThrow(NotFoundError);
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith('123', '999');
      expect(errorService.assertExists).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowDetailsForProfile('123', '1')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowDetailsForProfile(123, 1)');
    });
  });
});
