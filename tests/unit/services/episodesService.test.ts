import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as episodesDb from '@db/episodesDb';
import { appLogger } from '@logger/logger';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';
import { watchStatusService } from '@services/watchStatusService';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/episodesDb');
vi.mock('@db/seasonsDb');
vi.mock('@db/showsDb');
vi.mock('@services/errorService');
vi.mock('@services/showService');
vi.mock('@services/watchStatusService');

vi.mock('@logger/logger', () => ({
  appLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('episodesService', () => {
  const accountId = 1;
  const profileId = 123;
  const seasonId = 456;
  const episodeId = 101;
  const status = WatchStatus.WATCHED;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateEpisodeWatchStatus', () => {
    it('should update episode watch status and return next unwatched episodes', async () => {
      const mockNextUnwatchedEpisodes = [{ show_id: 1, episodes: [{ episode_id: 789 }] }];
      const mockShow = { id: 1, title: 'Show 1' };

      (watchStatusService.updateEpisodeWatchStatus as Mock).mockResolvedValue({
        success: true,
        message: 'Episode test message',
        affectedRows: 1,
        changes: [{}, {}],
      });

      (showService.getNextUnwatchedEpisodesForProfile as Mock).mockResolvedValue(mockNextUnwatchedEpisodes);
      (showService.getShowDetailsForProfileByChild as Mock).mockResolvedValue(mockShow);

      const result = await episodesService.updateEpisodeWatchStatus(accountId, profileId, episodeId, status);

      expect(showService.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(showService.getShowDetailsForProfileByChild).toHaveBeenCalledWith(
        accountId,
        profileId,
        episodeId,
        'episodes',
      );
      expect(result.nextUnwatchedEpisodes).toEqual(mockNextUnwatchedEpisodes);
      expect(result.showWithSeasons).toEqual(mockShow);

      expect(appLogger.info).toHaveBeenCalledWith(`Episode ${episodeId} update: Episode test message`);
      expect(appLogger.info).toHaveBeenCalledWith(`Affected entities: 2`);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (watchStatusService.updateEpisodeWatchStatus as Mock).mockRejectedValue(mockError);
      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.updateEpisodeWatchStatus(accountId, profileId, episodeId, status)).rejects.toThrow(
        'Handled: Database error',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateEpisodeWatchStatus(${accountId}, ${profileId}, ${episodeId}, ${status})`,
      );
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for the specified season', async () => {
      const mockEpisodes = [
        { episode_id: 1, title: 'Episode 1', watch_status: 'WATCHED' },
        { episode_id: 2, title: 'Episode 2', watch_status: 'NOT_WATCHED' },
      ];

      (episodesDb.getEpisodesForSeason as Mock).mockResolvedValue(mockEpisodes);

      const result = await episodesService.getEpisodesForSeason(profileId, seasonId);

      expect(episodesDb.getEpisodesForSeason).toHaveBeenCalledWith(profileId, seasonId);
      expect(result).toEqual(mockEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getEpisodesForSeason as Mock).mockRejectedValue(mockError);
      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.getEpisodesForSeason(profileId, seasonId)).rejects.toThrow(
        'Handled: Database error',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `getEpisodesForSeason(${profileId}, ${seasonId})`,
      );
    });
  });

  describe('getUpcomingEpisodesForProfile', () => {
    it('should return upcoming episodes for the profile', async () => {
      const mockUpcomingEpisodes = [
        { id: 1, title: 'Upcoming Episode 1', air_date: '2025-05-01' },
        { id: 2, title: 'Upcoming Episode 2', air_date: '2025-05-08' },
      ];

      (episodesDb.getUpcomingEpisodesForProfile as Mock).mockResolvedValue(mockUpcomingEpisodes);

      const result = await episodesService.getUpcomingEpisodesForProfile(profileId);

      expect(episodesDb.getUpcomingEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockUpcomingEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getUpcomingEpisodesForProfile as Mock).mockRejectedValue(mockError);
      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.getUpcomingEpisodesForProfile(profileId)).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `getUpcomingEpisodesForProfile(${profileId})`);
    });
  });

  describe('getRecentEpisodesForProfile', () => {
    it('should return recent episodes for the profile', async () => {
      const mockRecentEpisodes = [
        { id: 1, title: 'Recent Episode 1', air_date: '2025-04-10' },
        { id: 2, title: 'Recent Episode 2', air_date: '2025-04-12' },
      ];

      (episodesDb.getRecentEpisodesForProfile as Mock).mockResolvedValue(mockRecentEpisodes);

      const result = await episodesService.getRecentEpisodesForProfile(profileId);

      expect(episodesDb.getRecentEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockRecentEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getRecentEpisodesForProfile as Mock).mockRejectedValue(mockError);
      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.getRecentEpisodesForProfile(profileId)).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `getRecentEpisodesForProfile(${profileId})`);
    });
  });

  describe('updateEpisode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update an episode successfully', async () => {
      const episodeData = {
        tmdb_id: 12345,
        show_id: 100,
        season_id: 200,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        title: 'Test Episode',
        overview: 'Episode overview',
        air_date: '2024-01-01',
        runtime: 45,
        still_image: '/path/to/image.jpg',
      };

      const updatedEpisode = 500;

      vi.spyOn(episodesDb, 'updateEpisode').mockResolvedValue(updatedEpisode);

      const result = await episodesService.updateEpisode(episodeData);

      expect(episodesDb.updateEpisode).toHaveBeenCalledWith(episodeData);
      expect(result).toEqual(updatedEpisode);
    });

    it('should handle errors when updating an episode', async () => {
      const episodeData = {
        tmdb_id: 12345,
        show_id: 100,
        season_id: 200,
        episode_number: 1,
        season_number: 1,
        title: 'Episode 1',
        episode_type: 'Regular',
        air_date: '',
        overview: 'Episode 1',
        runtime: 5,
        still_image: 'image.png',
      };

      const error = new Error('Database error');

      vi.spyOn(episodesDb, 'updateEpisode').mockRejectedValue(error);
      vi.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(episodesService.updateEpisode(episodeData)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });

  describe('addEpisodeToFavorites', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should add an episode to favorites with the default status', async () => {
      vi.spyOn(episodesDb, 'saveFavorite').mockResolvedValue(undefined);

      await episodesService.addEpisodeToFavorites(profileId, episodeId);

      expect(episodesDb.saveFavorite).toHaveBeenCalledWith(profileId, episodeId, WatchStatus.NOT_WATCHED);
    });

    it('should add an episode to favorites with the provided status', async () => {
      vi.spyOn(episodesDb, 'saveFavorite').mockResolvedValue(undefined);

      await episodesService.addEpisodeToFavorites(profileId, episodeId, WatchStatus.UNAIRED);

      expect(episodesDb.saveFavorite).toHaveBeenCalledWith(profileId, episodeId, WatchStatus.UNAIRED);
    });

    it('should handle errors when adding an episode to favorites', async () => {
      const error = new Error('Database error');

      vi.spyOn(episodesDb, 'saveFavorite').mockRejectedValue(error);
      vi.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(episodesService.addEpisodeToFavorites(profileId, episodeId)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
});
