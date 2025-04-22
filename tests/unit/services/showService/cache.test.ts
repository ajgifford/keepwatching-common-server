import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { CacheService } from '@services/cacheService';
import { profileService } from '@services/profileService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Cache Functionality', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('invalidateProfileCache', () => {
    it('should invalidate profile shows cache', () => {
      service.invalidateProfileCache('123');

      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('123');
    });
  });

  describe('invalidateAccountCache', () => {
    it('should invalidate all profiles in an account', async () => {
      const mockProfiles = [
        { id: 1, name: 'Profile 1', account_id: 123 },
        { id: 2, name: 'Profile 2', account_id: 123 },
      ];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(mockProfiles);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('1');
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('2');
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle empty profiles array', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).not.toHaveBeenCalled();
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profileService.getProfilesByAccountId as jest.Mock).mockRejectedValue(error);

      await expect(service.invalidateAccountCache(123)).rejects.toThrow('Database error');
    });
  });

  describe('getAllShows', () => {
    const mockShows = [
      { id: 1, title: 'Show 1', created_at: '2023-01-01', updated_at: '2023-01-10' },
      { id: 2, title: 'Show 2', created_at: '2023-02-01', updated_at: '2023-02-10' },
    ];

    const mockPaginationResult = {
      shows: mockShows,
      pagination: {
        totalCount: 10,
        totalPages: 5,
        currentPage: 1,
        limit: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };

    it('should return shows with pagination from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await showService.getAllShows(1, 0, 2);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('allShows_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
    });

    it('should fetch shows with pagination from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(10);
      (showsDb.getAllShows as jest.Mock).mockResolvedValue(mockShows);

      const result = await showService.getAllShows(1, 0, 2);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowsCount).toHaveBeenCalled();
      expect(showsDb.getAllShows).toHaveBeenCalledWith(2, 0);

      expect(result).toEqual({
        shows: mockShows,
        pagination: {
          totalCount: 10,
          totalPages: 5,
          currentPage: 1,
          limit: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should use default values when not provided', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(100);
      (showsDb.getAllShows as jest.Mock).mockResolvedValue(mockShows);

      await showService.getAllShows(1, 0, 50);

      expect(showsDb.getAllShows).toHaveBeenCalledWith(50, 0);
    });
  });
});
