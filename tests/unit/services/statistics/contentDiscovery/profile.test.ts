import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/statisticsDb');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');

describe('Statistics - ContentDiscovery - Profile', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(profileStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getContentDiscoveryStats', () => {
    it('should return content discovery stats from cache if available', async () => {
      const mockStats = {
        daysSinceLastContentAdded: 5,
        contentAdditionRate: {
          showsPerMonth: 3.5,
          moviesPerMonth: 2.2,
        },
        watchToAddRatio: {
          shows: 0.75,
          movies: 0.85,
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDiscoveryStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_discovery_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getContentDiscoveryStats).not.toHaveBeenCalled();
    });

    it('should fetch and return content discovery stats on cache miss', async () => {
      const mockStats = {
        daysSinceLastContentAdded: 5,
        contentAdditionRate: {
          showsPerMonth: 3.5,
          moviesPerMonth: 2.2,
        },
        watchToAddRatio: {
          shows: 0.75,
          movies: 0.85,
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDiscoveryStats as Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDiscoveryStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_discovery_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getContentDiscoveryStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting content discovery stats', async () => {
      const error = new Error('Failed to get content discovery stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDiscoveryStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getContentDiscoveryStats(123)).rejects.toThrow(
        'Handled: Failed to get content discovery stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getContentDiscoveryStats(123)');
    });
  });
});
