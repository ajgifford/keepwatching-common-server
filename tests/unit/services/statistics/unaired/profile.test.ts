import * as statisticsDb from '@db/statisticsDb';
import { errorService } from '@services/errorService';
import {
  ProfileStatisticsService,
  createProfileStatisticsService,
  resetProfileStatisticsService,
} from '@services/statistics/profileStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/statisticsDb');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');

describe('Statistics - Unaired - Profile', () => {
  let profileStatisticsService: ProfileStatisticsService;
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // ✅ Reset singleton to ensure test isolation
    resetProfileStatisticsService();

    // ✅ Create fresh instance with mocked dependencies
    profileStatisticsService = createProfileStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    // ✅ Clean up after each test
    resetProfileStatisticsService();
    vi.resetModules();
  });

  describe('getUnairedContentStats', () => {
    it('should return unaired content stats from cache if available', async () => {
      const mockStats = {
        unairedShowCount: 5,
        unairedSeasonCount: 8,
        unairedMovieCount: 3,
        unairedEpisodeCount: 125,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getUnairedContentStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_unaired_content_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getUnairedContentStats).not.toHaveBeenCalled();
    });

    it('should fetch and return unaired content stats on cache miss', async () => {
      const mockStats = {
        unairedShowCount: 5,
        unairedSeasonCount: 8,
        unairedMovieCount: 3,
        unairedEpisodeCount: 125,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getUnairedContentStats as Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getUnairedContentStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_unaired_content_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getUnairedContentStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting unaired content stats', async () => {
      const error = new Error('Failed to get unaired content stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getUnairedContentStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getUnairedContentStats(123)).rejects.toThrow(
        'Handled: Failed to get unaired content stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getUnairedContentStats(123)');
    });
  });
});
