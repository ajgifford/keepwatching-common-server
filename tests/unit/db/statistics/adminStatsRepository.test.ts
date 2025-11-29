import { setupDatabaseTest } from '../helpers/dbTestSetup';
import {
  getNewAccountsCount,
  getPlatformOverview,
  getPlatformTrends,
  getPreviousPeriodActivity,
} from '@db/statistics/adminStatsRepository';

describe('adminStatsRepository', () => {
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

  describe('getPlatformOverview', () => {
    it('should return platform overview statistics', async () => {
      const mockRow = {
        total_accounts: 150,
        active_accounts: 75,
        total_profiles: 300,
        total_shows: 1200,
        total_movies: 800,
        total_episodes_watched: 15000,
        total_movies_watched: 600,
        total_hours_watched: 12500.5,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPlatformOverview();

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'));

      expect(result).toEqual(mockRow);
    });

    it('should handle zero values correctly', async () => {
      const mockRow = {
        total_accounts: 0,
        active_accounts: 0,
        total_profiles: 0,
        total_shows: 0,
        total_movies: 0,
        total_episodes_watched: 0,
        total_movies_watched: 0,
        total_hours_watched: 0,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPlatformOverview();

      expect(result).toEqual(mockRow);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getPlatformOverview()).rejects.toThrow('Database error');
    });
  });

  describe('getPlatformTrends', () => {
    it('should return platform trends for specified days', async () => {
      const mockRows = [
        {
          activity_date: '2025-11-02',
          active_accounts: 50,
          episodes_watched: 250,
          movies_watched: 30,
        },
        {
          activity_date: '2025-11-01',
          active_accounts: 45,
          episodes_watched: 200,
          movies_watched: 25,
        },
        {
          activity_date: '2025-10-31',
          active_accounts: 48,
          episodes_watched: 220,
          movies_watched: 28,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getPlatformTrends(30);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [30, 30]);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(3);
    });

    it('should use default days parameter if not provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getPlatformTrends();

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [30, 30]);
    });

    it('should handle custom days parameter', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getPlatformTrends(60);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [60, 60]);
    });

    it('should return empty array when no data', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getPlatformTrends(30);

      expect(result).toEqual([]);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getPlatformTrends(30)).rejects.toThrow('Database error');
    });
  });

  describe('getNewAccountsCount', () => {
    it('should return count of new accounts', async () => {
      const mockRow = {
        new_accounts: 25,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getNewAccountsCount(30);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), [30]);

      expect(result).toBe(25);
    });

    it('should use default days parameter if not provided', async () => {
      const mockRow = { new_accounts: 10 };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      await getNewAccountsCount();

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), [30]);
    });

    it('should handle custom days parameter', async () => {
      const mockRow = { new_accounts: 50 };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      await getNewAccountsCount(90);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), [90]);
    });

    it('should return 0 when no rows returned', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getNewAccountsCount(30);

      expect(result).toBe(0);
    });

    it('should return 0 when new_accounts is undefined', async () => {
      const mockRow = {};
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getNewAccountsCount(30);

      expect(result).toBe(0);
    });

    it('should handle zero new accounts', async () => {
      const mockRow = { new_accounts: 0 };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getNewAccountsCount(30);

      expect(result).toBe(0);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getNewAccountsCount(30)).rejects.toThrow('Database error');
    });
  });

  describe('getPreviousPeriodActivity', () => {
    it('should return previous period activity metrics', async () => {
      const mockRow = {
        active_accounts: 40,
        episodes_watched: 180,
        movies_watched: 20,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPreviousPeriodActivity(30);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [60, 30, 60, 30]);

      expect(result).toEqual({
        activeAccounts: 40,
        episodesWatched: 180,
        moviesWatched: 20,
      });
    });

    it('should use default days parameter if not provided', async () => {
      const mockRow = {
        active_accounts: 35,
        episodes_watched: 150,
        movies_watched: 15,
      };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      await getPreviousPeriodActivity();

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [60, 30, 60, 30]);
    });

    it('should handle custom days parameter', async () => {
      const mockRow = {
        active_accounts: 50,
        episodes_watched: 200,
        movies_watched: 25,
      };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      await getPreviousPeriodActivity(60);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [120, 60, 120, 60]);
    });

    it('should return zeros when no data', async () => {
      const mockRow = {};
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPreviousPeriodActivity(30);

      expect(result).toEqual({
        activeAccounts: 0,
        episodesWatched: 0,
        moviesWatched: 0,
      });
    });

    it('should handle null values', async () => {
      const mockRow = {
        active_accounts: null,
        episodes_watched: null,
        movies_watched: null,
      };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPreviousPeriodActivity(30);

      expect(result).toEqual({
        activeAccounts: 0,
        episodesWatched: 0,
        moviesWatched: 0,
      });
    });

    it('should handle partial data', async () => {
      const mockRow = {
        active_accounts: 25,
        episodes_watched: null,
        movies_watched: 10,
      };
      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPreviousPeriodActivity(30);

      expect(result).toEqual({
        activeAccounts: 25,
        episodesWatched: 0,
        moviesWatched: 10,
      });
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getPreviousPeriodActivity(30)).rejects.toThrow('Database error');
    });
  });
});
