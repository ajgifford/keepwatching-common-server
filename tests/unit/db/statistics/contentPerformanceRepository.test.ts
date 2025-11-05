import {
  getMovieEngagement,
  getPopularMovies,
  getPopularShows,
  getShowEngagement,
  getTrendingMovies,
  getTrendingShows,
} from '@db/statistics/contentPerformanceRepository';
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

describe('contentPerformanceRepository', () => {
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

  describe('getPopularShows', () => {
    it('should return popular shows with default limit', async () => {
      const mockRows = [
        {
          content_id: 1,
          title: 'Popular Show 1',
          content_type: 'show',
          account_count: 50,
          profile_count: 75,
          total_watch_count: 500,
          completion_rate: 80.5,
          release_year: 2023,
        },
        {
          content_id: 2,
          title: 'Popular Show 2',
          content_type: 'show',
          account_count: 45,
          profile_count: 60,
          total_watch_count: 450,
          completion_rate: 75.0,
          release_year: 2022,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getPopularShows();

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY profile_count DESC'), [20]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should handle custom limit parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getPopularShows(50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [50]);
    });

    it('should return empty array when no shows', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getPopularShows(20);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle shows with zero completion rate', async () => {
      const mockRows = [
        {
          content_id: 3,
          title: 'New Show',
          content_type: 'show',
          account_count: 10,
          profile_count: 15,
          total_watch_count: 5,
          completion_rate: 0,
          release_year: 2025,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getPopularShows(20);

      expect(result[0].completion_rate).toBe(0);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getPopularShows(20)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getPopularShows(20);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getPopularShows', expect.any(Function));
    });
  });

  describe('getPopularMovies', () => {
    it('should return popular movies with default limit', async () => {
      const mockRows = [
        {
          content_id: 1,
          title: 'Popular Movie 1',
          content_type: 'movie',
          account_count: 40,
          profile_count: 55,
          total_watch_count: 50,
          completion_rate: 90.91,
          release_year: 2023,
        },
        {
          content_id: 2,
          title: 'Popular Movie 2',
          content_type: 'movie',
          account_count: 35,
          profile_count: 45,
          total_watch_count: 40,
          completion_rate: 88.89,
          release_year: 2022,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getPopularMovies();

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY profile_count DESC'), [20]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should handle custom limit parameter', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getPopularMovies(50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [50]);
    });

    it('should return empty array when no movies', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getPopularMovies(20);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getPopularMovies(20)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getPopularMovies(20);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getPopularMovies', expect.any(Function));
    });
  });

  describe('getTrendingShows', () => {
    it('should return trending shows with default parameters', async () => {
      const mockRows = [
        {
          content_id: 1,
          title: 'Trending Show 1',
          content_type: 'show',
          new_additions: 25,
          recent_watch_count: 150,
          previous_watch_count: 100,
        },
        {
          content_id: 2,
          title: 'Trending Show 2',
          content_type: 'show',
          new_additions: 20,
          recent_watch_count: 120,
          previous_watch_count: 80,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getTrendingShows();

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING new_additions > 0'),
        [30, 30, 60, 30, 20],
      );
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should handle custom days and limit parameters', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTrendingShows(60, 50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [60, 60, 120, 60, 50]);
    });

    it('should return empty array when no trending shows', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getTrendingShows(30, 20);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle shows with only new additions', async () => {
      const mockRows = [
        {
          content_id: 3,
          title: 'New Show',
          content_type: 'show',
          new_additions: 15,
          recent_watch_count: 0,
          previous_watch_count: 0,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getTrendingShows(30, 20);

      expect(result[0].new_additions).toBe(15);
      expect(result[0].recent_watch_count).toBe(0);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getTrendingShows(30, 20)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTrendingShows(30, 20);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getTrendingShows', expect.any(Function));
    });
  });

  describe('getTrendingMovies', () => {
    it('should return trending movies with default parameters', async () => {
      const mockRows = [
        {
          content_id: 1,
          title: 'Trending Movie 1',
          content_type: 'movie',
          new_additions: 30,
          recent_watch_count: 28,
          previous_watch_count: 15,
        },
        {
          content_id: 2,
          title: 'Trending Movie 2',
          content_type: 'movie',
          new_additions: 25,
          recent_watch_count: 24,
          previous_watch_count: 12,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getTrendingMovies();

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING new_additions > 0'),
        [30, 30, 60, 30, 20],
      );
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should handle custom days and limit parameters', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTrendingMovies(60, 50);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [60, 60, 120, 60, 50]);
    });

    it('should return empty array when no trending movies', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getTrendingMovies(30, 20);

      expect(result).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getTrendingMovies(30, 20)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTrendingMovies(30, 20);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getTrendingMovies', expect.any(Function));
    });
  });

  describe('getShowEngagement', () => {
    it('should return engagement metrics for specific show', async () => {
      const mockRow = {
        content_id: 1,
        title: 'Test Show',
        total_profiles: 100,
        completed_profiles: 30,
        watching_profiles: 50,
        not_started_profiles: 15,
        abandoned_profiles: 5,
        avg_days_to_complete: 45.5,
        avg_progress: 65.75,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getShowEngagement(1);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('WHERE s.id = ?'), [1]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRow);
    });

    it('should return null when show not found', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getShowEngagement(999);

      expect(result).toBeNull();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle show with no profiles', async () => {
      const mockRow = {
        content_id: 2,
        title: 'Unpopular Show',
        total_profiles: 0,
        completed_profiles: 0,
        watching_profiles: 0,
        not_started_profiles: 0,
        abandoned_profiles: 0,
        avg_days_to_complete: 0,
        avg_progress: 0,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getShowEngagement(2);

      expect(result?.total_profiles).toBe(0);
    });

    it('should handle show with high abandonment', async () => {
      const mockRow = {
        content_id: 3,
        title: 'Abandoned Show',
        total_profiles: 50,
        completed_profiles: 5,
        watching_profiles: 10,
        not_started_profiles: 10,
        abandoned_profiles: 25,
        avg_days_to_complete: 20.5,
        avg_progress: 30.0,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getShowEngagement(3);

      expect(result?.abandoned_profiles).toBe(25);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getShowEngagement(1)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getShowEngagement(1);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getShowEngagement', expect.any(Function));
    });
  });

  describe('getMovieEngagement', () => {
    it('should return engagement metrics for specific movie', async () => {
      const mockRow = {
        content_id: 1,
        title: 'Test Movie',
        total_profiles: 80,
        completed_profiles: 70,
        watching_profiles: 0,
        not_started_profiles: 10,
        abandoned_profiles: 0,
        avg_days_to_complete: 0,
        avg_progress: 87.5,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getMovieEngagement(1);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('WHERE m.id = ?'), [1]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual(mockRow);
    });

    it('should return null when movie not found', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getMovieEngagement(999);

      expect(result).toBeNull();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle movie with no profiles', async () => {
      const mockRow = {
        content_id: 2,
        title: 'Unpopular Movie',
        total_profiles: 0,
        completed_profiles: 0,
        watching_profiles: 0,
        not_started_profiles: 0,
        abandoned_profiles: 0,
        avg_days_to_complete: 0,
        avg_progress: 0,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getMovieEngagement(2);

      expect(result?.total_profiles).toBe(0);
    });

    it('should handle movie with full completion', async () => {
      const mockRow = {
        content_id: 3,
        title: 'Highly Watched Movie',
        total_profiles: 100,
        completed_profiles: 100,
        watching_profiles: 0,
        not_started_profiles: 0,
        abandoned_profiles: 0,
        avg_days_to_complete: 0,
        avg_progress: 100.0,
      };

      mockConnection.query.mockResolvedValueOnce([[mockRow]]);

      const result = await getMovieEngagement(3);

      expect(result?.avg_progress).toBe(100.0);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getMovieEngagement(1)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getMovieEngagement(1);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getMovieEngagement', expect.any(Function));
    });
  });
});
