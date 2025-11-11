import { mockShowReferences } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import {
  AdminShowService,
  createAdminShowService,
  resetAdminShowService,
} from '@services/adminShowService';
import { errorService } from '@services/errorService';

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

describe('AdminShowService - Show References', () => {
  let adminShowService: AdminShowService;
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    resetAdminShowService();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    adminShowService = createAdminShowService({ cacheService: mockCacheService as any });

    (errorService.handleError as jest.Mock).mockImplementation((err) => {
      throw err;
    });
  });

  afterEach(() => {
    resetAdminShowService();
    jest.resetModules();
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

      (showsDb.getAllShowReferences as jest.Mock).mockResolvedValue(mockShowReferences);

      const result = await adminShowService.getAllShowReferences();

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAllShowReferences).toHaveBeenCalled();
      expect(result).toEqual(mockShowReferences);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (showsDb.getAllShowReferences as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getAllShowReferences()).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAllShowReferences()');
    });
  });
});
