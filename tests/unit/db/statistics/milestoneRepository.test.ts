import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { MILESTONE_THRESHOLDS, Milestone } from '@ajgifford/keepwatching-types';
import { getRecentAchievements } from '@db/statistics/achievementRepository';
import { getMilestoneStats } from '@db/statistics/milestoneRepository';
import { getDbPool } from '@utils/db';
import { calculateMilestones } from '@utils/statisticsUtil';

// Mock test-specific dependencies
jest.mock('@utils/statisticsUtil', () => ({
  calculateMilestones: jest.fn(),
}));

jest.mock('@db/statistics/achievementRepository', () => ({
  getRecentAchievements: jest.fn(),
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
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockConnection = mocks.mockConnection;
    mockPool = mocks.mockPool;

    // Mock calculateMilestones to return empty array by default
    (calculateMilestones as jest.Mock).mockImplementation((current: number, thresholds: number[], type: string) => {
      if (!thresholds || !Array.isArray(thresholds)) {
        return [];
      }
      return thresholds.map((threshold) => ({
        type,
        threshold,
        achieved: current >= threshold,
        progress: Math.round(Math.min((current / threshold) * 100, 100) * 10) / 10,
      }));
    });

    // Mock getRecentAchievements to return empty array by default
    (getRecentAchievements as jest.Mock).mockResolvedValue([]);
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
        createdAt: undefined,
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

      expect(result.createdAt).toBeUndefined();
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
        createdAt: '2025-01-13T00:00:00.000Z',
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

      // Mock getRecentAchievements to return achievement records
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'EPISODES_WATCHED',
          thresholdValue: 100,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
        {
          id: 2,
          profileId: 123,
          achievementType: 'MOVIES_WATCHED',
          thresholdValue: 50,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
        {
          id: 3,
          profileId: 123,
          achievementType: 'HOURS_WATCHED',
          thresholdValue: 100,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

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
        createdAt: '2025-01-13T00:00:00.000Z',
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

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'EPISODES_WATCHED',
          thresholdValue: 100,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

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

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'MOVIES_WATCHED',
          thresholdValue: 50,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

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

      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'EPISODES_WATCHED',
          thresholdValue: 500,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('500 Episodes Watched');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format FIRST_EPISODE achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 1,
          total_movies_watched: 0,
          total_runtime_minutes: 45,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'FIRST_EPISODE',
          thresholdValue: null,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
          metadata: { showTitle: 'Breaking Bad', episodeTitle: 'Pilot' },
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('First Episode Watched');
      expect(result.recentAchievements[0].metadata).toEqual({ showTitle: 'Breaking Bad', episodeTitle: 'Pilot' });
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format FIRST_MOVIE achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 0,
          total_movies_watched: 1,
          total_runtime_minutes: 120,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: null,
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'FIRST_MOVIE',
          thresholdValue: null,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
          metadata: { movieTitle: 'The Shawshank Redemption' },
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('First Movie Watched');
      expect(result.recentAchievements[0].metadata).toEqual({ movieTitle: 'The Shawshank Redemption' });
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format SHOW_COMPLETED achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 62,
          total_movies_watched: 0,
          total_runtime_minutes: 2790,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'SHOW_COMPLETED',
          thresholdValue: null,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
          metadata: { showTitle: 'Breaking Bad', showId: 1234 },
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('Completed: Breaking Bad');
      expect(result.recentAchievements[0].metadata).toEqual({ showTitle: 'Breaking Bad', showId: 1234 });
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format SHOW_COMPLETED achievement type with fallback when showTitle is missing', async () => {
      const mockRows = [
        {
          total_episodes_watched: 62,
          total_movies_watched: 0,
          total_runtime_minutes: 2790,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: null,
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'SHOW_COMPLETED',
          thresholdValue: null,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
          metadata: { showId: 1234 },
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('Completed: Show');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format WATCH_STREAK achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 50,
          total_movies_watched: 10,
          total_runtime_minutes: 3000,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'WATCH_STREAK',
          thresholdValue: 7,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('7 Day Watch Streak');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format BINGE_SESSION achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 25,
          total_movies_watched: 5,
          total_runtime_minutes: 1500,
          profile_created_at: '2025-01-13',
          first_episode_watched_at: '2025-01-16',
          first_movie_watched_at: '2025-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'BINGE_SESSION',
          thresholdValue: 5,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('5 Episode Binge Session');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format PROFILE_ANNIVERSARY achievement type correctly', async () => {
      const mockRows = [
        {
          total_episodes_watched: 500,
          total_movies_watched: 100,
          total_runtime_minutes: 25000,
          profile_created_at: '2024-01-13',
          first_episode_watched_at: '2024-01-16',
          first_movie_watched_at: '2024-01-17',
        },
      ];
      mockConnection.query.mockResolvedValueOnce([mockRows]);

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'PROFILE_ANNIVERSARY',
          thresholdValue: 1,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('1 Year Anniversary');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should format unknown achievement type with default case', async () => {
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

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'UNKNOWN_TYPE',
          thresholdValue: 42,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(1);
      expect(result.recentAchievements[0].description).toBe('Achievement: 42');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple different achievement types together', async () => {
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

      const now = new Date();
      (getRecentAchievements as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          profileId: 123,
          achievementType: 'EPISODES_WATCHED',
          thresholdValue: 100,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
        {
          id: 2,
          profileId: 123,
          achievementType: 'WATCH_STREAK',
          thresholdValue: 7,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
        {
          id: 3,
          profileId: 123,
          achievementType: 'SHOW_COMPLETED',
          thresholdValue: null,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
          metadata: { showTitle: 'The Wire' },
        },
        {
          id: 4,
          profileId: 123,
          achievementType: 'BINGE_SESSION',
          thresholdValue: 10,
          achievedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ]);

      const result = await getMilestoneStats(123);

      expect(result.recentAchievements.length).toBe(4);
      expect(result.recentAchievements[0].description).toBe('100 Episodes Watched');
      expect(result.recentAchievements[1].description).toBe('7 Day Watch Streak');
      expect(result.recentAchievements[2].description).toBe('Completed: The Wire');
      expect(result.recentAchievements[3].description).toBe('10 Episode Binge Session');
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
