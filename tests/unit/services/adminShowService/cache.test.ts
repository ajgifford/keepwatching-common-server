import { mockShowId } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import { adminShowService } from '@services/adminShowService';

// Mock the repositories and services
jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/socketService');
jest.mock('@services/showService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');
jest.mock('@utils/contentUtility');
jest.mock('@utils/notificationUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  appLogger: {
    error: jest.fn(),
  },
}));

describe('AdminShowService - Cache Management', () => {
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('invalidateShowCache', () => {
    it('should invalidate all cache keys related to a show', () => {
      adminShowService.invalidateShowCache(mockShowId);

      // Check that all cache keys are invalidated, including the new one
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_details'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_seasons'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        expect.stringContaining('admin_show_seasons_with_episodes'),
      );
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_profiles'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_watch_progress'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_complete'));
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(expect.stringContaining('admin_season_episodes'));
    });
  });

  describe('invalidateAllShows', () => {
    it('should invalidate all shows pattern', () => {
      adminShowService.invalidateAllShows();

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('allShows_');
    });
  });
});
