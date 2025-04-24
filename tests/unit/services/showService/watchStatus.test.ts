import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Watch Status', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

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

      const result = await service.updateShowWatchStatus('123', 1, 'WATCHED');

      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('123', 1, 'WATCHED');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_shows');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_unwatched_episodes');
      expect(result).toBe(true);
    });

    it('should update all watch statuses recursively when requested', async () => {
      (showsDb.updateAllWatchStatuses as jest.Mock).mockResolvedValue(true);

      const result = await service.updateShowWatchStatus('123', 1, 'WATCHED', true);

      expect(showsDb.updateAllWatchStatuses).toHaveBeenCalledWith('123', 1, 'WATCHED');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_shows');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_unwatched_episodes');
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);

      await expect(service.updateShowWatchStatus('123', 1, 'WATCHED')).rejects.toThrow(BadRequestError);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('123', 1, 'WATCHED');
    });
  });

  describe('updateShowWatchStatusForNewContent', () => {
    it('should update show status from WATCHED to WATCHING for profiles with new content', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');

      await service.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('1', 123, 'UP_TO_DATE');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('2', 123, 'UP_TO_DATE');
    });

    it('should not update show status if already set to something other than WATCHED', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHING');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('NOT_WATCHED');

      await service.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when getting show watch status', async () => {
      const mockError = new Error('Get show watch status failed');
      (showsDb.getWatchStatus as jest.Mock).mockRejectedValue(mockError);

      await expect(service.updateShowWatchStatusForNewContent(123, [1])).rejects.toThrow(
        'Get show watch status failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'updateShowWatchStatusForNewContent(123)');
    });
  });
});
