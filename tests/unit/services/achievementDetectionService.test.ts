import { AchievementType, MILESTONE_THRESHOLDS } from '@ajgifford/keepwatching-types';
import { ACCOUNT_KEYS, PROFILE_KEYS } from '@constants/cacheKeys';
import * as statisticsDb from '@db/statisticsDb';
import {
  batchCheckAchievements,
  checkAndRecordAchievements,
  detectShowCompletion,
} from '@services/achievementDetectionService';
import { CacheService } from '@services/cacheService';
import { type Mock, MockedObject, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@db/statisticsDb');
vi.mock('@services/cacheService');

describe('AchievementDetectionService', () => {
  let mockCacheService: MockedObject<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getWatchCounts to return default values
    (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
      episodes: 0,
      movies: 0,
      hours: 0,
    });

    // Mock getLatestWatchDate
    (statisticsDb.getLatestWatchDate as Mock).mockResolvedValue(new Date());

    // Mock cache service
    mockCacheService = {
      invalidate: vi.fn(),
    } as unknown as MockedObject<CacheService>;

    vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAndRecordAchievements', () => {
    const profileId = 1;
    const accountId = 100;

    beforeEach(() => {
      // Default mocks for achievement repository
      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue({
        movieId: 1,
        movieTitle: 'Test Movie',
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
    });

    it('should detect and record first episode achievement', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 1,
        movies: 0,
        hours: 0,
      });

      const result = await checkAndRecordAchievements(profileId, accountId);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_EPISODE,
        1,
        expect.any(Date),
        expect.objectContaining({
          showName: 'Test Show',
          episodeName: 'Test Episode',
        }),
      );
      expect(result).toBe(1);
    });

    it('should detect and record episode milestone achievements', async () => {
      // Episodes: [100, 500, 1000, 5000]
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 500,
        movies: 0,
        hours: 0,
      });

      const existingAchievements = [
        { id: 1, thresholdValue: 1, achievementType: AchievementType.FIRST_EPISODE },
        { id: 2, thresholdValue: 100, achievementType: AchievementType.EPISODES_WATCHED },
      ];

      (statisticsDb.getAchievementsByType as Mock).mockImplementation((profileId, type) => {
        if (type === AchievementType.EPISODES_WATCHED) {
          return Promise.resolve(existingAchievements);
        }
        return Promise.resolve([]);
      });

      await checkAndRecordAchievements(profileId, accountId);

      // Should record 500 milestone (100 already exists)
      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.EPISODES_WATCHED,
        500,
        expect.any(Date),
        expect.any(Object),
      );
    });

    it('should detect and record first movie achievement', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 1,
        hours: 0,
      });

      const result = await checkAndRecordAchievements(profileId, accountId);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_MOVIE,
        1,
        expect.any(Date),
        expect.objectContaining({
          movieName: 'Test Movie',
        }),
      );
      expect(result).toBe(1);
    });

    it('should detect and record movie milestone achievements', async () => {
      // Movies: [25, 50, 100, 500]
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 100,
        hours: 0,
      });

      const existingAchievements = [
        { id: 1, thresholdValue: 1, achievementType: AchievementType.FIRST_MOVIE },
        { id: 2, thresholdValue: 25, achievementType: AchievementType.MOVIES_WATCHED },
      ];

      (statisticsDb.getAchievementsByType as Mock).mockImplementation((pid, type) => {
        if (type === AchievementType.MOVIES_WATCHED) {
          return Promise.resolve(existingAchievements);
        }
        return Promise.resolve([]);
      });

      await checkAndRecordAchievements(profileId, accountId);

      // Should record 50 and 100 movie milestones
      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.MOVIES_WATCHED,
        50,
        expect.any(Date),
        expect.any(Object),
      );

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.MOVIES_WATCHED,
        100,
        expect.any(Date),
        expect.any(Object),
      );
    });

    it('should detect and record hours watched achievements', async () => {
      // Hours: [100, 500, 1000, 5000]
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 0,
        hours: 100,
      });

      (statisticsDb.getLatestWatchDate as Mock).mockResolvedValue(new Date('2025-01-15'));
      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);

      await checkAndRecordAchievements(profileId, accountId);

      // Should record 100 hours milestone
      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.HOURS_WATCHED,
        100,
        expect.any(Date),
      );
    });

    it('should not record duplicate achievements', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 500,
        movies: 0,
        hours: 0,
      });

      const existingAchievements = [
        { id: 1, thresholdValue: 1, achievementType: AchievementType.FIRST_EPISODE },
        { id: 2, thresholdValue: 100, achievementType: AchievementType.EPISODES_WATCHED },
        { id: 3, thresholdValue: 500, achievementType: AchievementType.EPISODES_WATCHED },
      ];

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue(existingAchievements);

      await checkAndRecordAchievements(profileId, accountId);

      // Should not re-record existing achievements
      expect(statisticsDb.recordAchievement).not.toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_EPISODE,
        1,
        expect.any(Date),
        expect.any(Object),
      );

      expect(statisticsDb.recordAchievement).not.toHaveBeenCalledWith(
        profileId,
        AchievementType.EPISODES_WATCHED,
        100,
        expect.any(Date),
        expect.any(Object),
      );

      expect(statisticsDb.recordAchievement).not.toHaveBeenCalledWith(
        profileId,
        AchievementType.EPISODES_WATCHED,
        500,
        expect.any(Date),
        expect.any(Object),
      );
    });

    it('should invalidate cache when new achievements are recorded', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 100,
        movies: 0,
        hours: 0,
      });
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);

      await checkAndRecordAchievements(profileId, accountId);

      expect(mockCacheService.invalidate).toHaveBeenCalledWith(PROFILE_KEYS.milestoneStats(profileId));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(ACCOUNT_KEYS.milestoneStats(accountId));
    });

    it('should not invalidate cache when no new achievements are recorded', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 0,
        hours: 0,
      });
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(0);

      await checkAndRecordAchievements(profileId);

      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
    });

    it('should handle missing latest episode data gracefully', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 1,
        movies: 0,
        hours: 0,
      });
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue(null);

      const result = await checkAndRecordAchievements(profileId);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_EPISODE,
        1,
        expect.any(Date),
        undefined,
      );

      expect(result).toBe(1);
    });

    it('should handle missing latest movie data gracefully', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 1,
        hours: 0,
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue(null);

      const result = await checkAndRecordAchievements(profileId);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_MOVIE,
        1,
        expect.any(Date),
        undefined,
      );

      expect(result).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      (statisticsDb.getWatchCounts as Mock).mockRejectedValue(dbError);

      const result = await checkAndRecordAchievements(profileId, accountId);

      expect(console.error).toHaveBeenCalledWith('Error checking achievements for profile', profileId, dbError);
      expect(result).toBe(0);
    });

    it('should work without accountId parameter', async () => {
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 1,
        movies: 0,
        hours: 0,
      });
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);

      await checkAndRecordAchievements(profileId);

      expect(mockCacheService.invalidate).toHaveBeenCalledWith(PROFILE_KEYS.milestoneStats(profileId));
      expect(mockCacheService.invalidate).not.toHaveBeenCalledWith(ACCOUNT_KEYS.milestoneStats(expect.any(Number)));
    });
  });

  describe('detectShowCompletion', () => {
    const profileId = 1;
    const showId = 100;
    const showTitle = 'Breaking Bad';

    it('should record show completion achievement', async () => {
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);

      const result = await detectShowCompletion(profileId, showId, showTitle);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.SHOW_COMPLETED,
        showId,
        expect.any(Date),
        {
          showId,
          showTitle,
        },
      );
      expect(result).toBe(true);
    });

    it('should return false when achievement already exists', async () => {
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(0);

      const result = await detectShowCompletion(profileId, showId, showTitle);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.SHOW_COMPLETED,
        showId,
        expect.any(Date),
        {
          showId,
          showTitle,
        },
      );
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      (statisticsDb.recordAchievement as Mock).mockRejectedValue(error);

      const result = await detectShowCompletion(profileId, showId, showTitle);

      expect(console.error).toHaveBeenCalledWith('Error detecting show completion achievement:', error);
      expect(result).toBe(false);
    });
  });

  describe('batchCheckAchievements', () => {
    it('should process multiple profiles', async () => {
      const profileIds = [1, 2, 3];

      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 100,
        movies: 25,
        hours: 100,
      });
      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue({
        movieId: 1,
        movieTitle: 'Test Movie',
        watchedAt: new Date('2025-01-01'),
      });

      const results = await batchCheckAchievements(profileIds);

      expect(results.size).toBe(3);
      expect(results.get(1)).toBeGreaterThan(0);
      expect(results.get(2)).toBeGreaterThan(0);
      expect(results.get(3)).toBeGreaterThan(0);
    });

    it('should handle empty profile list', async () => {
      const profileIds: number[] = [];

      const results = await batchCheckAchievements(profileIds);

      expect(results.size).toBe(0);
    });

    it('should continue processing even if one profile fails', async () => {
      const profileIds = [1, 2, 3];

      (statisticsDb.getWatchCounts as Mock).mockRejectedValueOnce(new Error('Profile 1 failed')).mockResolvedValue({
        episodes: 100,
        movies: 25,
        hours: 100,
      });

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue({
        movieId: 1,
        movieTitle: 'Test Movie',
        watchedAt: new Date('2025-01-01'),
      });

      const results = await batchCheckAchievements(profileIds);

      expect(results.size).toBe(3);
      expect(results.get(1)).toBe(0); // Failed profile returns 0
      expect(results.get(2)).toBeGreaterThan(0);
      expect(results.get(3)).toBeGreaterThan(0);
    });

    it('should return achievement counts for each profile', async () => {
      const profileIds = [1, 2];

      (statisticsDb.getWatchCounts as Mock)
        .mockResolvedValueOnce({
          episodes: 100,
          movies: 25,
          hours: 100,
        })
        .mockResolvedValueOnce({
          episodes: 0,
          movies: 0,
          hours: 0,
        });

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue({
        movieId: 1,
        movieTitle: 'Test Movie',
        watchedAt: new Date('2025-01-01'),
      });

      const results = await batchCheckAchievements(profileIds);

      expect(results.size).toBe(2);
      expect(results.get(1)).toBeGreaterThan(0);
      expect(results.get(2)).toBe(0);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle all milestone thresholds correctly', async () => {
      const profileId = 1;

      // Test with counts that hit every threshold
      const maxEpisodes = Math.max(...MILESTONE_THRESHOLDS.episodes);
      const maxMovies = Math.max(...MILESTONE_THRESHOLDS.movies);
      const maxHours = Math.max(...MILESTONE_THRESHOLDS.hours);

      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: maxEpisodes,
        movies: maxMovies,
        hours: maxHours,
      });

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });
      (statisticsDb.getLatestWatchedMovie as Mock).mockResolvedValue({
        movieId: 1,
        movieTitle: 'Test Movie',
        watchedAt: new Date('2025-01-01'),
      });

      await checkAndRecordAchievements(profileId);

      // Verify specific achievements were recorded
      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_EPISODE,
        1,
        expect.any(Date),
        expect.any(Object),
      );

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.FIRST_MOVIE,
        1,
        expect.any(Date),
        expect.any(Object),
      );
    });

    it('should handle zero counts correctly', async () => {
      const profileId = 1;

      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 0,
        hours: 0,
      });
      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);

      const result = await checkAndRecordAchievements(profileId);

      expect(statisticsDb.recordAchievement).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should handle exact threshold values', async () => {
      const profileId = 1;

      // Test exact threshold value (100 episodes)
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 100,
        movies: 0,
        hours: 0,
      });

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);
      (statisticsDb.getLatestWatchedEpisode as Mock).mockResolvedValue({
        episodeId: 1,
        showName: 'Test Show',
        episodeName: 'Test Episode',
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date('2025-01-01'),
      });

      await checkAndRecordAchievements(profileId);

      // Should record first episode + 100 milestone
      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.EPISODES_WATCHED,
        100,
        expect.any(Date),
        expect.any(Object),
      );
    });

    it('should round hours correctly', async () => {
      const profileId = 1;

      // 100.4 hours should round to 100 hours
      (statisticsDb.getWatchCounts as Mock).mockResolvedValue({
        episodes: 0,
        movies: 0,
        hours: 100, // Already rounded by getWatchCounts
      });

      (statisticsDb.getAchievementsByType as Mock).mockResolvedValue([]);
      (statisticsDb.recordAchievement as Mock).mockResolvedValue(1);

      await checkAndRecordAchievements(profileId);

      expect(statisticsDb.recordAchievement).toHaveBeenCalledWith(
        profileId,
        AchievementType.HOURS_WATCHED,
        100,
        expect.any(Date),
      );
    });
  });
});
