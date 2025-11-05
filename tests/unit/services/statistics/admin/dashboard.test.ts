import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { adminStatisticsService } from '@services/statistics/adminStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');

// Mock the methods on the service itself
jest.spyOn(adminStatisticsService, 'getPlatformOverview');
jest.spyOn(adminStatisticsService, 'getPlatformTrends');
jest.spyOn(adminStatisticsService, 'getAccountHealthMetrics');
jest.spyOn(adminStatisticsService, 'getContentPopularity');

describe('AdminStatisticsService - Dashboard Integration', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(adminStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getAdminDashboard', () => {
    const mockPlatformOverview = {
      totalAccounts: 150,
      activeAccounts: 75,
      totalProfiles: 300,
      totalShows: 1200,
      totalMovies: 800,
      totalEpisodesWatched: 15000,
      totalMoviesWatched: 600,
      totalHoursWatched: 12500,
      averageProfilesPerAccount: 2.0,
      averageEpisodesPerAccount: 200.0,
    };

    const mockPlatformTrends = {
      periodDays: 30,
      newAccountsInPeriod: 25,
      episodesWatchedInPeriod: 5000,
      moviesWatchedInPeriod: 300,
      dailyActiveUsersTrend: 10.5,
      watchActivityTrend: 15.25,
      dailyActivity: [
        { date: '2025-11-02', activeAccounts: 50, episodesWatched: 250, moviesWatched: 30 },
        { date: '2025-11-01', activeAccounts: 45, episodesWatched: 200, moviesWatched: 25 },
      ],
    };

    const mockAccountHealth = {
      totalAccounts: 150,
      activeAccounts: 75,
      inactiveAccounts: 75,
      atRiskAccounts: 20,
      averageEngagementScore: 72.5,
      riskDistribution: { low: 75, medium: 55, high: 20 },
      accounts: [],
    };

    const mockContentPopularity = {
      contentType: 'all' as const,
      resultCount: 10,
      popularContent: [
        {
          contentId: 1,
          title: 'Popular Show 1',
          contentType: 'show' as const,
          accountCount: 100,
          profileCount: 150,
          totalWatchCount: 200,
          completionRate: 75.5,
          releaseYear: 2020,
        },
        {
          contentId: 2,
          title: 'Popular Show 2',
          contentType: 'show' as const,
          accountCount: 90,
          profileCount: 140,
          totalWatchCount: 180,
          completionRate: 70.0,
          releaseYear: 2021,
        },
        {
          contentId: 101,
          title: 'Popular Movie 1',
          contentType: 'movie' as const,
          accountCount: 85,
          profileCount: 130,
          totalWatchCount: 170,
          completionRate: 85.0,
          releaseYear: 2022,
        },
        {
          contentId: 102,
          title: 'Popular Movie 2',
          contentType: 'movie' as const,
          accountCount: 80,
          profileCount: 120,
          totalWatchCount: 160,
          completionRate: 80.5,
          releaseYear: 2023,
        },
        {
          contentId: 3,
          title: 'Popular Show 3',
          contentType: 'show' as const,
          accountCount: 75,
          profileCount: 110,
          totalWatchCount: 150,
          completionRate: 65.0,
          releaseYear: 2021,
        },
      ],
    };

    it('should return dashboard from cache if available', async () => {
      const mockDashboard = {
        platformOverview: mockPlatformOverview,
        recentTrends: mockPlatformTrends,
        accountHealth: {
          totalAccounts: 150,
          activeAccounts: 75,
          atRiskAccounts: 20,
          averageEngagementScore: 72.5,
        },
        topContent: {
          topShows: [
            { contentId: 1, title: 'Show 1', contentType: 'show' },
            { contentId: 2, title: 'Show 2', contentType: 'show' },
          ],
          topMovies: [
            { contentId: 101, title: 'Movie 1', contentType: 'movie' },
            { contentId: 102, title: 'Movie 2', contentType: 'movie' },
          ],
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockDashboard);

      const result = await adminStatisticsService.getAdminDashboard();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_dashboard', expect.any(Function), 1800);
      expect(result).toEqual(mockDashboard);
    });

    it('should fetch and combine all dashboard data on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockResolvedValue(mockPlatformOverview);
      (adminStatisticsService.getPlatformTrends as jest.Mock).mockResolvedValue(mockPlatformTrends);
      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockAccountHealth);
      (adminStatisticsService.getContentPopularity as jest.Mock).mockResolvedValue(mockContentPopularity);

      const result = await adminStatisticsService.getAdminDashboard();

      expect(adminStatisticsService.getPlatformOverview).toHaveBeenCalledTimes(1);
      expect(adminStatisticsService.getPlatformTrends).toHaveBeenCalledWith(30);
      expect(adminStatisticsService.getAccountHealthMetrics).toHaveBeenCalledTimes(1);
      expect(adminStatisticsService.getContentPopularity).toHaveBeenCalledWith('all', 5);

      expect(result.platformOverview).toEqual(mockPlatformOverview);
      expect(result.recentTrends).toEqual(mockPlatformTrends);
      expect(result.accountHealth).toEqual({
        totalAccounts: 150,
        activeAccounts: 75,
        atRiskAccounts: 20,
        averageEngagementScore: 72.5,
      });
    });

    it('should separate shows and movies in top content', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockResolvedValue(mockPlatformOverview);
      (adminStatisticsService.getPlatformTrends as jest.Mock).mockResolvedValue(mockPlatformTrends);
      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockAccountHealth);
      (adminStatisticsService.getContentPopularity as jest.Mock).mockResolvedValue(mockContentPopularity);

      const result = await adminStatisticsService.getAdminDashboard();

      expect(result.topContent.topShows).toHaveLength(3);
      expect(result.topContent.topMovies).toHaveLength(2);

      expect(result.topContent.topShows.every((c) => c.contentType === 'show')).toBe(true);
      expect(result.topContent.topMovies.every((c) => c.contentType === 'movie')).toBe(true);
    });

    it('should handle empty top content', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockResolvedValue(mockPlatformOverview);
      (adminStatisticsService.getPlatformTrends as jest.Mock).mockResolvedValue(mockPlatformTrends);
      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockAccountHealth);
      (adminStatisticsService.getContentPopularity as jest.Mock).mockResolvedValue({
        contentType: 'all',
        resultCount: 0,
        popularContent: [],
      });

      const result = await adminStatisticsService.getAdminDashboard();

      expect(result.topContent.topShows).toHaveLength(0);
      expect(result.topContent.topMovies).toHaveLength(0);
    });

    it('should handle only shows in top content', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockResolvedValue(mockPlatformOverview);
      (adminStatisticsService.getPlatformTrends as jest.Mock).mockResolvedValue(mockPlatformTrends);
      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockAccountHealth);
      (adminStatisticsService.getContentPopularity as jest.Mock).mockResolvedValue({
        contentType: 'all',
        resultCount: 2,
        popularContent: [
          {
            contentId: 1,
            title: 'Show 1',
            contentType: 'show',
            accountCount: 100,
            profileCount: 150,
            totalWatchCount: 200,
            completionRate: 75.5,
          },
          {
            contentId: 2,
            title: 'Show 2',
            contentType: 'show',
            accountCount: 90,
            profileCount: 140,
            totalWatchCount: 180,
            completionRate: 70.0,
          },
        ],
      });

      const result = await adminStatisticsService.getAdminDashboard();

      expect(result.topContent.topShows).toHaveLength(2);
      expect(result.topContent.topMovies).toHaveLength(0);
    });

    it('should handle only movies in top content', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockResolvedValue(mockPlatformOverview);
      (adminStatisticsService.getPlatformTrends as jest.Mock).mockResolvedValue(mockPlatformTrends);
      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockAccountHealth);
      (adminStatisticsService.getContentPopularity as jest.Mock).mockResolvedValue({
        contentType: 'all',
        resultCount: 2,
        popularContent: [
          {
            contentId: 101,
            title: 'Movie 1',
            contentType: 'movie',
            accountCount: 85,
            profileCount: 130,
            totalWatchCount: 170,
            completionRate: 85.0,
          },
          {
            contentId: 102,
            title: 'Movie 2',
            contentType: 'movie',
            accountCount: 80,
            profileCount: 120,
            totalWatchCount: 160,
            completionRate: 80.5,
          },
        ],
      });

      const result = await adminStatisticsService.getAdminDashboard();

      expect(result.topContent.topShows).toHaveLength(0);
      expect(result.topContent.topMovies).toHaveLength(2);
    });

    it('should handle errors from sub-methods', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Failed to get platform overview');
      (adminStatisticsService.getPlatformOverview as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getAdminDashboard()).rejects.toThrow(
        'Handled: Failed to get platform overview',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAdminDashboard()');
    });

    it('should execute all data fetches in parallel', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const startTime = Date.now();
      let platformOverviewTime = 0;
      let platformTrendsTime = 0;
      let accountHealthTime = 0;
      let contentPopularityTime = 0;

      (adminStatisticsService.getPlatformOverview as jest.Mock).mockImplementation(async () => {
        platformOverviewTime = Date.now() - startTime;
        return mockPlatformOverview;
      });

      (adminStatisticsService.getPlatformTrends as jest.Mock).mockImplementation(async () => {
        platformTrendsTime = Date.now() - startTime;
        return mockPlatformTrends;
      });

      (adminStatisticsService.getAccountHealthMetrics as jest.Mock).mockImplementation(async () => {
        accountHealthTime = Date.now() - startTime;
        return mockAccountHealth;
      });

      (adminStatisticsService.getContentPopularity as jest.Mock).mockImplementation(async () => {
        contentPopularityTime = Date.now() - startTime;
        return mockContentPopularity;
      });

      await adminStatisticsService.getAdminDashboard();

      // All calls should happen within a very short time window (parallel execution)
      const maxTime = Math.max(platformOverviewTime, platformTrendsTime, accountHealthTime, contentPopularityTime);
      const minTime = Math.min(platformOverviewTime, platformTrendsTime, accountHealthTime, contentPopularityTime);

      // If parallel, the time difference should be minimal (< 50ms)
      expect(maxTime - minTime).toBeLessThan(50);
    });
  });
});
