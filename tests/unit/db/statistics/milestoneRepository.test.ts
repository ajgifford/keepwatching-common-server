import { createMilestones } from '../../test-utils/statisticsMockGenerator';
import { getMilestoneStats } from '@db/statistics/milestoneRepository';
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
        milestones: createMilestones(0, 0, 0),
        recentAchievements: [],
      };
      expect(result).toEqual(expectedResult);
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
        milestones: createMilestones(235, 15, 26),
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
        milestones: createMilestones(108, 54, 105),
        recentAchievements,
      };

      const result = await getMilestoneStats(123);
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });
});
