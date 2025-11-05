import {
  getAccountHealthMetrics,
  getAccountRankings,
  getAllAccountHealthMetrics,
} from '@db/statistics/accountComparisonRepository';
import { getDbPool } from '@utils/db';

const mockDbMonitorInstance = {
  executeWithTiming: jest.fn((name: string, fn: () => any) => fn()),
};

// Mock dependencies
jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
}));

jest.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: jest.fn(() => mockDbMonitorInstance),
  },
}));

describe('accountComparisonRepository', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Create mock pool
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
    };

    // Set up getDbPool to return mock pool
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    // Reset DbMonitor mock
    mockDbMonitorInstance.executeWithTiming.mockClear();
    mockDbMonitorInstance.executeWithTiming.mockImplementation((name: string, fn: () => any) => fn());
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

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getAccountRankings('episodesWatched', 50);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_episodes_watched DESC'),
        [50],
      );
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return account rankings by moviesWatched', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('moviesWatched', 50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY total_movies_watched DESC'), [
        50,
      ]);
    });

    it('should return account rankings by hoursWatched', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('hoursWatched', 50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY total_hours_watched DESC'), [
        50,
      ]);
    });

    it('should return account rankings by engagement', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('engagement', 50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY engagement_score DESC'), [
        50,
      ]);
    });

    it('should use default limit if not provided', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('episodesWatched');

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [50]);
    });

    it('should handle custom limit parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('episodesWatched', 100);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [100]);
    });

    it('should return empty array when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getAccountRankings('episodesWatched', 50);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
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

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getAccountRankings('episodesWatched', 50);

      expect(result).toEqual(mockRows);
      expect(result[0].engagement_score).toBe(0);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getAccountRankings('episodesWatched', 50)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountRankings('episodesWatched', 50);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getAccountRankings', expect.any(Function));
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

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getAllAccountHealthMetrics();

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY days_since_last_activity'));
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no accounts', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getAllAccountHealthMetrics();

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
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

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getAllAccountHealthMetrics();

      expect(result[0].days_since_last_activity).toBe(9999);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getAllAccountHealthMetrics()).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAllAccountHealthMetrics();

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getAllAccountHealthMetrics',
        expect.any(Function),
      );
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

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(1);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('WHERE a.id = ?'), [1]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRow);
    });

    it('should return null when account not found', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getAccountHealthMetrics(999);

      expect(result).toBeNull();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
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

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

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

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

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

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getAccountHealthMetrics(3);

      expect(result?.email_verified).toBe(false);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getAccountHealthMetrics(1)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getAccountHealthMetrics(1);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getAccountHealthMetrics',
        expect.any(Function),
      );
    });
  });
});
