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
      service.invalidateProfileCache(1, 123);

      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(1, 123);
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
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(123, 1);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(123, 2);
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
});
