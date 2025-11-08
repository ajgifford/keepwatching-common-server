import {
  mockEpisodes,
  mockProfiles,
  mockSeasons,
  mockShowDetails,
  mockShowId,
  mockWatchProgress,
} from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { adminShowService } from '@services/adminShowService';
import { errorService } from '@services/errorService';
import { type Mock, MockedObject, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('AdminShowService - Complete Show Info', () => {
  let mockCacheService: MockedObject<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (showsDb.getAdminShowDetails as Mock).mockResolvedValue(mockShowDetails);
    (showsDb.getAdminShowProfiles as Mock).mockResolvedValue(mockProfiles);
    (showsDb.getAdminShowWatchProgress as Mock).mockResolvedValue(mockWatchProgress);

    (errorService.handleError as Mock).mockImplementation((err) => {
      throw err;
    });
  });

  describe('getCompleteShowInfo', () => {
    it('should return cached complete show info when available', async () => {
      const mockCompleteInfo = {
        details: mockShowDetails,
        seasons: [{ ...mockSeasons[0], episodes: mockEpisodes }],
        profiles: mockProfiles,
        watchProgress: mockWatchProgress,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockCompleteInfo);

      const result = await adminShowService.getCompleteShowInfo(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockCompleteInfo);
    });

    it('should fetch and build complete show info when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const mockSeasonsWithEpisodes = [
        {
          ...mockSeasons[0],
          episodes: mockEpisodes,
        },
      ];

      (showsDb.getAdminShowSeasonsWithEpisodes as Mock).mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getCompleteShowInfo(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowDetails).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowSeasonsWithEpisodes).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowProfiles).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowWatchProgress).toHaveBeenCalledWith(mockShowId);

      // The method should no longer call getAdminSeasonEpisodes since we're using the optimized method
      expect(showsDb.getAdminSeasonEpisodes).not.toHaveBeenCalled();

      expect(result).toEqual({
        details: mockShowDetails,
        seasons: mockSeasonsWithEpisodes,
        profiles: mockProfiles,
        watchProgress: mockWatchProgress,
      });
    });
  });

  describe('getShowSeasonsWithEpisodes', () => {
    const mockSeasonsWithEpisodes = [
      {
        id: mockSeasons[0].id,
        name: 'Season 1',
        episodes: [
          { id: 101, title: 'Episode 1' },
          { id: 102, title: 'Episode 2' },
        ],
      },
    ];

    it('should return cached seasons with episodes when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getShowSeasonsWithEpisodes(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockSeasonsWithEpisodes);
      expect(showsDb.getAdminShowSeasonsWithEpisodes).not.toHaveBeenCalled();
    });

    it('should fetch seasons with episodes from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      (showsDb.getAdminShowSeasonsWithEpisodes as Mock).mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getShowSeasonsWithEpisodes(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowSeasonsWithEpisodes).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockSeasonsWithEpisodes);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Repository error');
      (showsDb.getAdminShowSeasonsWithEpisodes as Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getShowSeasonsWithEpisodes(mockShowId)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowSeasonsWithEpisodes(${mockShowId})`);
    });
  });
});
