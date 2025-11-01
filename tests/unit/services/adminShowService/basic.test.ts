import {
  mockEpisodes,
  mockProfiles,
  mockSeasonId,
  mockSeasons,
  mockShowDetails,
  mockShowId,
  mockWatchProgress,
} from './helpers/fixtures';
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

describe('AdminShowService - Basic Operations', () => {
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue(mockShowDetails);
    (showsDb.getAdminShowSeasons as jest.Mock).mockResolvedValue(mockSeasons);
    (showsDb.getAdminSeasonEpisodes as jest.Mock).mockResolvedValue(mockEpisodes);
    (showsDb.getAdminShowProfiles as jest.Mock).mockResolvedValue(mockProfiles);
    (showsDb.getAdminShowWatchProgress as jest.Mock).mockResolvedValue(mockWatchProgress);
    (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue([
      { ...mockSeasons[0], episodes: mockEpisodes },
    ]);

    (errorService.handleError as jest.Mock).mockImplementation((err) => {
      throw err;
    });
  });

  describe('getShowDetails', () => {
    it('should return cached show details when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockShowDetails);

      const result = await adminShowService.getShowDetails(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockShowDetails);
      expect(showsDb.getAdminShowDetails).not.toHaveBeenCalled();
    });

    it('should fetch show details from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowDetails(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowDetails).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockShowDetails);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Repository error');
      (showsDb.getAdminShowDetails as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getShowDetails(mockShowId)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowDetails(${mockShowId})`);
    });
  });

  describe('getShowSeasons', () => {
    it('should return cached seasons when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSeasons);

      const result = await adminShowService.getShowSeasons(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockSeasons);
      expect(showsDb.getAdminShowSeasons).not.toHaveBeenCalled();
    });

    it('should fetch seasons from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowSeasons(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowSeasons).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockSeasons);
    });
  });

  describe('getSeasonEpisodes', () => {
    it('should return cached episodes when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockEpisodes);

      const result = await adminShowService.getSeasonEpisodes(mockSeasonId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockEpisodes);
      expect(showsDb.getAdminSeasonEpisodes).not.toHaveBeenCalled();
    });

    it('should fetch episodes from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getSeasonEpisodes(mockSeasonId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminSeasonEpisodes).toHaveBeenCalledWith(mockSeasonId);
      expect(result).toEqual(mockEpisodes);
    });
  });

  describe('getShowProfiles', () => {
    it('should return cached profiles when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockProfiles);

      const result = await adminShowService.getShowProfiles(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockProfiles);
      expect(showsDb.getAdminShowProfiles).not.toHaveBeenCalled();
    });

    it('should fetch profiles from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowProfiles(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowProfiles).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('getShowWatchProgress', () => {
    it('should return cached watch progress when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockWatchProgress);

      const result = await adminShowService.getShowWatchProgress(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockWatchProgress);
      expect(showsDb.getAdminShowWatchProgress).not.toHaveBeenCalled();
    });

    it('should fetch watch progress from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowWatchProgress(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowWatchProgress).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockWatchProgress);
    });
  });
});
