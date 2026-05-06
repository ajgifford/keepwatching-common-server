import { SummaryCounts } from '@ajgifford/keepwatching-types';
import { ADMIN_KEYS } from '@constants/cacheKeys';
import * as summaryDb from '@db/summaryDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import {
  SummaryService,
  createSummaryService,
  getSummaryService,
  resetSummaryService,
  summaryService,
} from '@services/summaryService';

jest.mock('@db/summaryDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');

describe('SummaryService', () => {
  let service: SummaryService;
  let mockCacheService: jest.Mocked<Pick<CacheService, 'getOrSet'>>;

  const mockSummaryCounts: SummaryCounts = {
    accounts: 10,
    profiles: 25,
    shows: 100,
    seasons: 400,
    episodes: 5000,
    movies: 50,
    people: 200,
    favoritedShows: 80,
    favoritedMovies: 30,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetSummaryService();

    mockCacheService = {
      getOrSet: jest.fn(),
    } as unknown as jest.Mocked<Pick<CacheService, 'getOrSet'>>;

    service = createSummaryService({ cacheService: mockCacheService as unknown as CacheService });
  });

  afterEach(() => {
    resetSummaryService();
    jest.resetModules();
  });

  describe('getSummaryCounts', () => {
    it('should call cache.getOrSet with the correct key', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSummaryCounts);

      await service.getSummaryCounts();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(ADMIN_KEYS.summaryCounts(), expect.any(Function));
    });

    it('should return the value from cache on a cache hit', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSummaryCounts);

      const result = await service.getSummaryCounts();

      expect(result).toEqual(mockSummaryCounts);
      expect(summaryDb.getSummaryCounts).not.toHaveBeenCalled();
    });

    it('should fetch from DB via cache factory on a cache miss', async () => {
      (summaryDb.getSummaryCounts as jest.Mock).mockResolvedValue(mockSummaryCounts);
      mockCacheService.getOrSet.mockImplementation(async (_key, factory) => {
        return factory();
      });

      const result = await service.getSummaryCounts();

      expect(summaryDb.getSummaryCounts).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSummaryCounts);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('Cache unavailable');
      mockCacheService.getOrSet.mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.getSummaryCounts()).rejects.toThrow('Handled: Cache unavailable');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getSummaryCounts()');
    });

    it('should handle DB errors thrown from cache factory', async () => {
      const mockError = new Error('DB query failed');
      (summaryDb.getSummaryCounts as jest.Mock).mockRejectedValue(mockError);
      mockCacheService.getOrSet.mockImplementation(async (_key, factory) => {
        return factory();
      });

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.getSummaryCounts()).rejects.toThrow('Handled: DB query failed');
    });
  });

  describe('createSummaryService', () => {
    it('should create a new SummaryService instance with injected dependencies', () => {
      const newService = createSummaryService({ cacheService: mockCacheService as unknown as CacheService });
      expect(newService).toBeInstanceOf(SummaryService);
    });

    it('should create a new SummaryService instance without dependencies', () => {
      const newService = createSummaryService();
      expect(newService).toBeInstanceOf(SummaryService);
    });
  });

  describe('singleton management', () => {
    it('should export a SummaryService singleton instance', () => {
      expect(summaryService).toBeInstanceOf(SummaryService);
    });

    it('should return the same instance from getSummaryService on repeated calls', () => {
      const instance1 = getSummaryService();
      const instance2 = getSummaryService();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after resetSummaryService', () => {
      const instance1 = getSummaryService();
      resetSummaryService();
      const instance2 = getSummaryService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
