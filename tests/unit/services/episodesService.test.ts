import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { CustomError } from '@middleware/errorMiddleware';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';

jest.mock('@db/episodesDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/showsDb');
jest.mock('@services/errorService');
jest.mock('@services/showService');

describe('episodesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateEpisodeWatchStatus', () => {
    it('should update episode watch status and return next unwatched episodes', async () => {
      const profileId = '123';
      const episodeId = 456;
      const status = 'WATCHED';
      const mockNextUnwatchedEpisodes = [{ show_id: 1, episodes: [{ episode_id: 789 }] }];

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await episodesService.updateEpisodeWatchStatus(profileId, episodeId, status);

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(profileId);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({ nextUnwatchedEpisodes: mockNextUnwatchedEpisodes });
    });

    it('should throw BadRequestError when update fails', async () => {
      const profileId = '123';
      const episodeId = 456;
      const status = 'WATCHED';

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(episodesService.updateEpisodeWatchStatus(profileId, episodeId, status)).rejects.toThrow(CustomError);
      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
      expect(showsDb.getNextUnwatchedEpisodesForProfile).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const profileId = '123';
      const episodeId = 456;
      const status = 'WATCHED';
      const mockError = new Error('Database error');

      (episodesDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.updateEpisodeWatchStatus(profileId, episodeId, status)).rejects.toThrow(
        'Handled: Database error',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateEpisodeWatchStatus(${profileId}, ${episodeId}, ${status})`,
      );
    });
  });

  describe('updateNextEpisodeWatchStatus', () => {
    it('should update next episode watch status and related season/show statuses', async () => {
      const profileId = '123';
      const showId = 789;
      const seasonId = 456;
      const episodeId = 101;
      const status = 'WATCHED';
      const mockNextUnwatchedEpisodes = [{ show_id: 789, episodes: [{ episode_id: 102 }] }];

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await episodesService.updateNextEpisodeWatchStatus(profileId, showId, seasonId, episodeId, status);

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).toHaveBeenCalledWith(profileId, seasonId);
      expect(showsDb.updateWatchStatusBySeason).toHaveBeenCalledWith(profileId, showId);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(profileId);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({ nextUnwatchedEpisodes: mockNextUnwatchedEpisodes });
    });

    it('should throw BadRequestError when update fails', async () => {
      const profileId = '123';
      const showId = 789;
      const seasonId = 456;
      const episodeId = 101;
      const status = 'WATCHED';

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow(CustomError);

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const profileId = '123';
      const showId = 789;
      const seasonId = 456;
      const episodeId = 101;
      const status = 'WATCHED';
      const mockError = new Error('Database error');

      (episodesDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateNextEpisodeWatchStatus(${profileId}, ${showId}, ${seasonId}, ${episodeId}, ${status})`,
      );
    });

    it('should handle errors in season status update', async () => {
      const profileId = '123';
      const showId = 789;
      const seasonId = 456;
      const episodeId = 101;
      const status = 'WATCHED';
      const mockError = new Error('Season update error');

      (episodesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (seasonsDb.updateWatchStatusByEpisode as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        episodesService.updateNextEpisodeWatchStatus(profileId, showId, seasonId, episodeId, status),
      ).rejects.toThrow('Handled: Season update error');

      expect(episodesDb.updateWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(seasonsDb.updateWatchStatusByEpisode).toHaveBeenCalledWith(profileId, seasonId);
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for the specified season', async () => {
      const profileId = '123';
      const seasonId = 456;
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
      const profileId = '123';
      const seasonId = 456;
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
      const profileId = '123';
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
      const profileId = '123';
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
      const profileId = '123';
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
      const profileId = '123';
      const mockError = new Error('Database error');

      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(episodesService.getRecentEpisodesForProfile(profileId)).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `getRecentEpisodesForProfile(${profileId})`);
    });
  });
});
