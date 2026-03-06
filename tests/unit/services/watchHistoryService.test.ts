import { StatusUpdateResult } from '../../../src/types/watchStatusTypes';
import { BulkMarkedShowRow, WatchStatusDbService } from '@db/watchStatusDb';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';
import {
  WatchHistoryService,
  getWatchHistoryService,
  resetWatchHistoryService,
  watchHistoryService,
} from '@services/watchHistoryService';
import { watchStatusService } from '@services/watchStatusService';
import { BulkMarkedShow, ProfileShow } from '@ajgifford/keepwatching-types';

jest.mock('@db/watchStatusDb');
jest.mock('@services/errorService');
jest.mock('@services/showService');
jest.mock('@services/watchStatusService');

describe('WatchHistoryService', () => {
  let service: WatchHistoryService;
  let mockDbService: jest.Mocked<WatchStatusDbService>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWatchHistoryService();

    mockDbService = {
      detectBulkMarkedShows: jest.fn(),
    } as any;

    service = new WatchHistoryService({ dbService: mockDbService });
  });

  afterEach(() => {
    resetWatchHistoryService();
    jest.resetModules();
  });

  describe('markShowAsPriorWatched', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;

    const mockShowWithSeasons = { id: showId, title: 'Breaking Bad', seasons: [] } as unknown as ProfileShow;
    const mockNextEpisodes: any[] = [];

    it('should mark seasons as prior watched and return updated show data', async () => {
      const priorWatchResult: StatusUpdateResult = {
        success: true,
        changes: [],
        affectedRows: 20,
        message: 'Marked 20 episodes as previously watched',
      };

      (watchStatusService.markSeasonsAsPriorWatched as jest.Mock).mockResolvedValue(priorWatchResult);
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextEpisodes);

      const result = await service.markShowAsPriorWatched(accountId, profileId, showId);

      expect(watchStatusService.markSeasonsAsPriorWatched).toHaveBeenCalledWith(
        accountId, profileId, showId, undefined,
      );
      expect(showService.getShowDetailsForProfile).toHaveBeenCalledWith(accountId, profileId, showId);
      expect(showService.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({
        showWithSeasons: mockShowWithSeasons,
        nextUnwatchedEpisodes: mockNextEpisodes,
      });
    });

    it('should pass upToSeasonNumber when provided', async () => {
      (watchStatusService.markSeasonsAsPriorWatched as jest.Mock).mockResolvedValue({
        success: true, changes: [], affectedRows: 10,
      });
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      await service.markShowAsPriorWatched(accountId, profileId, showId, 2);

      expect(watchStatusService.markSeasonsAsPriorWatched).toHaveBeenCalledWith(
        accountId, profileId, showId, 2,
      );
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Service failed');
      (watchStatusService.markSeasonsAsPriorWatched as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        service.markShowAsPriorWatched(accountId, profileId, showId),
      ).rejects.toThrow('Handled: Service failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `markShowAsPriorWatched(${accountId}, ${profileId}, ${showId}, undefined)`,
      );
    });
  });

  describe('getBulkMarkedShows', () => {
    const profileId = 123;

    it('should return mapped BulkMarkedShow objects', async () => {
      const mockRows = [
        {
          showId: 1,
          title: 'Breaking Bad',
          posterImage: '/poster1.jpg',
          markDate: '2023-01-15',
          episodeCount: 50,
        },
        {
          showId: 2,
          title: 'The Wire',
          posterImage: '/poster2.jpg',
          markDate: '2023-02-01',
          episodeCount: 12,
        },
      ] as unknown as BulkMarkedShowRow[];

      mockDbService.detectBulkMarkedShows.mockResolvedValue(mockRows);

      const result = await service.getBulkMarkedShows(profileId);

      expect(mockDbService.detectBulkMarkedShows).toHaveBeenCalledWith(profileId);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<BulkMarkedShow>({
        showId: 1,
        title: 'Breaking Bad',
        posterImage: '/poster1.jpg',
        markDate: '2023-01-15',
        episodeCount: 50,
      });
      expect(result[1]).toEqual<BulkMarkedShow>({
        showId: 2,
        title: 'The Wire',
        posterImage: '/poster2.jpg',
        markDate: '2023-02-01',
        episodeCount: 12,
      });
    });

    it('should return empty array when no bulk-marked shows exist', async () => {
      mockDbService.detectBulkMarkedShows.mockResolvedValue([]);

      const result = await service.getBulkMarkedShows(profileId);

      expect(result).toEqual([]);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Detection failed');
      mockDbService.detectBulkMarkedShows.mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.getBulkMarkedShows(profileId)).rejects.toThrow('Handled: Detection failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `getBulkMarkedShows(${profileId})`,
      );
    });
  });

  describe('retroactivelyMarkShowAsPrior', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;

    it('should delegate to watchStatusService and resolve', async () => {
      (watchStatusService.retroactivelyMarkShowAsPrior as jest.Mock).mockResolvedValue({
        success: true, changes: [], affectedRows: 8,
        message: 'Retroactively marked 8 episodes as previously watched',
      });

      await service.retroactivelyMarkShowAsPrior(accountId, profileId, showId);

      expect(watchStatusService.retroactivelyMarkShowAsPrior).toHaveBeenCalledWith(
        accountId, profileId, showId, undefined,
      );
    });

    it('should pass seasonIds to watchStatusService when provided', async () => {
      (watchStatusService.retroactivelyMarkShowAsPrior as jest.Mock).mockResolvedValue({
        success: true, changes: [], affectedRows: 4,
      });

      await service.retroactivelyMarkShowAsPrior(accountId, profileId, showId, [1, 2]);

      expect(watchStatusService.retroactivelyMarkShowAsPrior).toHaveBeenCalledWith(
        accountId, profileId, showId, [1, 2],
      );
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Mark prior failed');
      (watchStatusService.retroactivelyMarkShowAsPrior as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        service.retroactivelyMarkShowAsPrior(accountId, profileId, showId),
      ).rejects.toThrow('Handled: Mark prior failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `retroactivelyMarkShowAsPrior(${accountId}, ${profileId}, ${showId})`,
      );
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(watchHistoryService).toBeInstanceOf(WatchHistoryService);
    });

    it('should return the same instance from getWatchHistoryService', () => {
      const instance1 = getWatchHistoryService();
      const instance2 = getWatchHistoryService();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = getWatchHistoryService();
      resetWatchHistoryService();
      const instance2 = getWatchHistoryService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
