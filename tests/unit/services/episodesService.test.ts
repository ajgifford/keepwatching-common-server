import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { BadRequestError } from '@middleware/errorMiddleware';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';

jest.mock('@db/episodesDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/showsDb');
jest.mock('@services/errorService');
jest.mock('@services/showService');

describe('episodesService', () => {
  const accountId = 1;
  const profileId = 123;
  const showId = 789;
  const seasonId = 456;
  const episodeId = 101;
  const status = WatchStatus.WATCHED;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateEpisodeWatchStatus', () => {
    it('should update episode watch status and return next unwatched episodes', async () => {
      const mockNextUnwatchedEpisodes = [{ show_id: 1, episodes: [{ episode_id: 789 }] }];

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await episodesService.updateEpisodeWatchStatus(accountId, profileId, episodeId, status);

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should throw BadRequestError when update fails', async () => {
      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(episodesService.updateEpisodeWatchStatus(accountId, profileId, episodeId, status)).rejects.toThrow(
        BadRequestError,
      );
      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
      expect(showsDb.getNextUnwatchedEpisodesForProfile).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
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

  describe('updateNextEpisodeWatchStatus', () => {
    it('should update next episode watch status and related season/show statuses', async () => {
      const mockNextUnwatchedEpisodes = [{ show_id: 789, episodes: [{ episode_id: 102 }] }];

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await episodesService.updateNextEpisodeWatchStatus(
        accountId,
        profileId,
        showId,
        seasonId,
        episodeId,
        status,
      );

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).toHaveBeenCalledWith(profileId, seasonId);
      expect(showsDb.updateWatchStatusBySeason).toHaveBeenCalledWith(profileId, showId);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should throw BadRequestError when update fails', async () => {
      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(accountId, profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow(BadRequestError);

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(accountId, profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateNextEpisodeWatchStatus(${profileId}, ${showId}, ${seasonId}, ${episodeId}, ${status})`,
      );
    });

    it('should handle errors in season status update', async () => {
      const mockError = new Error('Season update error');

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (seasonsDb.updateWatchStatusByEpisode as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(accountId, profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow('Handled: Season update error');

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).toHaveBeenCalledWith(profileId, seasonId);
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for the specified season', async () => {
      const mockEpisodes = [
        { episode_id: 1, title: 'Episode 1', watch_status: 'WATCHED' },
        { episode_id: 2, title: 'Episode 2', watch_status: 'NOT_WATCHED' },
      ];

      (episodesDb.getEpisodesForSeason as jest.Mock).mockResolvedValue(mockEpisodes);

      const result = await episodesService.getEpisodesForSeason(profileId, seasonId);

      expect(episodesDb.getEpisodesForSeason).toHaveBeenCalledWith(profileId, seasonId);
      expect(result).toEqual(mockEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getEpisodesForSeason as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
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

      (episodesDb.getUpcomingEpisodesForProfile as jest.Mock).mockResolvedValue(mockUpcomingEpisodes);

      const result = await episodesService.getUpcomingEpisodesForProfile(profileId);

      expect(episodesDb.getUpcomingEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockUpcomingEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getUpcomingEpisodesForProfile as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
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

      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockResolvedValue(mockRecentEpisodes);

      const result = await episodesService.getRecentEpisodesForProfile(profileId);

      expect(episodesDb.getRecentEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockRecentEpisodes);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.getRecentEpisodesForProfile(profileId)).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `getRecentEpisodesForProfile(${profileId})`);
    });
  });

  describe('updateEpisode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
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

      jest.spyOn(episodesDb, 'updateEpisode').mockResolvedValue(updatedEpisode);

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

      jest.spyOn(episodesDb, 'updateEpisode').mockRejectedValue(error);
      jest.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(episodesService.updateEpisode(episodeData)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });

  describe('addEpisodeToFavorites', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add an episode to favorites successfully', async () => {
      jest.spyOn(episodesDb, 'saveFavorite').mockResolvedValue(undefined);

      await episodesService.addEpisodeToFavorites(profileId, episodeId);

      expect(episodesDb.saveFavorite).toHaveBeenCalledWith(profileId, episodeId);
    });

    it('should handle errors when adding an episode to favorites', async () => {
      const error = new Error('Database error');

      jest.spyOn(episodesDb, 'saveFavorite').mockRejectedValue(error);
      jest.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(episodesService.addEpisodeToFavorites(profileId, episodeId)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
});
