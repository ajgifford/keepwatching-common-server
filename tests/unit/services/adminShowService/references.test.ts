import { mockShowReferences } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import {
  AdminShowService,
  createAdminShowService,
  resetAdminShowService,
} from '@services/adminShowService';
import { errorService } from '@services/errorService';
import { type Mock, MockedObject, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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

describe('AdminShowService - Show References', () => {
  let adminShowService: AdminShowService;
  let mockCacheService: MockedObject<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    resetAdminShowService();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    adminShowService = createAdminShowService({ cacheService: mockCacheService as any });

    (errorService.handleError as Mock).mockImplementation((err) => {
      throw err;
    });
  });

  afterEach(() => {
    resetAdminShowService();
    vi.resetModules();
  });

  describe('getAllShowReferences', () => {
    it('should return cached show references when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockShowReferences);

      const result = await adminShowService.getAllShowReferences();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allShowReferences', expect.any(Function));
      expect(result).toEqual(mockShowReferences);
      expect(showsDb.getAllShowReferences).not.toHaveBeenCalled();
    });

    it('should fetch show references from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      (showsDb.getAllShowReferences as Mock).mockResolvedValue(mockShowReferences);

      const result = await adminShowService.getAllShowReferences();

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAllShowReferences).toHaveBeenCalled();
      expect(result).toEqual(mockShowReferences);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (showsDb.getAllShowReferences as Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getAllShowReferences()).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAllShowReferences()');
    });
  });
});
