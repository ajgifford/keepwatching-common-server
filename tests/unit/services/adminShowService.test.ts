import * as showsDb from '@db/showsDb';
import { adminShowService } from '@services/adminShowService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';

// Mock the repositories and services
jest.mock('@db/showsDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');

describe('AdminShowService', () => {
  let mockCacheService: jest.Mocked<any>;

  const mockShowId = 123;
  const mockSeasonId = 456;
  const mockShowDetails = { id: mockShowId, title: 'Test Show', tmdbId: 999 };
  const mockSeasons = [{ id: mockSeasonId, name: 'Season 1', seasonNumber: 1 }];
  const mockEpisodes = [{ id: 789, title: 'Episode 1', episodeNumber: 1 }];
  const mockProfiles = [{ profileId: 101, name: 'Test User', watchStatus: 'WATCHING' }];
  const mockWatchProgress = [
    {
      profileId: 101,
      name: 'Test User',
      totalEpisodes: 10,
      watchedEpisodes: 5,
      percentComplete: 50,
    },
  ];

  beforeEach(() => {
    mockCacheService = {
      getOrSet: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
    };

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

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

      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue(mockSeasonsWithEpisodes);

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
        id: mockSeasonId,
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

      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getShowSeasonsWithEpisodes(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowSeasonsWithEpisodes).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockSeasonsWithEpisodes);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Repository error');
      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getShowSeasonsWithEpisodes(mockShowId)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowSeasonsWithEpisodes(${mockShowId})`);
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
});
