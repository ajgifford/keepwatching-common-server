import { setupDatabaseTest } from '../helpers/dbTestSetup';
import {
  getDailyActivityTimeline,
  getMonthlyActivityTimeline,
  getWeeklyActivityTimeline,
} from '@db/statistics/activityRepository';
import { RowDataPacket } from 'mysql2/promise';

describe('activityRepository', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getDailyActivityTimeline(123, 30);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 30]);

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
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getDailyActivityTimeline(123, 30);

      expect(result).toEqual([]);
    });

    it('should handle different days parameter', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getDailyActivityTimeline(123, 60);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 60]);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getDailyActivityTimeline(123, 30)).rejects.toThrow('Database error');
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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWeeklyActivityTimeline(123, 12);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 12]);

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
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getWeeklyActivityTimeline(123, 12);

      expect(result).toEqual([]);
    });

    it('should handle different weeks parameter', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getWeeklyActivityTimeline(123, 24);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 24]);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getWeeklyActivityTimeline(123, 12)).rejects.toThrow('Database error');
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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [123, 12, 123, 12]);

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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

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
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result).toEqual([]);
    });

    it('should handle different months parameter', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getMonthlyActivityTimeline(123, 24);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [123, 24, 123, 24]);
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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getMonthlyActivityTimeline(123, 12);

      expect(result[0].month).toBe('2025-10');
      expect(result[1].month).toBe('2025-09');
      expect(result[2].month).toBe('2025-08');
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getMonthlyActivityTimeline(123, 12)).rejects.toThrow('Database error');
    });

    it('should handle months with only episodes', async () => {
      const mockRows = [
        {
          month: '2025-10',
          episode_count: 45,
          movie_count: 0,
        },
      ] as RowDataPacket[];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

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

      mockPool.execute.mockResolvedValueOnce([mockRows]);

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
