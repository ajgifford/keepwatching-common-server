import { mockShowId } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import { adminShowService } from '@services/adminShowService';
import { MockedObject, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the repositories and services
vi.mock('@db/showsDb');
vi.mock('@db/seasonsDb');
vi.mock('@db/episodesDb');
vi.mock('@services/cacheService');
vi.mock('@services/errorService');
vi.mock('@services/socketService');
vi.mock('@services/showService');
vi.mock('@services/tmdbService');
vi.mock('@utils/db');
vi.mock('@utils/contentUtility');
vi.mock('@utils/notificationUtility');
vi.mock('@utils/watchProvidersUtility');
vi.mock('@logger/logger', () => ({
  cliLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  appLogger: {
    error: vi.fn(),
  },
}));

describe('AdminShowService - Cache Management', () => {
  let mockCacheService: MockedObject<any>;

  beforeEach(() => {
    vi.clearAllMocks();

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
