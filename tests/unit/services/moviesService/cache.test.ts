import { setupMoviesService } from './helpers/mocks';
import { profileService } from '@services/profileService';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';

describe('MoviesService - Cache', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('invalidateAccountCache', () => {
    const mockProfiles = [
      { id: 1, name: 'Profile 1', image: 'profile1.jpg', account_id: 123 },
      { id: 2, name: 'Profile 2', image: 'profile2.jpg', account_id: 123 },
    ];

    it('should invalidate cache for all profiles in an account', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(mockProfiles);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileMovies).toHaveBeenCalledTimes(2);
      expect(mockCache.invalidateProfileMovies).toHaveBeenNthCalledWith(1, 1);
      expect(mockCache.invalidateProfileMovies).toHaveBeenNthCalledWith(2, 2);
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle empty profiles array', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue([]);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileMovies).not.toHaveBeenCalled();
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle errors when fetching profiles', async () => {
      const mockError = new Error('Failed to get profiles');
      (profileService.getProfilesByAccountId as Mock).mockRejectedValue(mockError);

      await expect(service.invalidateAccountCache(123)).rejects.toThrow('Failed to get profiles');
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileMovies).not.toHaveBeenCalled();
      expect(mockCache.invalidateAccount).not.toHaveBeenCalled();
    });
  });
});
