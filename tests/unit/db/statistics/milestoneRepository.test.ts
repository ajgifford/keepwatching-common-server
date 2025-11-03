import { MILESTONE_THRESHOLDS, Milestone } from '@ajgifford/keepwatching-types';
import { getMilestoneStats } from '@db/statistics/milestoneRepository';
import { getDbPool } from '@utils/db';
import { calculateMilestones } from '@utils/statisticsUtil';

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

describe('statisticsDb', () => {
  let mockConnection: any;
  let mockPool: any;

  const fixedDate = new Date('2025-11-01T12:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

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

  describe('getMilestoneStats', () => {
    it('should return empty object when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getMilestoneStats(123);

      const expectedResult = {
        totalEpisodesWatched: 0,
        totalMoviesWatched: 0,
        totalHoursWatched: 0,
        profileCreatedAt: undefined,
        firstEpisodeWatchedAt: undefined,
        firstMovieWatchedAt: undefined,
        milestones: generateMilestones(0, 0, 0),
        recentAchievements: [],
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle null database values', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 0,
          total_runtime_minutes: 0,
          profile_created_at: null,
          first_episode_watched_at: null,
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.profileCreatedAt).toBeUndefined();
      expect(result.firstEpisodeWatchedAt).toBeUndefined();
      expect(result.firstMovieWatchedAt).toBeUndefined();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should return milestone data with no recent achievements', async () => {
      const mockRows = [
        {
          total_episodes_watched: 235,
          total_movies_watched: 15,
          total_runtime_minutes: 1567,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const expectedResult = {
        totalEpisodesWatched: 235,
        totalMoviesWatched: 15,
        totalHoursWatched: 26,
        profileCreatedAt: '2025-01-13T00:00:00.000Z',
        firstEpisodeWatchedAt: '2025-01-16T00:00:00.000Z',
        firstMovieWatchedAt: '2025-01-17T00:00:00.000Z',
        milestones: generateMilestones(235, 15, 26),
        recentAchievements: [],
      };

      const result = await getMilestoneStats(123);
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should return milestone data with recent achievements', async () => {
      const mockRows = [
        {
          total_episodes_watched: 108,
          total_movies_watched: 54,
          total_runtime_minutes: 6300,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      const recentAchievements = [
        {
          achievedDate: now.toISOString(),
          description: '100 Episodes Watched',
        },
        {
          achievedDate: now.toISOString(),
          description: '50 Movies Watched',
        },
        {
          achievedDate: now.toISOString(),
          description: '100 Hours Watched',
        },
      ];

      const expectedResult = {
        totalEpisodesWatched: 108,
        totalMoviesWatched: 54,
        totalHoursWatched: 105,
        profileCreatedAt: '2025-01-13T00:00:00.000Z',
        firstEpisodeWatchedAt: '2025-01-16T00:00:00.000Z',
        firstMovieWatchedAt: '2025-01-17T00:00:00.000Z',
        milestones: generateMilestones(108, 54, 105),
        recentAchievements,
      };

      const result = await getMilestoneStats(123);
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly round runtime minutes to hours', async () => {
      const mockRows = [
        {
          total_episodes_watched: 10,
          total_movies_watched: 5,
          total_runtime_minutes: 125, // Should round to 2 hours
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.totalHoursWatched).toBe(2);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should not include episode achievement when count is beyond threshold + 10', async () => {
      const mockRows = [
        {
          total_episodes_watched: 115, // Beyond 100 + 10 threshold
          total_movies_watched: 0,
          total_runtime_minutes: 0,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should not include movie achievement when count is beyond threshold + 5', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 56, // Beyond 50 + 5 threshold
          total_runtime_minutes: 0,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: null,
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should not include hours achievement when count is beyond threshold + 10', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 0,
          total_runtime_minutes: 6600, // 110 hours, beyond 100 + 10
          profile_created_at: '2025-01-13',
          first_episode_watched_at: null,
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements).toEqual([]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should include episode achievement at exact threshold', async () => {
      const mockRows = [
        {
          total_episodes_watched: 100,
          total_movies_watched: 0,
          total_runtime_minutes: 0,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('100 Episodes Watched');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should include movie achievement at exact threshold', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 50,
          total_runtime_minutes: 0,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: null,
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('50 Movies Watched');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle only episodes watched (no movies)', async () => {
      const mockRows = [
        {
          total_episodes_watched: 150,
          total_movies_watched: 0,
          total_runtime_minutes: 4500,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.totalEpisodesWatched).toBe(150);
      expect(result.totalMoviesWatched).toBe(0);
      expect(result.firstMovieWatchedAt).toBeUndefined();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle only movies watched (no episodes)', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 30,
          total_runtime_minutes: 3600,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: null,
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.totalEpisodesWatched).toBe(0);
      expect(result.totalMoviesWatched).toBe(30);
      expect(result.firstEpisodeWatchedAt).toBeUndefined();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profileId parameters to query', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getMilestoneStats(456);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [456, 456, 456, 456, 456, 456, 456]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection even if query throws error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(getMilestoneStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should use DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getMilestoneStats(123);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getMilestoneStats', expect.any(Function));
    });

    it('should correctly convert date strings to ISO format', async () => {
      const mockRows = [
        {
          total_episodes_watched: 10,
          total_movies_watched: 5,
          total_runtime_minutes: 1000,
          profile_created_at: '2025-01-13T10:30:00',
          first_episode_watched_at: '2025-01-16T14:45:00',
          first_movie_watched_at: '2025-01-17T20:15:00',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.profileCreatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.firstEpisodeWatchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.firstMovieWatchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should combine milestones from all three categories', async () => {
      const mockRows = [
        {
          total_episodes_watched: 100,
          total_movies_watched: 50,
          total_runtime_minutes: 6000,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      const expectedMilestones = generateMilestones(100, 50, 100);
      expect(result.milestones).toEqual(expectedMilestones);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should only include latest milestone as recent achievement', async () => {
      const mockRows = [
        {
          total_episodes_watched: 505, // Has achieved 500, but not recent
          total_movies_watched: 0,
          total_runtime_minutes: 0,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('500 Episodes Watched');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });
});

function generateMilestones(episodes: number, movies: number, hours: number): Milestone[] {
  const episodeMilestones = calculateMilestones(episodes, MILESTONE_THRESHOLDS.episodes, 'episodes');
  const movieMilestones = calculateMilestones(movies, MILESTONE_THRESHOLDS.movies, 'movies');
  const hourMilestones = calculateMilestones(hours, MILESTONE_THRESHOLDS.hours, 'hours');

  return [...episodeMilestones, ...movieMilestones, ...hourMilestones];
}
