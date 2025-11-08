import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/statisticsDb');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');

describe('Statistics - Activity - Profile', () => {
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

  describe('getDailyActivity', () => {
    it('should return daily activity from cache if available', async () => {
      const mockDailyActivity = [
        { date: '2024-01-01', episodesWatched: 5, showsWatched: 2 },
        { date: '2024-01-02', episodesWatched: 3, showsWatched: 1 },
      ];

      mockCacheService.getOrSet.mockResolvedValue(mockDailyActivity);

      const result = await profileStatisticsService.getDailyActivity(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_daily_activity_30',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockDailyActivity);
      expect(statisticsDb.getDailyActivityTimeline).not.toHaveBeenCalled();
    });

    it('should fetch and return daily activity on cache miss', async () => {
      const mockDailyActivity = [
        { date: '2024-01-01', episodesWatched: 5, showsWatched: 2 },
        { date: '2024-01-02', episodesWatched: 3, showsWatched: 1 },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getDailyActivityTimeline as Mock).mockResolvedValue(mockDailyActivity);

      const result = await profileStatisticsService.getDailyActivity(123, 30);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_daily_activity_30',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getDailyActivityTimeline).toHaveBeenCalledWith(123, 30);
      expect(result).toEqual(mockDailyActivity);
    });

    it('should handle errors when getting daily activity', async () => {
      const error = new Error('Failed to get daily activity');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getDailyActivityTimeline as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getDailyActivity(123)).rejects.toThrow(
        'Handled: Failed to get daily activity',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getDailyActivity(123, 30)');
    });
  });

  describe('getWeeklyActivity', () => {
    it('should return weekly activity from cache if available', async () => {
      const mockWeeklyActivity = [
        { weekStart: '2024-01-01', episodesWatched: 15 },
        { weekStart: '2024-01-08', episodesWatched: 12 },
      ];

      mockCacheService.getOrSet.mockResolvedValue(mockWeeklyActivity);

      const result = await profileStatisticsService.getWeeklyActivity(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_weekly_activity_12',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockWeeklyActivity);
      expect(statisticsDb.getWeeklyActivityTimeline).not.toHaveBeenCalled();
    });

    it('should fetch and return weekly activity on cache miss', async () => {
      const mockWeeklyActivity = [
        { weekStart: '2024-01-01', episodesWatched: 15 },
        { weekStart: '2024-01-08', episodesWatched: 12 },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWeeklyActivityTimeline as Mock).mockResolvedValue(mockWeeklyActivity);

      const result = await profileStatisticsService.getWeeklyActivity(123, 12);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_weekly_activity_12',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getWeeklyActivityTimeline).toHaveBeenCalledWith(123, 12);
      expect(result).toEqual(mockWeeklyActivity);
    });

    it('should handle errors when getting weekly activity', async () => {
      const error = new Error('Failed to get weekly activity');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWeeklyActivityTimeline as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getWeeklyActivity(123)).rejects.toThrow(
        'Handled: Failed to get weekly activity',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWeeklyActivity(123, 12)');
    });
  });

  describe('getMonthlyActivity', () => {
    it('should return monthly activity from cache if available', async () => {
      const mockMonthlyActivity = [
        { month: '2024-01', episodesWatched: 45, moviesWatched: 5 },
        { month: '2024-02', episodesWatched: 38, moviesWatched: 3 },
      ];

      mockCacheService.getOrSet.mockResolvedValue(mockMonthlyActivity);

      const result = await profileStatisticsService.getMonthlyActivity(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_monthly_activity_12',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockMonthlyActivity);
      expect(statisticsDb.getMonthlyActivityTimeline).not.toHaveBeenCalled();
    });

    it('should fetch and return monthly activity on cache miss', async () => {
      const mockMonthlyActivity = [
        { month: '2024-01', episodesWatched: 45, moviesWatched: 5 },
        { month: '2024-02', episodesWatched: 38, moviesWatched: 3 },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getMonthlyActivityTimeline as Mock).mockResolvedValue(mockMonthlyActivity);

      const result = await profileStatisticsService.getMonthlyActivity(123, 12);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_monthly_activity_12',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getMonthlyActivityTimeline).toHaveBeenCalledWith(123, 12);
      expect(result).toEqual(mockMonthlyActivity);
    });

    it('should handle errors when getting monthly activity', async () => {
      const error = new Error('Failed to get monthly activity');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getMonthlyActivityTimeline as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getMonthlyActivity(123)).rejects.toThrow(
        'Handled: Failed to get monthly activity',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMonthlyActivity(123, 12)');
    });
  });

  describe('getActivityTimeline', () => {
    it('should return combined activity timeline', async () => {
      const mockDailyActivity = [{ date: '2024-01-01', episodesWatched: 5, showsWatched: 2 }];
      const mockWeeklyActivity = [{ weekStart: '2024-01-01', episodesWatched: 15 }];
      const mockMonthlyActivity = [{ month: '2024-01', episodesWatched: 45, moviesWatched: 5 }];

      vi.spyOn(profileStatisticsService, 'getDailyActivity').mockResolvedValue(mockDailyActivity as any);
      vi.spyOn(profileStatisticsService, 'getWeeklyActivity').mockResolvedValue(mockWeeklyActivity as any);
      vi.spyOn(profileStatisticsService, 'getMonthlyActivity').mockResolvedValue(mockMonthlyActivity as any);

      const result = await profileStatisticsService.getActivityTimeline(123);

      expect(profileStatisticsService.getDailyActivity).toHaveBeenCalledWith(123, 30);
      expect(profileStatisticsService.getWeeklyActivity).toHaveBeenCalledWith(123, 12);
      expect(profileStatisticsService.getMonthlyActivity).toHaveBeenCalledWith(123, 12);
      expect(result).toEqual({
        dailyActivity: mockDailyActivity,
        weeklyActivity: mockWeeklyActivity,
        monthlyActivity: mockMonthlyActivity,
      });
    });

    it('should handle errors when getting activity timeline', async () => {
      const error = new Error('Failed to get activity timeline');
      vi.spyOn(profileStatisticsService, 'getDailyActivity').mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getActivityTimeline(123)).rejects.toThrow(
        'Handled: Failed to get activity timeline',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getActivityTimeline(123)');
    });
  });
});
