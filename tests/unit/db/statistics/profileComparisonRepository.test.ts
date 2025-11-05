import { getProfileComparisonData } from '@db/statistics/profileComparisonRepository';
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

describe('profileComparisonRepository', () => {
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

  describe('getProfileComparisonData', () => {
    it('should return complete profile comparison data', async () => {
      const mockProfileRows = [
        {
          profile_id: 1,
          profile_name: 'Profile 1',
          total_shows: 50,
          total_movies: 30,
          episodes_watched: 500,
          movies_watched: 25,
          total_hours_watched: 450.5,
          show_watch_progress: 75.5,
          movie_watch_progress: 83.33,
          last_activity_date: '2025-11-02',
          currently_watching_count: 10,
          completed_shows_count: 35,
        },
        {
          profile_id: 2,
          profile_name: 'Profile 2',
          total_shows: 30,
          total_movies: 20,
          episodes_watched: 300,
          movies_watched: 15,
          total_hours_watched: 280.0,
          show_watch_progress: 60.0,
          movie_watch_progress: 75.0,
          last_activity_date: '2025-11-01',
          currently_watching_count: 8,
          completed_shows_count: 18,
        },
      ];

      const mockGenreRows = [
        {
          profile_id: 1,
          genre_name: 'Drama',
          genre_count: 25,
        },
        {
          profile_id: 1,
          genre_name: 'Comedy',
          genre_count: 20,
        },
        {
          profile_id: 2,
          genre_name: 'Action',
          genre_count: 15,
        },
      ];

      const mockServiceRows = [
        {
          profile_id: 1,
          service_name: 'Netflix',
          service_count: 30,
        },
        {
          profile_id: 1,
          service_name: 'HBO Max',
          service_count: 15,
        },
        {
          profile_id: 2,
          service_name: 'Amazon Prime',
          service_count: 20,
        },
      ];

      const mockVelocityRows = [
        {
          profile_id: 1,
          episodes_per_week: 12.5,
          most_active_day: 'Friday',
        },
        {
          profile_id: 2,
          episodes_per_week: 8.3,
          most_active_day: 'Saturday',
        },
      ];

      const mockSummaryRow = {
        total_unique_shows: 65,
        total_unique_movies: 42,
        most_watched_show_id: 123,
        most_watched_show_title: 'Popular Show',
        most_watched_show_count: 3,
        most_watched_movie_id: 456,
        most_watched_movie_title: 'Popular Movie',
        most_watched_movie_count: 2,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockProfileRows])
        .mockResolvedValueOnce([mockGenreRows])
        .mockResolvedValueOnce([mockServiceRows])
        .mockResolvedValueOnce([mockVelocityRows])
        .mockResolvedValueOnce([[mockSummaryRow]]);

      const result = await getProfileComparisonData(1);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledTimes(5);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result.profiles).toEqual(mockProfileRows);
      expect(result.genres).toEqual(mockGenreRows);
      expect(result.services).toEqual(mockServiceRows);
      expect(result.velocity).toEqual(mockVelocityRows);
      expect(result.accountSummary).toEqual(mockSummaryRow);
    });

    it('should handle account with no profiles', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileComparisonData(999);

      expect(result.profiles).toEqual([]);
      expect(result.genres).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.velocity).toEqual([]);
      expect(result.accountSummary).toEqual({
        total_unique_shows: 0,
        total_unique_movies: 0,
        most_watched_show_id: null,
        most_watched_show_title: null,
        most_watched_show_count: null,
        most_watched_movie_id: null,
        most_watched_movie_title: null,
        most_watched_movie_count: null,
      });
    });

    it('should handle profiles with no activity', async () => {
      const mockProfileRows = [
        {
          profile_id: 1,
          profile_name: 'Inactive Profile',
          total_shows: 5,
          total_movies: 2,
          episodes_watched: 0,
          movies_watched: 0,
          total_hours_watched: 0,
          show_watch_progress: 0,
          movie_watch_progress: 0,
          last_activity_date: '1970-01-01',
          currently_watching_count: 0,
          completed_shows_count: 0,
        },
      ];

      const mockSummaryRow = {
        total_unique_shows: 5,
        total_unique_movies: 2,
        most_watched_show_id: null,
        most_watched_show_title: null,
        most_watched_show_count: null,
        most_watched_movie_id: null,
        most_watched_movie_title: null,
        most_watched_movie_count: null,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockProfileRows])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              episodes_per_week: 0,
              most_active_day: 'Monday',
            },
          ],
        ])
        .mockResolvedValueOnce([[mockSummaryRow]]);

      const result = await getProfileComparisonData(1);

      expect(result.profiles[0].episodes_watched).toBe(0);
      expect(result.profiles[0].movies_watched).toBe(0);
      expect(result.profiles[0].total_hours_watched).toBe(0);
      expect(result.genres).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.accountSummary).toEqual(mockSummaryRow);
    });

    it('should handle profiles with only shows', async () => {
      const mockProfileRows = [
        {
          profile_id: 1,
          profile_name: 'Shows Only',
          total_shows: 40,
          total_movies: 0,
          episodes_watched: 400,
          movies_watched: 0,
          total_hours_watched: 320.0,
          show_watch_progress: 80.0,
          movie_watch_progress: 0,
          last_activity_date: '2025-11-02',
          currently_watching_count: 5,
          completed_shows_count: 30,
        },
      ];

      const mockSummaryRow = {
        total_unique_shows: 40,
        total_unique_movies: 0,
        most_watched_show_id: 123,
        most_watched_show_title: 'Popular Show',
        most_watched_show_count: 1,
        most_watched_movie_id: null,
        most_watched_movie_title: null,
        most_watched_movie_count: null,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockProfileRows])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              genre_name: 'Drama',
              genre_count: 20,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              service_name: 'Netflix',
              service_count: 25,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              episodes_per_week: 10.0,
              most_active_day: 'Sunday',
            },
          ],
        ])
        .mockResolvedValueOnce([[mockSummaryRow]]);

      const result = await getProfileComparisonData(1);

      expect(result.profiles[0].total_movies).toBe(0);
      expect(result.profiles[0].movies_watched).toBe(0);
      expect(result.accountSummary.most_watched_movie_id).toBeNull();
    });

    it('should handle profiles with only movies', async () => {
      const mockProfileRows = [
        {
          profile_id: 1,
          profile_name: 'Movies Only',
          total_shows: 0,
          total_movies: 50,
          episodes_watched: 0,
          movies_watched: 45,
          total_hours_watched: 90.0,
          show_watch_progress: 0,
          movie_watch_progress: 90.0,
          last_activity_date: '2025-11-02',
          currently_watching_count: 0,
          completed_shows_count: 0,
        },
      ];

      const mockSummaryRow = {
        total_unique_shows: 0,
        total_unique_movies: 50,
        most_watched_show_id: null,
        most_watched_show_title: null,
        most_watched_show_count: null,
        most_watched_movie_id: 789,
        most_watched_movie_title: 'Popular Movie',
        most_watched_movie_count: 1,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockProfileRows])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              episodes_per_week: 0,
              most_active_day: 'Monday',
            },
          ],
        ])
        .mockResolvedValueOnce([[mockSummaryRow]]);

      const result = await getProfileComparisonData(1);

      expect(result.profiles[0].total_shows).toBe(0);
      expect(result.profiles[0].episodes_watched).toBe(0);
      expect(result.accountSummary.most_watched_show_id).toBeNull();
    });

    it('should handle multiple profiles with mixed activity', async () => {
      const mockProfileRows = [
        {
          profile_id: 1,
          profile_name: 'Profile 1',
          total_shows: 30,
          total_movies: 20,
          episodes_watched: 300,
          movies_watched: 18,
          total_hours_watched: 250.0,
          show_watch_progress: 70.0,
          movie_watch_progress: 90.0,
          last_activity_date: '2025-11-02',
          currently_watching_count: 8,
          completed_shows_count: 18,
        },
        {
          profile_id: 2,
          profile_name: 'Profile 2',
          total_shows: 20,
          total_movies: 30,
          episodes_watched: 150,
          movies_watched: 25,
          total_hours_watched: 180.0,
          show_watch_progress: 50.0,
          movie_watch_progress: 83.33,
          last_activity_date: '2025-11-01',
          currently_watching_count: 5,
          completed_shows_count: 8,
        },
      ];

      const mockSummaryRow = {
        total_unique_shows: 45,
        total_unique_movies: 48,
        most_watched_show_id: 100,
        most_watched_show_title: 'Shared Show',
        most_watched_show_count: 2,
        most_watched_movie_id: 200,
        most_watched_movie_title: 'Shared Movie',
        most_watched_movie_count: 2,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockProfileRows])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            {
              profile_id: 1,
              episodes_per_week: 10.0,
              most_active_day: 'Friday',
            },
            {
              profile_id: 2,
              episodes_per_week: 7.5,
              most_active_day: 'Saturday',
            },
          ],
        ])
        .mockResolvedValueOnce([[mockSummaryRow]]);

      const result = await getProfileComparisonData(1);

      expect(result.profiles).toHaveLength(2);
      expect(result.velocity).toHaveLength(2);
      expect(result.accountSummary.most_watched_show_count).toBe(2);
      expect(result.accountSummary.most_watched_movie_count).toBe(2);
    });

    it('should query with correct account ID parameter', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileComparisonData(123);

      expect(mockConnection.query).toHaveBeenNthCalledWith(1, expect.any(String), [123]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, expect.any(String), [123]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(3, expect.any(String), [123]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(4, expect.any(String), [123]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(5, expect.any(String), [123, 123, 123, 123, 123, 123, 123]);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getProfileComparisonData(1)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should call DbMonitor.executeWithTiming', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileComparisonData(1);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getProfileComparisonData',
        expect.any(Function),
      );
    });

    it('should handle top 3 genres per profile', async () => {
      const mockGenreRows = [
        {
          profile_id: 1,
          genre_name: 'Drama',
          genre_count: 30,
        },
        {
          profile_id: 1,
          genre_name: 'Comedy',
          genre_count: 25,
        },
        {
          profile_id: 1,
          genre_name: 'Action',
          genre_count: 20,
        },
      ];

      mockConnection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([mockGenreRows])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileComparisonData(1);

      expect(result.genres).toHaveLength(3);
      expect(result.genres[0].genre_count).toBe(30);
      expect(result.genres[1].genre_count).toBe(25);
      expect(result.genres[2].genre_count).toBe(20);
    });

    it('should handle top 3 services per profile', async () => {
      const mockServiceRows = [
        {
          profile_id: 1,
          service_name: 'Netflix',
          service_count: 40,
        },
        {
          profile_id: 1,
          service_name: 'HBO Max',
          service_count: 30,
        },
        {
          profile_id: 1,
          service_name: 'Amazon Prime',
          service_count: 25,
        },
      ];

      mockConnection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([mockServiceRows])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileComparisonData(1);

      expect(result.services).toHaveLength(3);
      expect(result.services[0].service_count).toBe(40);
      expect(result.services[1].service_count).toBe(30);
      expect(result.services[2].service_count).toBe(25);
    });
  });
});
