import { AdminWatchHistoryDetailResponse, WatchStatus } from '@ajgifford/keepwatching-types';
import * as adminWatchHistoryDb from '@db/adminWatchHistoryDb';
import { BadRequestError } from '@middleware/errorMiddleware';
import { AdminWatchHistoryService } from '@services/adminWatchHistoryService';
import { errorService } from '@services/errorService';

jest.mock('@db/adminWatchHistoryDb');
jest.mock('@services/errorService');

describe('AdminWatchHistoryService', () => {
  let service: AdminWatchHistoryService;

  const mockDetail: AdminWatchHistoryDetailResponse = {
    contentType: 'episode',
    status: { status: WatchStatus.WATCHED, watchedAt: '2024-01-01T00:00:00.000Z', isPriorWatch: false },
    history: [{ historyId: 1, watchedAt: '2024-01-01T00:00:00.000Z', watchNumber: 1, isPriorWatch: false }],
  };

  const pastDate = '2024-01-01T00:00:00.000Z';
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    service = new AdminWatchHistoryService();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getWatchHistoryDetail', () => {
    it('should dispatch to getEpisodeWatchDetail for episode', async () => {
      (adminWatchHistoryDb.getEpisodeWatchDetail as jest.Mock).mockResolvedValue(mockDetail);

      const result = await service.getWatchHistoryDetail('episode', 10, 100);

      expect(adminWatchHistoryDb.getEpisodeWatchDetail).toHaveBeenCalledWith(10, 100);
      expect(result).toBe(mockDetail);
    });

    it('should dispatch to getMovieWatchDetail for movie', async () => {
      (adminWatchHistoryDb.getMovieWatchDetail as jest.Mock).mockResolvedValue(mockDetail);

      await service.getWatchHistoryDetail('movie', 10, 200);

      expect(adminWatchHistoryDb.getMovieWatchDetail).toHaveBeenCalledWith(10, 200);
    });

    it('should dispatch to getSeasonWatchDetail for season', async () => {
      (adminWatchHistoryDb.getSeasonWatchDetail as jest.Mock).mockResolvedValue(mockDetail);

      await service.getWatchHistoryDetail('season', 10, 300);

      expect(adminWatchHistoryDb.getSeasonWatchDetail).toHaveBeenCalledWith(10, 300);
    });

    it('should dispatch to getShowWatchDetail for show', async () => {
      (adminWatchHistoryDb.getShowWatchDetail as jest.Mock).mockResolvedValue(mockDetail);

      await service.getWatchHistoryDetail('show', 10, 400);

      expect(adminWatchHistoryDb.getShowWatchDetail).toHaveBeenCalledWith(10, 400);
    });

    it('should propagate errors via errorService', async () => {
      const dbError = new Error('boom');
      (adminWatchHistoryDb.getEpisodeWatchDetail as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getWatchHistoryDetail('episode', 10, 100)).rejects.toThrow(dbError);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getWatchHistoryDetail(episode, 10, 100)');
    });
  });

  describe('updateWatchHistoryEntryDate', () => {
    it('should dispatch to updateEpisodeWatchHistoryDate for episode', async () => {
      await service.updateWatchHistoryEntryDate('episode', 1, pastDate);

      expect(adminWatchHistoryDb.updateEpisodeWatchHistoryDate).toHaveBeenCalledWith(1, pastDate);
    });

    it('should dispatch to updateMovieWatchHistoryDate for movie', async () => {
      await service.updateWatchHistoryEntryDate('movie', 2, pastDate);

      expect(adminWatchHistoryDb.updateMovieWatchHistoryDate).toHaveBeenCalledWith(2, pastDate);
    });

    it('should dispatch to updateSeasonWatchHistoryDate for season', async () => {
      await service.updateWatchHistoryEntryDate('season', 3, pastDate);

      expect(adminWatchHistoryDb.updateSeasonWatchHistoryDate).toHaveBeenCalledWith(3, pastDate);
    });

    it('should dispatch to updateShowWatchHistoryDate for show', async () => {
      await service.updateWatchHistoryEntryDate('show', 4, pastDate);

      expect(adminWatchHistoryDb.updateShowWatchHistoryDate).toHaveBeenCalledWith(4, pastDate);
    });

    it('should reject a future watchedAt without calling the db layer', async () => {
      await expect(service.updateWatchHistoryEntryDate('episode', 1, futureDate)).rejects.toThrow(BadRequestError);
      expect(adminWatchHistoryDb.updateEpisodeWatchHistoryDate).not.toHaveBeenCalled();
    });
  });

  describe('updateWatchStatusDate', () => {
    it('should dispatch to updateEpisodeWatchStatusDate for episode', async () => {
      await service.updateWatchStatusDate('episode', 10, 100, pastDate);

      expect(adminWatchHistoryDb.updateEpisodeWatchStatusDate).toHaveBeenCalledWith(10, 100, pastDate);
    });

    it('should dispatch to updateMovieWatchStatusDate for movie', async () => {
      await service.updateWatchStatusDate('movie', 10, 200, pastDate);

      expect(adminWatchHistoryDb.updateMovieWatchStatusDate).toHaveBeenCalledWith(10, 200, pastDate);
    });

    it('should reject season with BadRequestError since seasons have no status-level date', async () => {
      await expect(service.updateWatchStatusDate('season', 10, 300, pastDate)).rejects.toThrow(BadRequestError);
    });

    it('should reject show with BadRequestError since shows have no status-level date', async () => {
      await expect(service.updateWatchStatusDate('show', 10, 400, pastDate)).rejects.toThrow(BadRequestError);
    });

    it('should reject a future watchedAt without calling the db layer', async () => {
      await expect(service.updateWatchStatusDate('episode', 10, 100, futureDate)).rejects.toThrow(BadRequestError);
      expect(adminWatchHistoryDb.updateEpisodeWatchStatusDate).not.toHaveBeenCalled();
    });
  });
});
