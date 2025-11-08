import {
  getDailyActivityTimeline,
  getMonthlyActivityTimeline,
  getWeeklyActivityTimeline,
} from '@db/statistics/activityRepository';
import { getDbPool } from '@utils/db';
import { RowDataPacket } from 'mysql2/promise';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbMonitorInstance = {
  executeWithTiming: vi.fn((name: string, fn: () => any) => fn()),
};

// Mock dependencies
vi.mock('@utils/db', () => ({
  getDbPool: vi.fn(),
}));

vi.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: vi.fn(() => mockDbMonitorInstance),
  },
}));

describe('activityRepository', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // Create mock pool
    mockPool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    // Set up getDbPool to return mock pool
    (getDbPool as Mock).mockReturnValue(mockPool);

    // Reset DbMonitor mock
    mockDbMonitorInstance.executeWithTiming.mockClear();
    mockDbMonitorInstance.executeWithTiming.mockImplementation((name: string, fn: () => any) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailyActivityTimeline', () => {
    it('should return daily activity data', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 5,
          show_count: 2,
        },
        {
          watch_date: '2025-10-14',
          episode_count: 3,
          show_count: 1,
        },
        {
          watch_date: '2025-10-13',
          episode_count: 4,
          show_count: 2,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getDailyActivityTimeline(123, 30);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 30]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          date: '2025-10-15',
          episodesWatched: 5,
          showsWatched: 2,
        },
        {
          date: '2025-10-14',
          episodesWatched: 3,
          showsWatched: 1,
        },
        {
          date: '2025-10-13',
          episodesWatched: 4,
          showsWatched: 2,
        },
      ]);
    });

    it('should return empty array when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getDailyActivityTimeline(123, 30);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle different days parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getDailyActivityTimeline(123, 60);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 60]);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getDailyActivityTimeline(123, 30)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getDailyActivityTimeline(123, 30);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getDailyActivityTimeline',
        expect.any(Function),
      );
    });
  });

  describe('getWeeklyActivityTimeline', () => {
    it('should return weekly activity data', async () => {
      const mockRows = [
        {
          week_start: '2025-10-13',
          episode_count: 15,
        },
        {
          week_start: '2025-10-06',
          episode_count: 12,
        },
        {
          week_start: '2025-09-29',
          episode_count: 18,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getWeeklyActivityTimeline(123, 12);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 12]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          weekStart: '2025-10-13',
          episodesWatched: 15,
        },
        {
          weekStart: '2025-10-06',
          episodesWatched: 12,
        },
        {
          weekStart: '2025-09-29',
          episodesWatched: 18,
        },
      ]);
    });

    it('should return empty array when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getWeeklyActivityTimeline(123, 12);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle different weeks parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getWeeklyActivityTimeline(123, 24);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 24]);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getWeeklyActivityTimeline(123, 12)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getWeeklyActivityTimeline(123, 12);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getWeeklyActivityTimeline',
        expect.any(Function),
      );
    });
  });

  describe('getMonthlyActivityTimeline', () => {
    it('should return monthly activity data with episodes and movies', async () => {
      const mockRows = [
        {
          month: '2025-10',
          episode_count: 45,
          movie_count: 0,
        },
        {
          month: '2025-10',
          episode_count: 0,
          movie_count: 5,
        },
        {
          month: '2025-09',
          episode_count: 38,
          movie_count: 0,
        },
        {
          month: '2025-09',
          episode_count: 0,
          movie_count: 3,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [123, 12, 123, 12]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        {
          month: '2025-10',
          episodesWatched: 45,
          moviesWatched: 5,
        },
        {
          month: '2025-09',
          episodesWatched: 38,
          moviesWatched: 3,
        },
      ]);
    });

    it('should aggregate episodes and movies by month correctly', async () => {
      const mockRows = [
        {
          month: '2025-10',
          episode_count: 20,
          movie_count: 0,
        },
        {
          month: '2025-10',
          episode_count: 25,
          movie_count: 0,
        },
        {
          month: '2025-10',
          episode_count: 0,
          movie_count: 3,
        },
        {
          month: '2025-10',
          episode_count: 0,
          movie_count: 2,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result).toEqual([
        {
          month: '2025-10',
          episodesWatched: 45,
          moviesWatched: 5,
        },
      ]);
    });

    it('should return empty array when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle different months parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getMonthlyActivityTimeline(123, 24);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [123, 24, 123, 24]);
    });

    it('should sort results by month in descending order', async () => {
      const mockRows = [
        {
          month: '2025-08',
          episode_count: 30,
          movie_count: 0,
        },
        {
          month: '2025-10',
          episode_count: 45,
          movie_count: 0,
        },
        {
          month: '2025-09',
          episode_count: 38,
          movie_count: 0,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result[0].month).toBe('2025-10');
      expect(result[1].month).toBe('2025-09');
      expect(result[2].month).toBe('2025-08');
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getMonthlyActivityTimeline(123, 12)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getMonthlyActivityTimeline(123, 12);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getMonthlyActivityTimeline',
        expect.any(Function),
      );
    });

    it('should handle months with only episodes', async () => {
      const mockRows = [
        {
          month: '2025-10',
          episode_count: 45,
          movie_count: 0,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result).toEqual([
        {
          month: '2025-10',
          episodesWatched: 45,
          moviesWatched: 0,
        },
      ]);
    });

    it('should handle months with only movies', async () => {
      const mockRows = [
        {
          month: '2025-10',
          episode_count: 0,
          movie_count: 5,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result).toEqual([
        {
          month: '2025-10',
          episodesWatched: 0,
          moviesWatched: 5,
        },
      ]);
    });
  });
});
