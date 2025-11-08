import * as accountComparisonRepository from '@db/statistics/accountComparisonRepository';
import { errorService } from '@services/errorService';
import {
  AdminStatisticsService,
  createAdminStatisticsService,
  resetAdminStatisticsService,
} from '@services/statistics/adminStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@db/statistics/accountComparisonRepository');

describe('AdminStatisticsService - Account Rankings', () => {
  let adminStatisticsService: AdminStatisticsService;
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    resetAdminStatisticsService();

    adminStatisticsService = createAdminStatisticsService({
      cacheService: mockCacheService as any,
      serviceName: 'test-service',
    });
  });

  afterEach(() => {
    resetAdminStatisticsService();
    vi.resetModules();
  });

  describe('getAccountRankings', () => {
    const mockRankingsData = [
      {
        account_id: 1,
        account_email: 'top1@example.com',
        account_name: 'Top User',
        profile_count: 4,
        total_episodes_watched: 5000,
        total_movies_watched: 500,
        total_hours_watched: 4000.5,
        engagement_score: 95,
        last_activity_date: new Date('2025-11-02'),
      },
      {
        account_id: 2,
        account_email: 'top2@example.com',
        account_name: 'Second User',
        profile_count: 3,
        total_episodes_watched: 3000,
        total_movies_watched: 300,
        total_hours_watched: 2500.25,
        engagement_score: 85,
        last_activity_date: new Date('2025-11-01'),
      },
      {
        account_id: 3,
        account_email: 'top3@example.com',
        account_name: 'Third User',
        profile_count: 2,
        total_episodes_watched: 2000,
        total_movies_watched: 200,
        total_hours_watched: 1500.75,
        engagement_score: 75,
        last_activity_date: new Date('2025-10-30'),
      },
    ];

    it('should return account rankings from cache if available', async () => {
      const mockRankings = {
        rankingMetric: 'engagement',
        totalAccounts: 3,
        rankings: [
          {
            accountId: 1,
            accountEmail: 'top1@example.com',
            accountName: 'Top User',
            profileCount: 4,
            totalEpisodesWatched: 5000,
            totalMoviesWatched: 500,
            totalHoursWatched: 4001,
            engagementScore: 95,
            lastActivityDate: new Date('2025-11-02'),
          },
        ],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockRankings);

      const result = await adminStatisticsService.getAccountRankings('engagement', 50);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'admin_accounts_rankings_engagement_50',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockRankings);
      expect(accountComparisonRepository.getAccountRankings).not.toHaveBeenCalled();
    });

    it('should fetch and transform account rankings on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue(mockRankingsData);

      const result = await adminStatisticsService.getAccountRankings('engagement', 50);

      expect(accountComparisonRepository.getAccountRankings).toHaveBeenCalledWith('engagement', 50);
      expect(result.rankingMetric).toBe('engagement');
      expect(result.totalAccounts).toBe(3);
      expect(result.rankings).toHaveLength(3);

      expect(result.rankings[0]).toEqual({
        accountId: 1,
        accountEmail: 'top1@example.com',
        accountName: 'Top User',
        profileCount: 4,
        totalEpisodesWatched: 5000,
        totalMoviesWatched: 500,
        totalHoursWatched: 4001, // Rounded from 4000.5
        engagementScore: 95,
        lastActivityDate: new Date('2025-11-02'),
      });

      expect(result.rankings[1].totalHoursWatched).toBe(2500); // Rounded from 2500.25
      expect(result.rankings[2].totalHoursWatched).toBe(1501); // Rounded from 1500.75
    });

    it('should use default parameters when not provided', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue([]);

      await adminStatisticsService.getAccountRankings();

      expect(accountComparisonRepository.getAccountRankings).toHaveBeenCalledWith('engagement', 50);
    });

    it('should support different ranking metrics', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue(mockRankingsData);

      // Test episodesWatched metric
      await adminStatisticsService.getAccountRankings('episodesWatched', 25);
      expect(accountComparisonRepository.getAccountRankings).toHaveBeenCalledWith('episodesWatched', 25);

      // Test moviesWatched metric
      await adminStatisticsService.getAccountRankings('moviesWatched', 10);
      expect(accountComparisonRepository.getAccountRankings).toHaveBeenCalledWith('moviesWatched', 10);

      // Test hoursWatched metric
      await adminStatisticsService.getAccountRankings('hoursWatched', 100);
      expect(accountComparisonRepository.getAccountRankings).toHaveBeenCalledWith('hoursWatched', 100);
    });

    it('should handle empty rankings', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue([]);

      const result = await adminStatisticsService.getAccountRankings('engagement', 50);

      expect(result.totalAccounts).toBe(0);
      expect(result.rankings).toHaveLength(0);
    });

    it('should handle accounts without names', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockDataWithoutNames = [
        {
          account_id: 1,
          account_email: 'user@example.com',
          account_name: null,
          profile_count: 2,
          total_episodes_watched: 1000,
          total_movies_watched: 100,
          total_hours_watched: 800.0,
          engagement_score: 75,
          last_activity_date: new Date('2025-11-01'),
        },
      ];

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue(mockDataWithoutNames);

      const result = await adminStatisticsService.getAccountRankings('engagement', 50);

      expect(result.rankings[0].accountName).toBeNull();
    });

    it('should round hours watched correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockDataWithDecimals = [
        {
          account_id: 1,
          account_email: 'user1@example.com',
          account_name: 'User 1',
          profile_count: 1,
          total_episodes_watched: 100,
          total_movies_watched: 10,
          total_hours_watched: 123.456,
          engagement_score: 70,
          last_activity_date: new Date('2025-11-01'),
        },
        {
          account_id: 2,
          account_email: 'user2@example.com',
          account_name: 'User 2',
          profile_count: 1,
          total_episodes_watched: 100,
          total_movies_watched: 10,
          total_hours_watched: 99.999,
          engagement_score: 70,
          last_activity_date: new Date('2025-11-01'),
        },
      ];

      (accountComparisonRepository.getAccountRankings as Mock).mockResolvedValue(mockDataWithDecimals);

      const result = await adminStatisticsService.getAccountRankings('engagement', 50);

      expect(result.rankings[0].totalHoursWatched).toBe(123);
      expect(result.rankings[1].totalHoursWatched).toBe(100);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (accountComparisonRepository.getAccountRankings as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getAccountRankings('engagement', 50)).rejects.toThrow(
        'Handled: Database query failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountRankings(engagement, 50)');
    });
  });
});
