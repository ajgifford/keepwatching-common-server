import * as adminStatsRepository from '@db/statistics/adminStatsRepository';
import { errorService } from '@services/errorService';
import {
  AdminStatisticsService,
  createAdminStatisticsService,
  resetAdminStatisticsService,
} from '@services/statistics/adminStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@db/statistics/adminStatsRepository');

describe('AdminStatisticsService - Platform Stats', () => {
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

  describe('getPlatformOverview', () => {
    it('should return platform overview from cache if available', async () => {
      const mockOverview = {
        totalAccounts: 150,
        activeAccounts: 75,
        totalProfiles: 300,
        totalShows: 1200,
        totalMovies: 800,
        totalEpisodesWatched: 15000,
        totalMoviesWatched: 600,
        totalHoursWatched: 12501,
        averageProfilesPerAccount: 2.0,
        averageEpisodesPerAccount: 200.0,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockOverview);

      const result = await adminStatisticsService.getPlatformOverview();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_platform_overview', expect.any(Function), 1800);
      expect(result).toEqual(mockOverview);
      expect(adminStatsRepository.getPlatformOverview).not.toHaveBeenCalled();
    });

    it('should fetch and transform platform overview data on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockRepoData = {
        total_accounts: 150,
        active_accounts: 75,
        total_profiles: 300,
        total_shows: 1200,
        total_movies: 800,
        total_episodes_watched: 15000,
        total_movies_watched: 600,
        total_hours_watched: 12500.75,
      };

      (adminStatsRepository.getPlatformOverview as Mock).mockResolvedValue(mockRepoData);

      const result = await adminStatisticsService.getPlatformOverview();

      expect(adminStatsRepository.getPlatformOverview).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        totalAccounts: 150,
        activeAccounts: 75,
        totalProfiles: 300,
        totalShows: 1200,
        totalMovies: 800,
        totalEpisodesWatched: 15000,
        totalMoviesWatched: 600,
        totalHoursWatched: 12501, // Rounded
        averageProfilesPerAccount: 2.0,
        averageEpisodesPerAccount: 200.0,
      });
    });

    it('should handle zero accounts correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockRepoData = {
        total_accounts: 0,
        active_accounts: 0,
        total_profiles: 0,
        total_shows: 0,
        total_movies: 0,
        total_episodes_watched: 0,
        total_movies_watched: 0,
        total_hours_watched: 0,
      };

      (adminStatsRepository.getPlatformOverview as Mock).mockResolvedValue(mockRepoData);

      const result = await adminStatisticsService.getPlatformOverview();

      expect(result.averageProfilesPerAccount).toBe(0);
      expect(result.averageEpisodesPerAccount).toBe(0);
    });

    it('should handle null/undefined values from repository', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockRepoData = {
        total_accounts: null,
        active_accounts: undefined,
        total_profiles: null,
        total_shows: undefined,
        total_movies: null,
        total_episodes_watched: undefined,
        total_movies_watched: null,
        total_hours_watched: undefined,
      };

      (adminStatsRepository.getPlatformOverview as Mock).mockResolvedValue(mockRepoData);

      const result = await adminStatisticsService.getPlatformOverview();

      expect(result.totalAccounts).toBe(0);
      expect(result.activeAccounts).toBe(0);
      expect(result.totalProfiles).toBe(0);
      expect(result.totalShows).toBe(0);
      expect(result.totalMovies).toBe(0);
      expect(result.totalEpisodesWatched).toBe(0);
      expect(result.totalMoviesWatched).toBe(0);
      expect(result.totalHoursWatched).toBe(0);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database connection failed');
      (adminStatsRepository.getPlatformOverview as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getPlatformOverview()).rejects.toThrow('Handled: Database connection failed');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getPlatformOverview()');
    });
  });

  describe('getPlatformTrends', () => {
    it('should return platform trends from cache if available', async () => {
      const mockTrends = {
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

      mockCacheService.getOrSet.mockResolvedValue(mockTrends);

      const result = await adminStatisticsService.getPlatformTrends(30);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_platform_trends_30', expect.any(Function), 1800);
      expect(result).toEqual(mockTrends);
    });

    it('should fetch and calculate platform trends on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockTrendsData = [
        { activity_date: '2025-11-02', active_accounts: 50, episodes_watched: 250, movies_watched: 30 },
        { activity_date: '2025-11-01', active_accounts: 45, episodes_watched: 200, movies_watched: 25 },
        { activity_date: '2025-10-31', active_accounts: 48, episodes_watched: 220, movies_watched: 28 },
      ];

      const mockNewAccountsCount = 25;

      const mockPreviousPeriodData = {
        activeAccounts: 40,
        episodesWatched: 600,
        moviesWatched: 75,
      };

      (adminStatsRepository.getPlatformTrends as Mock).mockResolvedValue(mockTrendsData);
      (adminStatsRepository.getNewAccountsCount as Mock).mockResolvedValue(mockNewAccountsCount);
      (adminStatsRepository.getPreviousPeriodActivity as Mock).mockResolvedValue(mockPreviousPeriodData);

      const result = await adminStatisticsService.getPlatformTrends(30);

      expect(adminStatsRepository.getPlatformTrends).toHaveBeenCalledWith(30);
      expect(adminStatsRepository.getNewAccountsCount).toHaveBeenCalledWith(30);
      expect(adminStatsRepository.getPreviousPeriodActivity).toHaveBeenCalledWith(30);

      expect(result.periodDays).toBe(30);
      expect(result.newAccountsInPeriod).toBe(25);
      expect(result.episodesWatchedInPeriod).toBe(670); // 250 + 200 + 220
      expect(result.moviesWatchedInPeriod).toBe(83); // 30 + 25 + 28
      expect(result.dailyActivity).toHaveLength(3);
    });

    it('should calculate trends correctly with increase', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockTrendsData = [
        { activity_date: '2025-11-02', active_accounts: 50, episodes_watched: 100, movies_watched: 10 },
        { activity_date: '2025-11-01', active_accounts: 45, episodes_watched: 120, movies_watched: 15 },
        { activity_date: '2025-10-31', active_accounts: 48, episodes_watched: 80, movies_watched: 10 },
      ];

      const mockPreviousPeriodData = {
        activeAccounts: 2, // Previous period had 2 unique active account counts
        episodesWatched: 200,
        moviesWatched: 20,
      };

      (adminStatsRepository.getPlatformTrends as Mock).mockResolvedValue(mockTrendsData);
      (adminStatsRepository.getNewAccountsCount as Mock).mockResolvedValue(10);
      (adminStatsRepository.getPreviousPeriodActivity as Mock).mockResolvedValue(mockPreviousPeriodData);

      const result = await adminStatisticsService.getPlatformTrends(30);

      // DAU trend: Set has 3 unique values (50, 45, 48), so size = 3
      // ((3 - 2) / 2) * 100 = 50%
      expect(result.dailyActiveUsersTrend).toBe(50);

      // Watch activity trend: ((300 + 15 - 220) / 220) * 100
      // Current: 100 + 120 + 80 + 10 + 15 + 10 = 335
      // Previous: 200 + 20 = 220
      // ((335 - 220) / 220) * 100 = 52.27%
      expect(result.watchActivityTrend).toBe(52.27);
    });

    it('should handle zero previous period data', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockTrendsData = [
        { activity_date: '2025-11-02', active_accounts: 50, episodes_watched: 100, movies_watched: 10 },
      ];

      const mockPreviousPeriodData = {
        activeAccounts: 0,
        episodesWatched: 0,
        moviesWatched: 0,
      };

      (adminStatsRepository.getPlatformTrends as Mock).mockResolvedValue(mockTrendsData);
      (adminStatsRepository.getNewAccountsCount as Mock).mockResolvedValue(5);
      (adminStatsRepository.getPreviousPeriodActivity as Mock).mockResolvedValue(mockPreviousPeriodData);

      const result = await adminStatisticsService.getPlatformTrends(30);

      expect(result.dailyActiveUsersTrend).toBe(0);
      expect(result.watchActivityTrend).toBe(0);
    });

    it('should handle empty trends data', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatsRepository.getPlatformTrends as Mock).mockResolvedValue([]);
      (adminStatsRepository.getNewAccountsCount as Mock).mockResolvedValue(0);
      (adminStatsRepository.getPreviousPeriodActivity as Mock).mockResolvedValue({
        activeAccounts: 0,
        episodesWatched: 0,
        moviesWatched: 0,
      });

      const result = await adminStatisticsService.getPlatformTrends(30);

      expect(result.episodesWatchedInPeriod).toBe(0);
      expect(result.moviesWatchedInPeriod).toBe(0);
      expect(result.dailyActivity).toHaveLength(0);
    });

    it('should use default days parameter', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (adminStatsRepository.getPlatformTrends as Mock).mockResolvedValue([]);
      (adminStatsRepository.getNewAccountsCount as Mock).mockResolvedValue(0);
      (adminStatsRepository.getPreviousPeriodActivity as Mock).mockResolvedValue({
        activeAccounts: 0,
        episodesWatched: 0,
        moviesWatched: 0,
      });

      await adminStatisticsService.getPlatformTrends();

      expect(adminStatsRepository.getPlatformTrends).toHaveBeenCalledWith(30);
      expect(adminStatsRepository.getNewAccountsCount).toHaveBeenCalledWith(30);
      expect(adminStatsRepository.getPreviousPeriodActivity).toHaveBeenCalledWith(30);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (adminStatsRepository.getPlatformTrends as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getPlatformTrends(60)).rejects.toThrow('Handled: Database query failed');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getPlatformTrends(60)');
    });
  });
});
