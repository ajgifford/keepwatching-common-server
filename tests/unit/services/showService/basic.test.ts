import { mockShows } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { watchStatusService } from '@services/watchStatusService';
import { type Mock, MockedObject, beforeEach, describe, expect, it } from 'vitest';

describe('ShowService - Basic Functionality', () => {
  let service: ShowService;
  let mockCache: MockedObject<CacheService>;

  const accountId = 111;
  const profileId = 123;
  const showId = 1;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;

    (watchStatusService.checkAndUpdateShowStatus as Mock).mockResolvedValue({
      success: true,
      message: 'Check and update show test message',
      affectedRows: 1,
      changes: [{}, {}],
    });
  });

  describe('getShowsForProfile', () => {
    it('should return shows from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile(profileId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(`profile_${profileId}_shows`, expect.any(Function), 600);
      expect(result).toEqual(mockShows);
    });

    it('should fetch shows from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getAllShowsForProfile as Mock).mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile(profileId);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockShows);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getAllShowsForProfile as Mock).mockRejectedValue(error);

      await expect(service.getShowsForProfile(profileId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowsForProfile(${profileId})`);
    });
  });

  describe('getShowDetailsForProfile', () => {
    const mockShowWithSeasons = {
      show_id: showId,
      title: 'Test Show',
      seasons: [{ season_id: 1, name: 'Season 1', episodes: [] }],
    };

    it('should return show details from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfile(accountId, profileId, showId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `profile_${profileId}_show_details_${showId}`,
        expect.any(Function),
        600,
      );
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should fetch show details from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as Mock).mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfile(accountId, profileId, showId);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith(profileId, showId);
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should throw NotFoundError when show is not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as Mock).mockResolvedValue(null);
      (errorService.assertExists as Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowDetailsForProfile(accountId, profileId, 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith(profileId, 999);
      expect(errorService.assertExists).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as Mock).mockRejectedValue(error);

      await expect(service.getShowDetailsForProfile(accountId, profileId, showId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(
        error,
        `getShowDetailsForProfile(${accountId}, ${profileId}, ${showId}, true)`,
      );
    });
  });

  describe('getShowDetailsForProfileByChild', () => {
    const episodeId = 1001;
    const seasonId = 101;
    const mockShowWithSeasons = {
      show_id: showId,
      title: 'Test Show',
      seasons: [{ season_id: 1, name: 'Season 1', episodes: [] }],
    };

    it('should return show details from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfileByChild(accountId, profileId, episodeId, 'episodes');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `profile_${profileId}_show_details_episodes_${episodeId}`,
        expect.any(Function),
        600,
      );
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should fetch show details by episode from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfileByChild as Mock).mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfileByChild(accountId, profileId, episodeId, 'episodes');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowWithSeasonsForProfileByChild).toHaveBeenCalledWith(profileId, episodeId, 'episodes');
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should fetch show details by season from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfileByChild as Mock).mockResolvedValue(mockShowWithSeasons);

      const result = await service.getShowDetailsForProfileByChild(accountId, profileId, seasonId, 'seasons');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowWithSeasonsForProfileByChild).toHaveBeenCalledWith(profileId, seasonId, 'seasons');
      expect(result).toEqual(mockShowWithSeasons);
    });

    it('should throw NotFoundError when show is not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfileByChild as Mock).mockResolvedValue(null);
      (errorService.assertExists as Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowDetailsForProfileByChild(accountId, profileId, 999, 'episodes')).rejects.toThrow(
        NotFoundError,
      );
      expect(showsDb.getShowWithSeasonsForProfileByChild).toHaveBeenCalledWith(profileId, 999, 'episodes');
      expect(errorService.assertExists).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfileByChild as Mock).mockRejectedValue(error);

      await expect(
        service.getShowDetailsForProfileByChild(accountId, profileId, episodeId, 'episodes'),
      ).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(
        error,
        `getShowDetailsForProfileByChild(${accountId}, ${profileId}, ${episodeId}, episodes)`,
      );
    });
  });
});
