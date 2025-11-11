import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as seasonsDb from '@db/seasonsDb';
import { appLogger } from '@logger/logger';
import { errorService } from '@services/errorService';
import {
  SeasonsService,
  createSeasonsService,
  resetSeasonsService,
} from '@services/seasonsService';
import { showService } from '@services/showService';
import { watchStatusService } from '@services/watchStatusService';

jest.mock('@db/seasonsDb');
jest.mock('@services/errorService');
jest.mock('@services/showService');
jest.mock('@services/watchStatusService');

jest.mock('@logger/logger', () => ({
  appLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('seasonsService', () => {
  let seasonsService: SeasonsService;
  const accountId = 123;
  const profileId = 456;
  const seasonId = 789;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSeasonsService();
    seasonsService = createSeasonsService();
  });

  afterEach(() => {
    resetSeasonsService();
  });

  describe('updateSeasonWatchStatus', () => {
    it('should update season watch status', async () => {
      const mockNextUnwatchedEpisodes = [{ show_id: 1, episodes: [{ episode_id: 789 }] }];
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      (watchStatusService.updateSeasonWatchStatus as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Season test message',
        affectedRows: 1,
        changes: [{}, {}],
      });

      const result = await seasonsService.updateSeasonWatchStatus(accountId, profileId, seasonId, WatchStatus.WATCHED);

      expect(watchStatusService.updateSeasonWatchStatus).toHaveBeenCalledWith(
        accountId,
        profileId,
        seasonId,
        WatchStatus.WATCHED,
      );
      expect(result.nextUnwatchedEpisodes).toEqual(mockNextUnwatchedEpisodes);
      expect(appLogger.info).toHaveBeenCalledWith(`Season ${seasonId} update: Season test message`);
      expect(appLogger.info).toHaveBeenCalledWith(`Affected entities: 2`);
    });

    it('should handle errors when updating season watch status', async () => {
      const mockError = new Error('Update failed');
      (watchStatusService.updateSeasonWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        seasonsService.updateSeasonWatchStatus(accountId, profileId, seasonId, WatchStatus.WATCHED),
      ).rejects.toThrow('Handled: Update failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateSeasonWatchStatus(${accountId}, ${profileId}, ${seasonId}, WATCHED)`,
      );
    });
  });

  describe('getSeasonsForShow', () => {
    it('should get seasons for a show', async () => {
      const mockSeasons = [
        { season_id: 1, name: 'Season 1', episodes: [{ episode_id: 101 }, { episode_id: 102 }] },
        { season_id: 2, name: 'Season 2', episodes: [{ episode_id: 201 }] },
      ];

      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue(mockSeasons);

      const result = await seasonsService.getSeasonsForShow(456, 123);

      expect(seasonsDb.getSeasonsForShow).toHaveBeenCalledWith(456, 123);
      expect(result).toEqual(mockSeasons);
    });

    it('should handle errors when getting seasons for a show', async () => {
      const mockError = new Error('Database error');
      (seasonsDb.getSeasonsForShow as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(seasonsService.getSeasonsForShow(456, 123)).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getSeasonsForShow(456, 123)');
    });
  });

  describe('updateSeason', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update a season successfully', async () => {
      const seasonData = {
        show_id: 100,
        tmdb_id: 12345,
        name: 'Season 1',
        overview: 'Season overview',
        season_number: 1,
        release_date: '2024-01-01',
        poster_image: '/path/to/poster.jpg',
        number_of_episodes: 10,
      };

      const updatedSeason = 500;

      jest.spyOn(seasonsDb, 'updateSeason').mockResolvedValue(updatedSeason);

      const result = await seasonsService.updateSeason(seasonData);

      expect(seasonsDb.updateSeason).toHaveBeenCalledWith(seasonData);
      expect(result).toEqual(updatedSeason);
    });

    it('should handle errors when updating a season', async () => {
      const seasonData = {
        show_id: 100,
        tmdb_id: 12345,
        name: 'Season 1',
        overview: 'Season 1',
        season_number: 1,
        number_of_episodes: 10,
        release_date: '',
        poster_image: 'image.png',
      };

      const error = new Error('Database error');

      jest.spyOn(seasonsDb, 'updateSeason').mockRejectedValue(error);
      jest.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(seasonsService.updateSeason(seasonData)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });

  describe('addSeasonToFavorites', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add a season to favorites successfully with the default status', async () => {
      jest.spyOn(seasonsDb, 'saveFavorite').mockResolvedValue(undefined);

      await seasonsService.addSeasonToFavorites(profileId, seasonId);

      expect(seasonsDb.saveFavorite).toHaveBeenCalledWith(profileId, seasonId, WatchStatus.NOT_WATCHED);
    });

    it('should add a season to favorites successfully with the provided status', async () => {
      jest.spyOn(seasonsDb, 'saveFavorite').mockResolvedValue(undefined);

      await seasonsService.addSeasonToFavorites(profileId, seasonId, WatchStatus.UNAIRED);

      expect(seasonsDb.saveFavorite).toHaveBeenCalledWith(profileId, seasonId, WatchStatus.UNAIRED);
    });

    it('should handle errors when adding a season to favorites', async () => {
      const error = new Error('Database error');

      jest.spyOn(seasonsDb, 'saveFavorite').mockRejectedValue(error);
      jest.spyOn(errorService, 'handleError').mockImplementation((err) => {
        throw err;
      });

      await expect(seasonsService.addSeasonToFavorites(profileId, seasonId)).rejects.toThrow(error);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
});
