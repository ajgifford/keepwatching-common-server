import { mockShows } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { adminShowService } from '@services/adminShowService';
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

describe('AdminShowService - Pagination', () => {
  let mockCacheService: jest.Mocked<any>;

  const mockPaginationResult = {
    shows: mockShows,
    pagination: {
      totalCount: 10,
      totalPages: 5,
      currentPage: 1,
      limit: 2,
      hasNextPage: true,
      hasPrevPage: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    // Set up default mocks
    (showsDb.getAllShows as jest.Mock).mockResolvedValue(mockShows);
    (showsDb.getShowsCount as jest.Mock).mockResolvedValue(10);
  });

  describe('getAllShows', () => {
    it('should return shows with pagination from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await adminShowService.getAllShows(1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allShows_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
      expect(showsDb.getAllShows).not.toHaveBeenCalled();
      expect(showsDb.getShowsCount).not.toHaveBeenCalled();
    });

    it('should fetch shows with pagination from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

      const result = await adminShowService.getAllShows(1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowsCount).toHaveBeenCalled();
      expect(showsDb.getAllShows).toHaveBeenCalledWith(2, 0);

      expect(result).toEqual({
        shows: mockShows,
        pagination: {
          totalCount: 10,
          totalPages: 5,
          currentPage: 1,
          limit: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should calculate pagination correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(21);

      const result = await adminShowService.getAllShows(2, 5, 5);

      expect(result.pagination).toEqual({
        totalCount: 21,
        totalPages: 5, // 21 / 5 = 4.2, ceil = 5
        currentPage: 2,
        limit: 5,
        hasNextPage: true, // currentPage 2 < totalPages 5
        hasPrevPage: true, // currentPage 2 > 1
      });
    });

    it('should handle pagination for the last page correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(20);

      const result = await adminShowService.getAllShows(4, 15, 5);

      expect(result.pagination).toEqual({
        totalCount: 20,
        totalPages: 4, // 20 / 5 = 4
        currentPage: 4,
        limit: 5,
        hasNextPage: false, // currentPage 4 = totalPages 4
        hasPrevPage: true, // currentPage 4 > 1
      });
    });

    it('should handle edge case with zero shows', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(0);
      (showsDb.getAllShows as jest.Mock).mockResolvedValue([]);

      const result = await adminShowService.getAllShows(1, 0, 10);

      expect(result).toEqual({
        shows: [],
        pagination: {
          totalCount: 0,
          totalPages: 0,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should handle different pagination parameters', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(100);

      await adminShowService.getAllShows(3, 40, 20);

      expect(showsDb.getAllShows).toHaveBeenCalledWith(20, 40);
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allShows_3_40_20', expect.any(Function));
    });
  });

  describe('getAllShowsByProfile', () => {
    const mockProfileId = 101;

    beforeEach(() => {
      (showsDb.getAllShowsByProfile as jest.Mock).mockResolvedValue(mockShows);
      (showsDb.getShowsCountByProfile as jest.Mock).mockResolvedValue(10);
    });

    it('should return shows with pagination from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await adminShowService.getAllShowsByProfile(mockProfileId, 1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `allShowsByProfile_${mockProfileId}_1_0_2`,
        expect.any(Function),
      );
      expect(result).toEqual(mockPaginationResult);
      expect(showsDb.getAllShowsByProfile).not.toHaveBeenCalled();
      expect(showsDb.getShowsCountByProfile).not.toHaveBeenCalled();
    });

    it('should fetch shows with pagination from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

      const result = await adminShowService.getAllShowsByProfile(mockProfileId, 1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowsCountByProfile).toHaveBeenCalledWith(mockProfileId);
      expect(showsDb.getAllShowsByProfile).toHaveBeenCalledWith(mockProfileId, 2, 0);

      expect(result).toEqual({
        shows: mockShows,
        pagination: {
          totalCount: 10,
          totalPages: 5,
          currentPage: 1,
          limit: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (showsDb.getShowsCountByProfile as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getAllShowsByProfile(mockProfileId, 1, 0, 2)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getAllShowsByProfile(${mockProfileId}, 1, 0, 2)`);
    });
  });
});
