import { mockNextUnwatchedEpisodes } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { appLogger } from '@logger/logger';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
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
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
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
      expect(result).toEqual(mockNextUnwatchedEpisodes);

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
  });
});
