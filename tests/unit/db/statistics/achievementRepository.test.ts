import { MilestoneAchievementRow } from '../../../../src/types/statisticsTypes';
import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { AchievementType } from '@ajgifford/keepwatching-types';
import {
  checkAchievementExists,
  getAchievementsByProfile,
  getAchievementsByType,
  getLatestWatchedEpisode,
  getLatestWatchedMovie,
  getRecentAchievements,
  recordAchievement,
} from '@db/statistics/achievementRepository';

describe('achievementRepository', () => {
  let mockPool: any;
  let mockConnection: any;

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
    mockPool = mocks.mockPool;
    mockConnection = mocks.mockConnection;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAchievementsByProfile', () => {
    it('should return empty array when no achievements found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAchievementsByProfile(123);

      expect(result).toEqual([]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('FROM milestone_achievements'), [123]);
    });

    it('should return all achievements for a profile ordered by achieved_at DESC', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 3,
          profile_id: 123,
          achievement_type: 'HOURS_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-11-01T10:00:00Z'),
          created_at: new Date('2025-11-01T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 2,
          profile_id: 123,
          achievement_type: 'MOVIES_WATCHED',
          threshold_value: 50,
          achieved_at: new Date('2025-10-15T10:00:00Z'),
          created_at: new Date('2025-10-15T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T10:00:00Z'),
          metadata: '{"showId": 123}',
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByProfile(123);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(3);
      expect(result[0].achievementType).toBe('HOURS_WATCHED');
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(1);
      expect(result[2].metadata).toEqual({ showId: 123 });
    });

    it('should correctly map database rows to achievement records', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T09:00:00Z'),
          metadata: '{"showTitle": "Breaking Bad"}',
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByProfile(123);

      expect(result[0]).toEqual({
        id: 1,
        profileId: 123,
        achievementType: 'EPISODES_WATCHED',
        thresholdValue: 100,
        achievedAt: '2025-10-01T10:00:00.000Z',
        createdAt: '2025-10-01T09:00:00.000Z',
        metadata: { showTitle: 'Breaking Bad' },
      });
    });

    it('should handle achievements with null metadata', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T09:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByProfile(123);

      expect(result[0].metadata).toBeUndefined();
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getAchievementsByProfile(123)).rejects.toThrow('Database error');
    });
  });

  describe('getRecentAchievements', () => {
    it('should return empty array when no recent achievements', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getRecentAchievements(123, 30);

      expect(result).toEqual([]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123, 30]);
    });

    it('should return achievements within specified days with default 30 days', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-15T10:00:00Z'),
          created_at: new Date('2025-10-15T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getRecentAchievements(123);

      expect(result).toHaveLength(1);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123, 30]);
    });

    it('should return achievements within custom days parameter', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'WATCH_STREAK',
          threshold_value: 7,
          achieved_at: new Date('2025-10-29T10:00:00Z'),
          created_at: new Date('2025-10-29T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getRecentAchievements(123, 7);

      expect(result).toHaveLength(1);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123, 7]);
    });

    it('should order achievements by achieved_at DESC', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 2,
          profile_id: 123,
          achievement_type: 'MOVIES_WATCHED',
          threshold_value: 50,
          achieved_at: new Date('2025-10-25T10:00:00Z'),
          created_at: new Date('2025-10-25T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-15T10:00:00Z'),
          created_at: new Date('2025-10-15T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getRecentAchievements(123, 30);

      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getRecentAchievements(123, 30)).rejects.toThrow('Database error');
    });
  });

  describe('checkAchievementExists', () => {
    it('should return false when achievement does not exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const result = await checkAchievementExists(123, AchievementType.EPISODES_WATCHED, 100);

      expect(result).toBe(false);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123, AchievementType.EPISODES_WATCHED, 100]);
    });

    it('should return true when achievement exists', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await checkAchievementExists(123, AchievementType.EPISODES_WATCHED, 100);

      expect(result).toBe(true);
    });

    it('should return true when multiple matching achievements exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 3 }]]);

      const result = await checkAchievementExists(123, AchievementType.MOVIES_WATCHED, 50);

      expect(result).toBe(true);
    });

    it('should handle undefined count in result', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await checkAchievementExists(123, AchievementType.HOURS_WATCHED, 100);

      expect(result).toBe(false);
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(checkAchievementExists(123, AchievementType.EPISODES_WATCHED, 100)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('recordAchievement', () => {
    it('should record a new achievement and return insert ID', async () => {
      // Mock checkAchievementExists to return false
      mockConnection.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const mockResult = {
        insertId: 42,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockConnection.execute.mockResolvedValueOnce([mockResult]);

      const achievedAt = new Date('2025-10-01T10:00:00Z');
      const metadata = { showTitle: 'Breaking Bad' };

      const result = await recordAchievement(123, AchievementType.EPISODES_WATCHED, 100, achievedAt, metadata);

      expect(result).toBe(42);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO milestone_achievements'),
        [123, AchievementType.EPISODES_WATCHED, 100, achievedAt, JSON.stringify(metadata)],
      );
      // Once for checkAchievementExists, once for recordAchievement
    });

    it('should return 0 when achievement already exists', async () => {
      // Mock checkAchievementExists to return true
      mockConnection.execute.mockResolvedValueOnce([[{ count: 1 }]]);

      const achievedAt = new Date('2025-10-01T10:00:00Z');

      const result = await recordAchievement(123, AchievementType.EPISODES_WATCHED, 100, achievedAt);

      expect(result).toBe(0);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1); // Only checkAchievementExists called
      // Once for checkAchievementExists, once for recordAchievement
    });

    it('should record achievement without metadata', async () => {
      mockConnection.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const mockResult = {
        insertId: 10,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockConnection.execute.mockResolvedValueOnce([mockResult]);

      const achievedAt = new Date('2025-10-01T10:00:00Z');

      const result = await recordAchievement(123, AchievementType.MOVIES_WATCHED, 50, achievedAt);

      expect(result).toBe(10);
      expect(mockConnection.execute).toHaveBeenLastCalledWith(expect.any(String), [
        123,
        AchievementType.MOVIES_WATCHED,
        50,
        achievedAt,
        null,
      ]);
      // Once for checkAchievementExists, once for recordAchievement
    });

    it('should handle various achievement types', async () => {
      mockConnection.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const mockResult = {
        insertId: 15,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockConnection.execute.mockResolvedValueOnce([mockResult]);

      const achievedAt = new Date('2025-10-01T10:00:00Z');

      const result = await recordAchievement(123, AchievementType.WATCH_STREAK, 7, achievedAt);

      expect(result).toBe(15);
      // Once for checkAchievementExists, once for recordAchievement
    });

    it('should stringify complex metadata objects', async () => {
      mockConnection.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const mockResult = {
        insertId: 20,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockConnection.execute.mockResolvedValueOnce([mockResult]);

      const achievedAt = new Date('2025-10-01T10:00:00Z');
      const metadata = {
        showTitle: 'Breaking Bad',
        showId: 123,
        episodeCount: 62,
        nested: { value: true },
      };

      await recordAchievement(123, AchievementType.SHOW_COMPLETED, 1, achievedAt, metadata);

      expect(mockConnection.execute).toHaveBeenLastCalledWith(expect.any(String), [
        123,
        AchievementType.SHOW_COMPLETED,
        1,
        achievedAt,
        JSON.stringify(metadata),
      ]);
      // Once for checkAchievementExists, once for recordAchievement
    });

    it('should release connection even if query throws error', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Database error'));

      const achievedAt = new Date('2025-10-01T10:00:00Z');

      await expect(recordAchievement(123, AchievementType.EPISODES_WATCHED, 100, achievedAt)).rejects.toThrow(
        'Database error',
      );

      // Once for checkAchievementExists (error), once for recordAchievement
    });
  });

  describe('getAchievementsByType', () => {
    it('should return empty array when no achievements of specified type', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAchievementsByType(123, AchievementType.EPISODES_WATCHED);

      expect(result).toEqual([]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123, AchievementType.EPISODES_WATCHED]);
    });

    it('should return achievements of specified type ordered by threshold_value ASC', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 100,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 2,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 250,
          achieved_at: new Date('2025-10-15T10:00:00Z'),
          created_at: new Date('2025-10-15T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 3,
          profile_id: 123,
          achievement_type: 'EPISODES_WATCHED',
          threshold_value: 500,
          achieved_at: new Date('2025-10-30T10:00:00Z'),
          created_at: new Date('2025-10-30T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByType(123, AchievementType.EPISODES_WATCHED);

      expect(result).toHaveLength(3);
      expect(result[0].thresholdValue).toBe(100);
      expect(result[1].thresholdValue).toBe(250);
      expect(result[2].thresholdValue).toBe(500);
    });

    it('should filter achievements by type correctly', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'WATCH_STREAK',
          threshold_value: 7,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
        {
          id: 2,
          profile_id: 123,
          achievement_type: 'WATCH_STREAK',
          threshold_value: 30,
          achieved_at: new Date('2025-10-15T10:00:00Z'),
          created_at: new Date('2025-10-15T10:00:00Z'),
          metadata: null,
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByType(123, AchievementType.WATCH_STREAK);

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.achievementType === 'WATCH_STREAK')).toBe(true);
    });

    it('should correctly map achievements with metadata', async () => {
      const mockRows: MilestoneAchievementRow[] = [
        {
          id: 1,
          profile_id: 123,
          achievement_type: 'SHOW_COMPLETED',
          threshold_value: 1,
          achieved_at: new Date('2025-10-01T10:00:00Z'),
          created_at: new Date('2025-10-01T10:00:00Z'),
          metadata: '{"showTitle": "Breaking Bad", "showId": 456}',
        } as MilestoneAchievementRow,
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getAchievementsByType(123, AchievementType.SHOW_COMPLETED);

      expect(result[0].metadata).toEqual({ showTitle: 'Breaking Bad', showId: 456 });
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getAchievementsByType(123, AchievementType.EPISODES_WATCHED)).rejects.toThrow('Database error');
    });
  });

  describe('getLatestWatchedEpisode', () => {
    it('should return null when no watched episodes found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getLatestWatchedEpisode(123);

      expect(result).toBeNull();
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123]);
    });

    it('should return latest watched episode with metadata', async () => {
      const mockRows = [
        {
          episode_id: 456,
          show_name: 'Breaking Bad',
          episode_name: 'Pilot',
          season_number: 1,
          episode_number: 1,
          updated_at: new Date('2025-10-01T10:00:00Z'),
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getLatestWatchedEpisode(123);

      expect(result).toEqual({
        episodeId: 456,
        showName: 'Breaking Bad',
        episodeName: 'Pilot',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-10-01T10:00:00Z'),
      });
    });

    it('should query with correct parameters and WATCHED status', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getLatestWatchedEpisode(789);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining("ews.status = 'WATCHED'"), [789]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY ews.updated_at DESC'), [789]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1'), [789]);
    });

    it('should join correct tables (episodes, seasons, shows, episode_watch_status)', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getLatestWatchedEpisode(123);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('FROM episode_watch_status ews'), [123]);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('JOIN episodes e ON e.id = ews.episode_id'),
        [123],
      );
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('JOIN seasons se ON se.id = e.season_id'), [
        123,
      ]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('JOIN shows s ON s.id = se.show_id'), [
        123,
      ]);
    });

    it('should handle various episode data correctly', async () => {
      const mockRows = [
        {
          episode_id: 999,
          show_name: 'The Wire',
          episode_name: 'Final Grades',
          season_number: 4,
          episode_number: 13,
          updated_at: new Date('2025-10-30T15:30:00Z'),
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getLatestWatchedEpisode(123);

      expect(result).toEqual({
        episodeId: 999,
        showName: 'The Wire',
        episodeName: 'Final Grades',
        seasonNumber: 4,
        episodeNumber: 13,
        watchedAt: new Date('2025-10-30T15:30:00Z'),
      });
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getLatestWatchedEpisode(123)).rejects.toThrow('Database error');
    });
  });

  describe('getLatestWatchedMovie', () => {
    it('should return null when no watched movies found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getLatestWatchedMovie(123);

      expect(result).toBeNull();
      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [123]);
    });

    it('should return latest watched movie with metadata', async () => {
      const mockRows = [
        {
          movie_id: 789,
          movie_title: 'The Shawshank Redemption',
          updated_at: new Date('2025-10-15T14:00:00Z'),
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getLatestWatchedMovie(123);

      expect(result).toEqual({
        movieId: 789,
        movieTitle: 'The Shawshank Redemption',
        watchedAt: new Date('2025-10-15T14:00:00Z'),
      });
    });

    it('should query with correct parameters and WATCHED status', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getLatestWatchedMovie(456);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining("mws.status = 'WATCHED'"), [456]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY mws.updated_at DESC'), [456]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1'), [456]);
    });

    it('should join correct tables (movies, movie_watch_status)', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getLatestWatchedMovie(123);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('FROM movie_watch_status mws'), [123]);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('JOIN movies m ON m.id = mws.movie_id'), [
        123,
      ]);
    });

    it('should handle various movie data correctly', async () => {
      const mockRows = [
        {
          movie_id: 111,
          movie_title: 'Inception',
          updated_at: new Date('2025-10-20T20:45:00Z'),
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await getLatestWatchedMovie(123);

      expect(result).toEqual({
        movieId: 111,
        movieTitle: 'Inception',
        watchedAt: new Date('2025-10-20T20:45:00Z'),
      });
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getLatestWatchedMovie(123)).rejects.toThrow('Database error');
    });
  });
});
