import { Change, ContentUpdates } from '../../../src/types/contentTypes';
import * as showsDb from '@db/showsDb';
import { cliLogger, httpLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { processSeasonChanges } from '@services/seasonChangesService';
import { checkForShowChanges } from '@services/showChangesService';
import { showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    error: jest.fn(),
  },
  httpLogger: {
    error: jest.fn(),
  },
}));

jest.mock('@db/showsDb');
jest.mock('@services/seasonChangesService');
jest.mock('@services/showService');
jest.mock('@services/tmdbService');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');

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
    (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1, 2, 3]);
    (showsDb.createShow as jest.Mock).mockImplementation((...args) => ({
      id: 123,
      tmdb_id: args[0],
      title: args[1],
      description: args[2],
      release_date: args[3],
      poster_image: args[4],
      backdrop_image: args[5],
      user_rating: args[6],
      content_rating: args[7],
      season_count: args[10],
      episode_count: args[11],
      genreIds: args[12],
      status: args[13],
      type: args[14],
      in_production: args[15],
      last_air_date: args[16],
      last_episode_to_air: args[17],
      next_episode_to_air: args[18],
      network: args[19],
    }));
  });

  it('should do nothing when no changes are detected', async () => {
    mockTMDBService.getShowChanges.mockResolvedValue({ changes: [] });

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
    expect(showsDb.createShow).not.toHaveBeenCalled();
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

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
    expect(showsDb.createShow).not.toHaveBeenCalled();
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

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
    expect(showsDb.createShow).toHaveBeenCalledWith(
      456,
      'Updated Show Title',
      'New overview',
      '2023-02-01',
      '/new-poster.jpg',
      '/new-backdrop.jpg',
      8.5,
      'TV-14',
      123,
      [8, 9],
      10,
      1,
      [28, 12],
      'Returning Series',
      'Scripted',
      1,
      '2023-01-15',
      null,
      null,
      'HBO',
    );
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

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
    expect(showsDb.updateShow).toHaveBeenCalled();
    expect(showsDb.getProfilesForShow).toHaveBeenCalledWith(123);
    expect(processSeasonChanges).toHaveBeenCalledWith(
      seasonChanges[0].items,
      expect.any(Object),
      mockShowContent,
      [1, 2, 3],
      pastDate,
      currentDate,
    );
    expect(showService.updateShowWatchStatusForNewContent).toHaveBeenCalledWith(123, [1, 2, 3]);
  });

  it('should handle errors from getShowChanges API', async () => {
    const mockError = new Error('API error');
    mockTMDBService.getShowChanges.mockRejectedValue(mockError);

    await expect(checkForShowChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for show ID ${mockShowContent.id}`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
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

    await expect(checkForShowChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for show ID ${mockShowContent.id}`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
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

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
    expect(showsDb.createShow).toHaveBeenCalledTimes(1);
    expect(showsDb.updateShow).toHaveBeenCalled();
  });

  it('should handle empty changes array', async () => {
    mockTMDBService.getShowChanges.mockResolvedValue({});

    await checkForShowChanges(mockShowContent, pastDate, currentDate);

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
    expect(showsDb.createShow).not.toHaveBeenCalled();
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

    await expect(checkForShowChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

    expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
    expect(showsDb.updateShow).toHaveBeenCalled();
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for show ID ${mockShowContent.id}`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
      error: mockError,
      showId: mockShowContent.id,
    });
  });
});
