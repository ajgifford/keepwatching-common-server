import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { errorService } from '@services/errorService';
import { seasonsService } from '@services/seasonsService';
import { showService } from '@services/showService';

jest.mock('@db/seasonsDb');
jest.mock('@db/showsDb');
jest.mock('@services/errorService');
jest.mock('@services/showService');

describe('seasonsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSeasonWatchStatus', () => {
    it('should update season watch status without recursion', async () => {
      (seasonsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(123);
      (showService.invalidateProfileCache as jest.Mock).mockImplementation(() => {});

      const result = await seasonsService.updateSeasonWatchStatus('456', 789, 'WATCHED');

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('456', 789, 'WATCHED');
      expect(seasonsDb.updateAllWatchStatuses).not.toHaveBeenCalled();
      expect(seasonsDb.getShowIdForSeason).toHaveBeenCalledWith(789);
      expect(showsDb.updateWatchStatusBySeason).toHaveBeenCalledWith('456', 123);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith('456');
      expect(result).toBe(true);
    });

    it('should update season watch status with recursion', async () => {
      (seasonsDb.updateAllWatchStatuses as jest.Mock).mockResolvedValue(true);
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(123);
      (showService.invalidateProfileCache as jest.Mock).mockImplementation(() => {});

      const result = await seasonsService.updateSeasonWatchStatus('456', 789, 'WATCHED', true);

      expect(seasonsDb.updateAllWatchStatuses).toHaveBeenCalledWith('456', 789, 'WATCHED');
      expect(seasonsDb.updateWatchStatus).not.toHaveBeenCalled();
      expect(seasonsDb.getShowIdForSeason).toHaveBeenCalledWith(789);
      expect(showsDb.updateWatchStatusBySeason).toHaveBeenCalledWith('456', 123);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith('456');
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (seasonsDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(seasonsService.updateSeasonWatchStatus('456', 789, 'WATCHED')).rejects.toThrow(
        'No season watch status was updated',
      );

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('456', 789, 'WATCHED');
      expect(seasonsDb.getShowIdForSeason).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should handle errors when updating season watch status', async () => {
      const mockError = new Error('Update failed');
      (seasonsDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(seasonsService.updateSeasonWatchStatus('456', 789, 'WATCHED')).rejects.toThrow(
        'Handled: Update failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateSeasonWatchStatus(456, 789, WATCHED, false)',
      );
    });

    it('should handle missing show ID', async () => {
      (seasonsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(null);

      const result = await seasonsService.updateSeasonWatchStatus('456', 789, 'WATCHED');

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('456', 789, 'WATCHED');
      expect(seasonsDb.getShowIdForSeason).toHaveBeenCalledWith(789);
      expect(showsDb.updateWatchStatusBySeason).not.toHaveBeenCalled();
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getSeasonsForShow', () => {
    it('should get seasons for a show', async () => {
      const mockSeasons = [
        { season_id: 1, name: 'Season 1', episodes: [{ episode_id: 101 }, { episode_id: 102 }] },
        { season_id: 2, name: 'Season 2', episodes: [{ episode_id: 201 }] },
      ];

      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue(mockSeasons);

      const result = await seasonsService.getSeasonsForShow('456', '123');

      expect(seasonsDb.getSeasonsForShow).toHaveBeenCalledWith('456', '123');
      expect(result).toEqual(mockSeasons);
    });

    it('should handle errors when getting seasons for a show', async () => {
      const mockError = new Error('Database error');
      (seasonsDb.getSeasonsForShow as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(seasonsService.getSeasonsForShow('456', '123')).rejects.toThrow('Handled: Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getSeasonsForShow(456, 123)');
    });
  });

  describe('updateSeasonWatchStatusForNewEpisodes', () => {
    it('should update season and show status from WATCHED to WATCHING when new episodes added', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(456);
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.getWatchStatus).toHaveBeenCalledWith('123', 789);
      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('123', 789, 'UP_TO_DATE');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('123', 456, 'UP_TO_DATE');
    });

    it('should update only season status when show status is already WATCHING', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(456);
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHING');

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('123', 789, 'UP_TO_DATE');
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should not update season status if already set to something other than WATCHED', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHING');

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.getWatchStatus).toHaveBeenCalledWith('123', 789);
      expect(seasonsDb.updateWatchStatus).not.toHaveBeenCalled();
      expect(seasonsDb.getShowIdForSeason).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should do nothing if season has no watch status record', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue(null);

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.updateWatchStatus).not.toHaveBeenCalled();
      expect(seasonsDb.getShowIdForSeason).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should not update show status if season has no associated show', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(null);

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('123', 789, 'UP_TO_DATE');
      expect(seasonsDb.getShowIdForSeason).toHaveBeenCalledWith(789);
      expect(showsDb.getWatchStatus).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should not update show status if show status is NOT_WATCHED', async () => {
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(456);
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('NOT_WATCHED');

      await seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789);

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('123', 789, 'UP_TO_DATE');
      expect(showsDb.getWatchStatus).toHaveBeenCalledWith('123', 456);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when getting season watch status', async () => {
      const mockError = new Error('Database error');
      (seasonsDb.getWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789)).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateSeasonWatchStatusForNewEpisodes(123, 789)',
      );
      expect(seasonsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when updating season watch status', async () => {
      const mockError = new Error('Update failed');
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789)).rejects.toThrow('Update failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateSeasonWatchStatusForNewEpisodes(123, 789)',
      );
    });

    it('should handle errors when getting show ID', async () => {
      const mockError = new Error('Show ID lookup failed');
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      (seasonsDb.getShowIdForSeason as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789)).rejects.toThrow(
        'Show ID lookup failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateSeasonWatchStatusForNewEpisodes(123, 789)',
      );
      expect(showsDb.getWatchStatus).not.toHaveBeenCalled();
    });

    it('should complete season update even if show update fails', async () => {
      const mockError = new Error('Show update failed');
      (seasonsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (seasonsDb.getShowIdForSeason as jest.Mock).mockResolvedValue(456);
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');
      (showsDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(seasonsService.updateSeasonWatchStatusForNewEpisodes('123', 789)).rejects.toThrow(
        'Show update failed',
      );

      expect(seasonsDb.updateWatchStatus).toHaveBeenCalledWith('123', 789, 'UP_TO_DATE');
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateSeasonWatchStatusForNewEpisodes(123, 789)',
      );
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

      const updatedSeason = { ...seasonData, id: 500 };

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
        // Incomplete data
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

    it('should add a season to favorites successfully', async () => {
      const profileId = 123;
      const seasonId = 456;

      jest.spyOn(seasonsDb, 'saveFavorite').mockResolvedValue(undefined);

      await seasonsService.addSeasonToFavorites(profileId, seasonId);

      expect(seasonsDb.saveFavorite).toHaveBeenCalledWith(profileId, seasonId);
    });

    it('should handle errors when adding a season to favorites', async () => {
      const profileId = 123;
      const seasonId = 456;

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
