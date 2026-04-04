import { StatusUpdateResult } from '../../../src/types/watchStatusTypes';
import { WatchHistoryRow } from '../../../src/types/watchHistoryTypes';
import { BulkMarkedShowRow, WatchStatusDbService } from '@db/watchStatusDb';
import {
  getEpisodeWatchCount,
  getShowIdForSeason,
  getWatchHistoryForProfile,
  recalculateShowStatusAfterSeasonReset,
  recordEpisodeRewatch as recordEpisodeRewatchDb,
  resetMovieForRewatch,
  resetSeasonForRewatch,
  resetShowForRewatch,
} from '@db/watchHistoryDb';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { showService } from '@services/showService';
import {
  WatchHistoryService,
  getWatchHistoryService,
  resetWatchHistoryService,
  watchHistoryService,
} from '@services/watchHistoryService';
import { watchStatusService } from '@services/watchStatusService';
import { TransactionHelper } from '@utils/transactionHelper';
import { BulkMarkedShow, ProfileMovie, ProfileShow, WatchHistoryItem } from '@ajgifford/keepwatching-types';

jest.mock('@db/watchStatusDb');
jest.mock('@db/watchHistoryDb');
jest.mock('@services/errorService');
jest.mock('@services/moviesService');
jest.mock('@services/showService');
jest.mock('@services/watchStatusService');
jest.mock('@utils/transactionHelper');

