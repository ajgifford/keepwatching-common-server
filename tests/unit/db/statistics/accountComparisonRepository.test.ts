import { setupDatabaseTest } from '../helpers/dbTestSetup';
import {
  getAccountHealthMetrics,
  getAccountRankings,
  getAllAccountHealthMetrics,
} from '@db/statistics/accountComparisonRepository';

describe('accountComparisonRepository', () => {
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

  describe('getAccountRankings', () => {
    it('should return account rankings by episodesWatched', async () => {
      const mockRows = [
        {
          account_id: 1,
          account_email: 'user1@example.com',
          account_name: 'User One',
          profile_count: 3,
          total_episodes_watched: 500,
          total_movies_watched: 50,
          total_hours_watched: 450.5,
          engagement_score: 100,
          last_activity_date: '2025-11-02',
        },
        {
          account_id: 2,
          account_email: 'user2@example.com',
          account_name: 'User Two',
          profile_count: 2,
          total_episodes_watched: 400,
          total_movies_watched: 40,
          total_hours_watched: 350.0,
          engagement_score: 100,
          last_activity_date: '2025-11-01',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAccountRankings('episodesWatched', 50);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY total_episodes_watched DESC'));
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 50'));

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return account rankings by moviesWatched', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getAccountRankings('moviesWatched', 50);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY total_movies_watched DESC'));
    });

    it('should return account rankings by hoursWatched', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getAccountRankings('hoursWatched', 50);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY total_hours_watched DESC'));
    });

    it('should return account rankings by engagement', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getAccountRankings('engagement', 50);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY engagement_score DESC'));
    });

    it('should use default limit if not provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getAccountRankings('episodesWatched');

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 50'));
    });

    it('should handle custom limit parameter', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getAccountRankings('episodesWatched', 100);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 100'));
    });

    it('should return empty array when no data', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAccountRankings('episodesWatched', 50);

      expect(result).toEqual([]);
    });

    it('should handle accounts with no activity', async () => {
      const mockRows = [
        {
          account_id: 3,
          account_email: 'user3@example.com',
          account_name: 'User Three',
          profile_count: 1,
          total_episodes_watched: 0,
          total_movies_watched: 0,
          total_hours_watched: 0,
          engagement_score: 0,
          last_activity_date: null,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAccountRankings('episodesWatched', 50);

      expect(result).toEqual(mockRows);
      expect(result[0].engagement_score).toBe(0);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getAccountRankings('episodesWatched', 50)).rejects.toThrow('Database error');
    });
  });

  describe('getAllAccountHealthMetrics', () => {
    it('should return health metrics for all accounts', async () => {
      const mockRows = [
        {
          account_id: 1,
          account_email: 'user1@example.com',
          email_verified: true,
          account_created_at: '2024-01-01',
          profile_count: 3,
          total_episodes_watched: 500,
          recent_episodes_watched: 50,
          last_activity_date: '2025-11-02',
          days_since_last_activity: 0,
        },
        {
          account_id: 2,
          account_email: 'user2@example.com',
          email_verified: false,
          account_created_at: '2024-06-15',
          profile_count: 1,
          total_episodes_watched: 100,
          recent_episodes_watched: 0,
          last_activity_date: '2025-08-15',
          days_since_last_activity: 79,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAllAccountHealthMetrics();

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY days_since_last_activity'));

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no accounts', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAllAccountHealthMetrics();

      expect(result).toEqual([]);
    });

    it('should handle accounts with no activity', async () => {
      const mockRows = [
        {
          account_id: 3,
          account_email: 'user3@example.com',
          email_verified: true,
          account_created_at: '2024-01-01',
          profile_count: 1,
          total_episodes_watched: 0,
          recent_episodes_watched: 0,
          last_activity_date: null,
          days_since_last_activity: 9999,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAllAccountHealthMetrics();

      expect(result[0].days_since_last_activity).toBe(9999);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getAllAccountHealthMetrics()).rejects.toThrow('Database error');
    });
  });

  describe('getAccountHealthMetrics', () => {
    it('should return health metrics for specific account', async () => {
      const mockRow = {
        account_id: 1,
        account_email: 'user1@example.com',
        email_verified: true,
        account_created_at: '2024-01-01',
        profile_count: 3,
        total_episodes_watched: 500,
        recent_episodes_watched: 50,
        last_activity_date: '2025-11-02',
        days_since_last_activity: 0,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(1);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE a.account_id = ?'), [1]);

      expect(result).toEqual(mockRow);
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAccountHealthMetrics(999);

      expect(result).toBeNull();
    });

    it('should handle account with no profiles', async () => {
      const mockRow = {
        account_id: 2,
        account_email: 'user2@example.com',
        email_verified: true,
        account_created_at: '2024-01-01',
        profile_count: 0,
        total_episodes_watched: 0,
        recent_episodes_watched: 0,
        last_activity_date: null,
        days_since_last_activity: 9999,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(2);

      expect(result).toEqual(mockRow);
    });

    it('should handle account with recent activity', async () => {
      const mockRow = {
        account_id: 1,
        account_email: 'user1@example.com',
        email_verified: true,
        account_created_at: '2024-01-01',
        profile_count: 2,
        total_episodes_watched: 250,
        recent_episodes_watched: 45,
        last_activity_date: '2025-11-01',
        days_since_last_activity: 1,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(1);

      expect(result?.recent_episodes_watched).toBe(45);
      expect(result?.days_since_last_activity).toBe(1);
    });

    it('should handle unverified email', async () => {
      const mockRow = {
        account_id: 3,
        account_email: 'user3@example.com',
        email_verified: false,
        account_created_at: '2024-01-01',
        profile_count: 1,
        total_episodes_watched: 10,
        recent_episodes_watched: 5,
        last_activity_date: '2025-10-01',
        days_since_last_activity: 32,
      };

      mockPool.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(3);

      expect(result?.email_verified).toBe(false);
    });

    it('should handle error', async () => {
      const mockError = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(getAccountHealthMetrics(1)).rejects.toThrow('Database error');
    });
  });
});
