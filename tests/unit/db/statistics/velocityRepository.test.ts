import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getWatchingVelocityData } from '@db/statistics/velocityRepository';

describe('velocityRepository', () => {
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

  describe('getWatchingVelocityData', () => {
    it('should return velocity statistics with valid data', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 5,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 4,
        },
        {
          watch_date: '2025-10-14',
          episode_count: 3,
          show_count: 1,
          watch_hour: 19,
          day_of_week: 3,
        },
        {
          watch_date: '2025-10-13',
          episode_count: 4,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 2,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 30]);

      expect(result).toMatchObject({
        episodesPerWeek: expect.any(Number),
        episodesPerMonth: expect.any(Number),
        averageEpisodesPerDay: expect.any(Number),
        mostActiveDay: expect.any(String),
        mostActiveHour: expect.any(Number),
        velocityTrend: expect.stringMatching(/^(increasing|decreasing|stable)$/),
      });

      // Verify calculations
      expect(result.averageEpisodesPerDay).toBeGreaterThan(0);
      expect(result.episodesPerWeek).toBeGreaterThan(0);
      expect(result.episodesPerMonth).toBeGreaterThan(0);
    });

    it('should return empty statistics when no data is available', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result).toEqual({
        episodesPerWeek: 0,
        episodesPerMonth: 0,
        averageEpisodesPerDay: 0,
        mostActiveDay: 'N/A',
        mostActiveHour: 0,
        velocityTrend: 'stable',
      });
    });

    it('should handle different days parameter', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 5,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 4,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      await getWatchingVelocityData(123, 60);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [123, 60]);
    });

    it('should calculate most active hour correctly', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 5,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 4,
        },
        {
          watch_date: '2025-10-14',
          episode_count: 7,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 3,
        },
        {
          watch_date: '2025-10-13',
          episode_count: 2,
          show_count: 1,
          watch_hour: 14,
          day_of_week: 2,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result.mostActiveHour).toBe(20);
    });

    it('should calculate most active day correctly', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 10,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 4, // Wednesday
        },
        {
          watch_date: '2025-10-14',
          episode_count: 2,
          show_count: 1,
          watch_hour: 19,
          day_of_week: 3, // Tuesday
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result.mostActiveDay).toBe('Wednesday');
    });

    it('should determine increasing trend correctly', async () => {
      // Create data with increasing trend (recent half has more episodes)
      const mockRows = Array.from({ length: 30 }, (_, i) => ({
        watch_date: `2025-10-${String(30 - i).padStart(2, '0')}`,
        episode_count: i < 15 ? 10 : 3, // Recent half (first 15) has more episodes
        show_count: 1,
        watch_hour: 20,
        day_of_week: (i % 7) + 1,
      }));

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result.velocityTrend).toBe('increasing');
    });

    it('should determine decreasing trend correctly', async () => {
      // Create data with decreasing trend (recent half has fewer episodes)
      const mockRows = Array.from({ length: 30 }, (_, i) => ({
        watch_date: `2025-10-${String(30 - i).padStart(2, '0')}`,
        episode_count: i < 15 ? 3 : 10, // Recent half (first 15) has fewer episodes
        show_count: 1,
        watch_hour: 20,
        day_of_week: (i % 7) + 1,
      }));

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result.velocityTrend).toBe('decreasing');
    });

    it('should determine stable trend when data is insufficient', async () => {
      // Create data with fewer than 14 unique days
      const mockRows = Array.from({ length: 10 }, (_, i) => ({
        watch_date: `2025-10-${String(i + 1).padStart(2, '0')}`,
        episode_count: 5,
        show_count: 1,
        watch_hour: 20,
        day_of_week: (i % 7) + 1,
      }));

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      expect(result.velocityTrend).toBe('stable');
    });

    it('should round statistics correctly', async () => {
      const mockRows = [
        {
          watch_date: '2025-10-15',
          episode_count: 7,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 4,
        },
        {
          watch_date: '2025-10-14',
          episode_count: 4,
          show_count: 1,
          watch_hour: 19,
          day_of_week: 3,
        },
        {
          watch_date: '2025-10-13',
          episode_count: 5,
          show_count: 2,
          watch_hour: 20,
          day_of_week: 2,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getWatchingVelocityData(123, 30);

      // Average per day should be rounded to 1 decimal place
      expect(Number(result.averageEpisodesPerDay.toFixed(1))).toBe(result.averageEpisodesPerDay);
      // Episodes per week should be rounded to 1 decimal place
      expect(Number(result.episodesPerWeek.toFixed(1))).toBe(result.episodesPerWeek);
      // Episodes per month should be a whole number
      expect(Number.isInteger(result.episodesPerMonth)).toBe(true);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getWatchingVelocityData(123, 30)).rejects.toThrow('Database error');
    });
  });
});