describe('WatchHistoryService', () => {
  let service: WatchHistoryService;
  let mockDbService: jest.Mocked<WatchStatusDbService>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWatchHistoryService();

    // resetMocks: true clears implementations set in jest.mock() factories,
    // so re-establish the TransactionHelper mock here after each reset.
    (TransactionHelper as jest.Mock).mockImplementation(() => ({
      executeInTransaction: jest.fn().mockImplementation(async (callback: (conn: any) => Promise<any>) => {
        return callback({});
      }),
    }));

    mockDbService = {
      detectBulkMarkedShows: jest.fn(),
      dismissBulkMarkedShow: jest.fn(),
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

  describe('markSeasonIdsAsPriorWatched', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;
    const seasonIds = [10, 11, 12];

    const mockShowWithSeasons = { id: showId, title: 'The Wire', seasons: [] } as unknown as ProfileShow;

    it('should mark specific seasons as prior watched and return updated show data', async () => {
      (watchStatusService.markSeasonIdsAsPriorWatched as jest.Mock).mockResolvedValue({
        success: true, changes: [], affectedRows: 30,
      });
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.markSeasonIdsAsPriorWatched(accountId, profileId, showId, seasonIds);

      expect(watchStatusService.markSeasonIdsAsPriorWatched).toHaveBeenCalledWith(
        accountId, profileId, showId, seasonIds,
      );
      expect(showService.getShowDetailsForProfile).toHaveBeenCalledWith(accountId, profileId, showId);
      expect(showService.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({
        showWithSeasons: mockShowWithSeasons,
        nextUnwatchedEpisodes: [],
      });
    });

    it('should work with a single season ID', async () => {
      (watchStatusService.markSeasonIdsAsPriorWatched as jest.Mock).mockResolvedValue({
        success: true, changes: [], affectedRows: 10,
      });
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      await service.markSeasonIdsAsPriorWatched(accountId, profileId, showId, [10]);

      expect(watchStatusService.markSeasonIdsAsPriorWatched).toHaveBeenCalledWith(
        accountId, profileId, showId, [10],
      );
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Mark season IDs failed');
      (watchStatusService.markSeasonIdsAsPriorWatched as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        service.markSeasonIdsAsPriorWatched(accountId, profileId, showId, seasonIds),
      ).rejects.toThrow('Handled: Mark season IDs failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `markSeasonIdsAsPriorWatched(${accountId}, ${profileId}, ${showId}, [${seasonIds.join(', ')}])`,
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

  describe('dismissBulkMarkedShow', () => {
    const profileId = 123;
    const showId = 456;

    it('should call dbService.dismissBulkMarkedShow with correct arguments', async () => {
      mockDbService.dismissBulkMarkedShow.mockResolvedValue(undefined as any);

      await service.dismissBulkMarkedShow(profileId, showId);

      expect(mockDbService.dismissBulkMarkedShow).toHaveBeenCalledWith(profileId, showId);
    });

    it('should resolve without returning a value', async () => {
      mockDbService.dismissBulkMarkedShow.mockResolvedValue(undefined as any);

      const result = await service.dismissBulkMarkedShow(profileId, showId);

      expect(result).toBeUndefined();
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Dismiss failed');
      mockDbService.dismissBulkMarkedShow.mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.dismissBulkMarkedShow(profileId, showId)).rejects.toThrow('Handled: Dismiss failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `dismissBulkMarkedShow(${profileId}, ${showId})`,
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

  describe('startShowRewatch', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;

    const mockShowWithSeasons = { id: showId, title: 'Sopranos', seasons: [] } as unknown as ProfileShow;

    it('should reset show, invalidate cache, and return updated show data', async () => {
      (resetShowForRewatch as jest.Mock).mockResolvedValue(undefined);
      (showService.invalidateAccountCache as jest.Mock).mockResolvedValue(undefined);
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.startShowRewatch(accountId, profileId, showId);

      expect(resetShowForRewatch).toHaveBeenCalledWith({}, profileId, showId);
      expect(showService.invalidateAccountCache).toHaveBeenCalledWith(accountId);
      expect(showService.getShowDetailsForProfile).toHaveBeenCalledWith(accountId, profileId, showId);
      expect(showService.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({
        showWithSeasons: mockShowWithSeasons,
        nextUnwatchedEpisodes: [],
      });
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Reset failed');
      (resetShowForRewatch as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.startShowRewatch(accountId, profileId, showId)).rejects.toThrow('Handled: Reset failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `startShowRewatch(${accountId}, ${profileId}, ${showId})`,
      );
    });
  });

  describe('startSeasonRewatch', () => {
    const accountId = 1;
    const profileId = 123;
    const seasonId = 789;
    const showId = 456;

    const mockShowWithSeasons = { id: showId, title: 'Lost', seasons: [] } as unknown as ProfileShow;

    it('should look up show ID, reset season, recalculate status, and return updated data', async () => {
      (getShowIdForSeason as jest.Mock).mockResolvedValue(showId);
      (resetSeasonForRewatch as jest.Mock).mockResolvedValue(undefined);
      (recalculateShowStatusAfterSeasonReset as jest.Mock).mockResolvedValue(undefined);
      (showService.invalidateAccountCache as jest.Mock).mockResolvedValue(undefined);
      (showService.getShowDetailsForProfile as jest.Mock).mockResolvedValue(mockShowWithSeasons);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.startSeasonRewatch(accountId, profileId, seasonId);

      expect(getShowIdForSeason).toHaveBeenCalledWith({}, seasonId);
      expect(resetSeasonForRewatch).toHaveBeenCalledWith({}, profileId, seasonId);
      expect(recalculateShowStatusAfterSeasonReset).toHaveBeenCalledWith({}, profileId, showId);
      expect(showService.invalidateAccountCache).toHaveBeenCalledWith(accountId);
      expect(showService.getShowDetailsForProfile).toHaveBeenCalledWith(accountId, profileId, showId);
      expect(result).toEqual({
        showWithSeasons: mockShowWithSeasons,
        nextUnwatchedEpisodes: [],
      });
    });

    it('should throw when season is not found', async () => {
      (getShowIdForSeason as jest.Mock).mockResolvedValue(null);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.startSeasonRewatch(accountId, profileId, seasonId)).rejects.toThrow(
        `Handled: Season ${seasonId} not found`,
      );
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Season reset failed');
      (getShowIdForSeason as jest.Mock).mockResolvedValue(showId);
      (resetSeasonForRewatch as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.startSeasonRewatch(accountId, profileId, seasonId)).rejects.toThrow(
        'Handled: Season reset failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `startSeasonRewatch(${accountId}, ${profileId}, ${seasonId})`,
      );
    });
  });

  describe('startMovieRewatch', () => {
    const accountId = 1;
    const profileId = 123;
    const movieId = 999;

    const mockMovie = { id: movieId, title: 'Inception', watchStatus: 'NOT_WATCHED' } as unknown as ProfileMovie;

    it('should reset movie and return updated movie details', async () => {
      (resetMovieForRewatch as jest.Mock).mockResolvedValue(undefined);
      (moviesService.getMovieDetailsForProfile as jest.Mock).mockResolvedValue(mockMovie);

      const result = await service.startMovieRewatch(accountId, profileId, movieId);

      expect(resetMovieForRewatch).toHaveBeenCalledWith({}, profileId, movieId);
      expect(moviesService.getMovieDetailsForProfile).toHaveBeenCalledWith(profileId, movieId);
      expect(result).toEqual(mockMovie);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Movie reset failed');
      (resetMovieForRewatch as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.startMovieRewatch(accountId, profileId, movieId)).rejects.toThrow(
        'Handled: Movie reset failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `startMovieRewatch(${accountId}, ${profileId}, ${movieId})`,
      );
    });
  });

  describe('recordEpisodeRewatch', () => {
    const accountId = 1;
    const profileId = 123;
    const episodeId = 555;

    it('should record rewatch and return episodeId, watchCount, and watchedAt', async () => {
      (recordEpisodeRewatchDb as jest.Mock).mockResolvedValue(undefined);
      (getEpisodeWatchCount as jest.Mock).mockResolvedValue(3);

      const before = new Date();
      const result = await service.recordEpisodeRewatch(accountId, profileId, episodeId);
      const after = new Date();

      expect(recordEpisodeRewatchDb).toHaveBeenCalledWith({}, profileId, episodeId);
      expect(getEpisodeWatchCount).toHaveBeenCalledWith(profileId, episodeId);
      expect(result.episodeId).toBe(episodeId);
      expect(result.watchCount).toBe(3);
      expect(new Date(result.watchedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(result.watchedAt).getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return watchedAt as a valid ISO string', async () => {
      (recordEpisodeRewatchDb as jest.Mock).mockResolvedValue(undefined);
      (getEpisodeWatchCount as jest.Mock).mockResolvedValue(1);

      const result = await service.recordEpisodeRewatch(accountId, profileId, episodeId);

      expect(result.watchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Rewatch insert failed');
      (recordEpisodeRewatchDb as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.recordEpisodeRewatch(accountId, profileId, episodeId)).rejects.toThrow(
        'Handled: Rewatch insert failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `recordEpisodeRewatch(${accountId}, ${profileId}, ${episodeId})`,
      );
    });
  });

  describe('getHistoryForProfile', () => {
    const profileId = 123;

    const makeRow = (overrides: Record<string, any> = {}): WatchHistoryRow => ({
      historyId: 1,
      contentType: 'episode',
      contentId: 10,
      title: 'Pilot',
      parentTitle: 'Breaking Bad',
      seasonNumber: 1,
      episodeNumber: 1,
      posterImage: '/poster.jpg',
      watchedAt: '2026-03-01T10:00:00.000Z',
      watchNumber: 1,
      isPriorWatch: 0,
      runtime: 45,
      ...overrides,
    } as WatchHistoryRow);

    it('should return transformed history items with pagination metadata', async () => {
      const mockRows = [makeRow(), makeRow({ historyId: 2, title: 'Episode 2', episodeNumber: 2 })];
      (getWatchHistoryForProfile as jest.Mock).mockResolvedValue({ items: mockRows, totalCount: 2 });

      const result = await service.getHistoryForProfile(profileId);

      expect(getWatchHistoryForProfile).toHaveBeenCalledWith(
        profileId, 1, 20, 'all', 'desc', undefined, undefined, false, undefined, false,
      );
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(2);
    });

    it('should transform WatchHistoryRow to WatchHistoryItem (isPriorWatch as boolean)', async () => {
      const rowWithNumericFlag = makeRow({ isPriorWatch: 1 });
      (getWatchHistoryForProfile as jest.Mock).mockResolvedValue({ items: [rowWithNumericFlag], totalCount: 1 });

      const result = await service.getHistoryForProfile(profileId);

      const item: WatchHistoryItem = result.items[0];
      expect(item.isPriorWatch).toBe(true);
    });

    it('should pass all optional filter parameters to the db layer', async () => {
      (getWatchHistoryForProfile as jest.Mock).mockResolvedValue({ items: [], totalCount: 0 });

      await service.getHistoryForProfile(
        profileId, 2, 10, 'episode', 'asc', '2026-01-01', '2026-03-31', true, 'Breaking', true,
      );

      expect(getWatchHistoryForProfile).toHaveBeenCalledWith(
        profileId, 2, 10, 'episode', 'asc', '2026-01-01', '2026-03-31', true, 'Breaking', true,
      );
    });

    it('should return correct page and pageSize in result', async () => {
      (getWatchHistoryForProfile as jest.Mock).mockResolvedValue({ items: [], totalCount: 100 });

      const result = await service.getHistoryForProfile(profileId, 3, 15);

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(15);
      expect(result.totalCount).toBe(100);
    });

    it('should handle empty history results', async () => {
      (getWatchHistoryForProfile as jest.Mock).mockResolvedValue({ items: [], totalCount: 0 });

      const result = await service.getHistoryForProfile(profileId);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('History query failed');
      (getWatchHistoryForProfile as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.getHistoryForProfile(profileId)).rejects.toThrow('Handled: History query failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `getHistoryForProfile(${profileId}, 1, 20)`,
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
