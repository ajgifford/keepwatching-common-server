import { mockNextUnwatchedEpisodes } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Watch Status', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  const accountId = 1;
  const profileId = 123;
  const showId = 1;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('updateShowWatchStatus', () => {
    it('should update watch status successfully', async () => {
      (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);
      mockCache.getOrSet.mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.updateShowWatchStatus(accountId, profileId, showId, WatchStatus.WATCHED);

      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(profileId, showId, WatchStatus.WATCHED);
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should update all watch statuses recursively when requested', async () => {
      (showsDb.updateAllWatchStatuses as jest.Mock).mockResolvedValue(true);

      await service.updateShowWatchStatus(accountId, profileId, showId, WatchStatus.WATCHED, true);

      expect(showsDb.updateAllWatchStatuses).toHaveBeenCalledWith(profileId, showId, WatchStatus.WATCHED);
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(accountId, profileId);
    });

    it('should throw BadRequestError when update fails', async () => {
      (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);

      await expect(service.updateShowWatchStatus(accountId, profileId, showId, WatchStatus.WATCHED)).rejects.toThrow(
        BadRequestError,
      );
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(profileId, showId, WatchStatus.WATCHED);
    });
  });

  describe('updateShowWatchStatusForNewContent', () => {
    it('should update show status from WATCHED to WATCHING for profiles with new content', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');

      await service.updateShowWatchStatusForNewContent(showId, [
        { accountId: 1, profileId: 123 },
        { accountId: 1, profileId: 456 },
      ]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(123, showId, 'UP_TO_DATE');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(456, showId, 'UP_TO_DATE');
    });

    it('should not update show status if already set to something other than WATCHED', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHING');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('NOT_WATCHED');

      await service.updateShowWatchStatusForNewContent(showId, [
        { accountId: 1, profileId: 123 },
        { accountId: 1, profileId: 456 },
      ]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when getting show watch status', async () => {
      const mockError = new Error('Get show watch status failed');
      (showsDb.getWatchStatus as jest.Mock).mockRejectedValue(mockError);

      await expect(
        service.updateShowWatchStatusForNewContent(showId, [{ accountId: 1, profileId: 123 }]),
      ).rejects.toThrow('Get show watch status failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateShowWatchStatusForNewContent(1, profileAccountMappings...)',
      );
    });
  });

  describe('checkAndUpdateShowStatus', () => {
    it('should not update when current status is not WATCHED', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue(WatchStatus.NOT_WATCHED);

      const result = await service.checkAndUpdateShowStatus(1, 1, 100);

      expect(result.status).toEqual(WatchStatus.NOT_WATCHED);
      expect(result.updated).toEqual(false);
    });

    it('should not update when there is no unwatched content', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue(WatchStatus.WATCHED);
      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue([]);

      const result = await service.checkAndUpdateShowStatus(1, 1, 100);

      expect(result.status).toEqual(WatchStatus.WATCHED);
      expect(result.updated).toEqual(false);
    });

    it('should update when there is unwatched content (season)', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue(WatchStatus.WATCHED);
      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue([{ watchStatus: WatchStatus.WATCHING }]);

      const result = await service.checkAndUpdateShowStatus(1, 1, 100);

      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(1, 100, WatchStatus.UP_TO_DATE);
      expect(result.status).toEqual(WatchStatus.UP_TO_DATE);
      expect(result.updated).toEqual(true);
    });

    it('should update when there is unwatched content (episode)', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue(WatchStatus.WATCHED);
      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue([
        { watchStatus: WatchStatus.WATCHED, episodes: [{ watchStatus: WatchStatus.NOT_WATCHED }] },
      ]);

      const result = await service.checkAndUpdateShowStatus(1, 1, 100);

      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith(1, 100, WatchStatus.UP_TO_DATE);
      expect(result.status).toEqual(WatchStatus.UP_TO_DATE);
      expect(result.updated).toEqual(true);
    });
  });
});
