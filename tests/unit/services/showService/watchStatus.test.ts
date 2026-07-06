import { mockNextUnwatchedEpisodes } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { appLogger } from '@logger/logger';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, createShowService, resetShowService } from '@services/showService';
import { watchStatusService } from '@services/watchStatusService';

describe('ShowService - Watch Status', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  const accountId = 1;
  const profileId = 123;
  const showId = 1;
  const status = WatchStatus.WATCHED;

  beforeEach(() => {
    setupMocks();
    resetShowService();
    mockCache = createMockCache();

    service = createShowService({ cacheService: mockCache });
  });

  afterEach(() => {
    resetShowService();
  });

  describe('updateShowWatchStatus', () => {
    it('should update watch status successfully', async () => {
      (watchStatusService.updateShowWatchStatus as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Show test message',
        affectedRows: 1,
        changes: [{}, {}],
      });

      mockCache.getOrSet.mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.updateShowWatchStatus(accountId, profileId, showId, status);

      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(result.nextUnwatchedEpisodes).toEqual(mockNextUnwatchedEpisodes);

      expect(appLogger.info).toHaveBeenCalledWith(`Show ${showId} update: Show test message`);
      expect(appLogger.info).toHaveBeenCalledWith(`Affected entities: 2`);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      (watchStatusService.updateShowWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.updateShowWatchStatus(accountId, profileId, showId, status)).rejects.toThrow(
        'Handled: Database error',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateShowWatchStatus(${accountId}, ${profileId}, ${showId}, ${status})`,
      );
    });

    it('should always invalidate cache on success (no early-return branch)', async () => {
      (watchStatusService.updateShowWatchStatus as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Show test message',
        affectedRows: 1,
        changes: [{}],
      });
      mockCache.getOrSet.mockResolvedValue(mockNextUnwatchedEpisodes);

      await service.updateShowWatchStatus(accountId, profileId, showId, status);

      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
    });
  });

  describe('checkAndUpdateShowStatus (per-profile recalculation for new content)', () => {
    it('should await every profile recalculation before resolving', async () => {
      const profileAccountMappings = [
        { profileId: 1, accountId: 10 },
        { profileId: 2, accountId: 20 },
        { profileId: 3, accountId: 30 },
      ];

      let resolveSlowCheck: () => void;
      const slowCheck = new Promise<any>((resolve) => {
        resolveSlowCheck = () => resolve({ success: true, changes: [], affectedRows: 0, message: 'ok' });
      });

      (watchStatusService.checkAndUpdateShowStatus as jest.Mock)
        .mockResolvedValueOnce({ success: true, changes: [], affectedRows: 0, message: 'ok' })
        .mockImplementationOnce(() => slowCheck)
        .mockResolvedValueOnce({ success: true, changes: [], affectedRows: 0, message: 'ok' });

      let settled = false;
      const promise = service.checkAndUpdateShowStatus(showId, profileAccountMappings).then(() => {
        settled = true;
      });

      // Give the fast-resolving mocks a chance to settle; the slow one still hasn't.
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      resolveSlowCheck!();
      await promise;

      expect(settled).toBe(true);
      expect(watchStatusService.checkAndUpdateShowStatus).toHaveBeenCalledTimes(3);
      expect(watchStatusService.checkAndUpdateShowStatus).toHaveBeenCalledWith(10, 1, showId);
      expect(watchStatusService.checkAndUpdateShowStatus).toHaveBeenCalledWith(20, 2, showId);
      expect(watchStatusService.checkAndUpdateShowStatus).toHaveBeenCalledWith(30, 3, showId);
    });

    it('should propagate an error via errorService when a profile recalculation fails', async () => {
      const profileAccountMappings = [{ profileId: 1, accountId: 10 }];
      const mockError = new Error('Recalculation failed');

      (watchStatusService.checkAndUpdateShowStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.checkAndUpdateShowStatus(showId, profileAccountMappings)).rejects.toThrow(
        'Handled: Recalculation failed',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateShowWatchStatusForNewContent(${showId}, profileAccountMappings...)`,
      );
    });
  });
});
