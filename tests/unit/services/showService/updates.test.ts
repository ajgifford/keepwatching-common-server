import { Change, ContentUpdates } from '../../../../src/types/contentTypes';
import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { appLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { ShowService, showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

describe('ShowService - Content Updates', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('showChangesService', () => {
    const mockShowContent: ContentUpdates = {
      id: 123,
      title: 'Test Show',
      tmdb_id: 456,
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    };

    const pastDate = '2023-01-01';
    const currentDate = '2023-01-10';

    const mockTMDBService = {
      getShowChanges: jest.fn(),
      getShowDetails: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      // Mock utility functions that are used to process show details
      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
      (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      // Default mock implementations
      mockTMDBService.getShowChanges.mockResolvedValue({ changes: [] });
      mockTMDBService.getShowDetails.mockResolvedValue({
        id: 456,
        name: 'Updated Show Title',
        overview: 'New overview',
        first_air_date: '2023-02-01',
        poster_path: '/new-poster.jpg',
        backdrop_path: '/new-backdrop.jpg',
        vote_average: 8.5,
        content_ratings: { results: [] },
        number_of_episodes: 10,
        number_of_seasons: 1,
        genres: [{ id: 28 }, { id: 12 }],
        status: 'Returning Series',
        type: 'Scripted',
        in_production: true,
        last_air_date: '2023-01-15',
        last_episode_to_air: null,
        next_episode_to_air: null,
        networks: [{ origin_country: 'US', name: 'HBO' }],
      });

      (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [
          { accountId: 1, profileId: 1 },
          { accountId: 1, profileId: 2 },
          { accountId: 2, profileId: 3 },
        ],
        totalCount: 3,
      });
    });

    it('should do nothing when no changes are detected', async () => {
      mockTMDBService.getShowChanges.mockResolvedValue({ changes: [] });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
      expect(showsDb.updateShow).not.toHaveBeenCalled();
    });

    it('should do nothing when only unsupported changes are detected', async () => {
      const unsupportedChanges: Change[] = [
        {
          key: 'unsupported_key',
          items: [
            {
              id: 'abc123',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: {},
              original_value: null,
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: unsupportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
      expect(showsDb.updateShow).not.toHaveBeenCalled();
    });

    it('should update show when supported changes are detected', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
    });

    it('should process season changes when season changes are detected', async () => {
      const seasonChanges: Change[] = [
        {
          key: 'season',
          items: [
            {
              id: 'season1',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: { season_id: 101 },
              original_value: null,
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: seasonChanges });
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHING');

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(showsDb.getProfilesForShow).toHaveBeenCalledWith(123);
      expect(processSeasonChanges).toHaveBeenCalledWith(
        seasonChanges[0].items,
        expect.any(Object),
        mockShowContent,
        [
          { accountId: 1, profileId: 1 },
          { accountId: 1, profileId: 2 },
          { accountId: 2, profileId: 3 },
        ],
        pastDate,
        currentDate,
      );
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(1, 1, 123);
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(2, 2, 123);
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(3, 3, 123);
    });

    it('should handle errors from getShowChanges API', async () => {
      const mockError = new Error('API error');
      mockTMDBService.getShowChanges.mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
    });

    it('should handle errors from getShowDetails API', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Show details API error');
      mockTMDBService.getShowDetails.mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
    });

    it('should handle multiple supported changes', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
        {
          key: 'overview',
          items: [
            {
              id: 'def456',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'New overview',
              original_value: 'Old overview',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
    });

    it('should handle empty changes array', async () => {
      mockTMDBService.getShowChanges.mockResolvedValue({});

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
    });

    it('should handle errors from showsDb.updateShow', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Database update error');
      (showsDb.updateShow as jest.Mock).mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
    });
  });

  describe('getShowsForUpdates', () => {
    it('should return shows that need updates', async () => {
      const mockShows = [
        { id: 1, title: 'Show 1', tmdb_id: 101, created_at: '2023-01-01', updated_at: '2023-01-10' },
        { id: 2, title: 'Show 2', tmdb_id: 102, created_at: '2023-02-01', updated_at: '2023-02-10' },
      ];

      (showsDb.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);

      const result = await showService.getShowsForUpdates();

      expect(showsDb.getShowsForUpdates).toHaveBeenCalled();
      expect(result).toEqual(mockShows);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      (showsDb.getShowsForUpdates as jest.Mock).mockRejectedValue(mockError);

      await expect(showService.getShowsForUpdates()).rejects.toThrow('Database error');
      expect(showsDb.getShowsForUpdates).toHaveBeenCalled();
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getShowsForUpdates()');
    });
  });
});
