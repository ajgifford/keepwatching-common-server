import { ContentUpdates } from '../../../src/types/contentTypes';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import { cliLogger } from '@logger/logger';
import { checkSeasonForEpisodeChanges } from '@services/episodeChangesService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { seasonsService } from '@services/seasonsService';
import { getTMDBService } from '@services/tmdbService';
import * as changesUtility from '@utils/changesUtility';

jest.mock('@db/episodesDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/showsDb');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    error: jest.fn(),
  },
}));

jest.mock('@services/episodeChangesService', () => ({
  checkSeasonForEpisodeChanges: jest.fn(),
}));

jest.mock('@services/seasonsService', () => ({
  seasonsService: {
    updateSeasonWatchStatusForNewEpisodes: jest.fn(),
  },
}));

jest.mock('@services/tmdbService');
jest.mock('@utils/changesUtility', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
  filterUniqueSeasonIds: jest.fn(),
}));

describe('seasonChangesService', () => {
  const mockShowContent: ContentUpdates = {
    id: 123,
    title: 'Test Show',
    tmdb_id: 456,
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
  };

  const mockProfileIds = [1, 2];
  const pastDate = '2023-01-01';
  const currentDate = '2023-01-10';

  const mockTMDBService = {
    getSeasonDetails: jest.fn(),
  };

  // Mock change items that will be passed to processSeasonChanges
  const mockChangeItems = [
    {
      id: 'abc123',
      action: 'added',
      time: '2023-01-05',
      iso_639_1: 'en',
      iso_3166_1: 'US',
      value: { season_id: 789 },
      original_value: null,
    },
    {
      id: 'def456',
      action: 'updated',
      time: '2023-01-06',
      iso_639_1: 'en',
      iso_3166_1: 'US',
      value: { season_id: 790 },
      original_value: { season_id: 790 },
    },
  ];

  // Mock response show data
  const mockResponseShow = {
    seasons: [
      {
        id: 789,
        name: 'Season 1',
        overview: 'Season 1 overview',
        season_number: 1,
        air_date: '2023-01-01',
        poster_path: '/path/to/poster1.jpg',
        episode_count: 8,
      },
      {
        id: 790,
        name: 'Season 2',
        overview: 'Season 2 overview',
        season_number: 2,
        air_date: '2023-02-01',
        poster_path: '/path/to/poster2.jpg',
        episode_count: 6,
      },
      {
        id: 999,
        name: 'Specials',
        overview: 'Special episodes',
        season_number: 0, // This should be skipped
        air_date: '2023-01-15',
        poster_path: '/path/to/poster3.jpg',
        episode_count: 2,
      },
    ],
  };

  // Mock season details with episodes
  const mockSeasonDetails = {
    episodes: [
      {
        id: 101,
        name: 'Episode 1',
        overview: 'Episode 1 overview',
        episode_number: 1,
        season_number: 1,
        air_date: '2023-01-01',
        runtime: 30,
        still_path: '/path/to/still1.jpg',
        episode_type: 'standard',
      },
      {
        id: 102,
        name: 'Episode 2',
        overview: 'Episode 2 overview',
        episode_number: 2,
        season_number: 1,
        air_date: '2023-01-08',
        runtime: 30,
        still_path: '/path/to/still2.jpg',
        episode_type: 'standard',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
    (changesUtility.filterUniqueSeasonIds as jest.Mock).mockReturnValue([789, 790]);

    // Setup default mock implementation for createSeason
    (seasonsDb.createSeason as jest.Mock).mockImplementation(
      (showId, tmdbId, name, overview, seasonNumber, releaseDate, posterImage, numberOfEpisodes, id) => ({
        show_id: showId,
        tmdb_id: tmdbId,
        name,
        overview,
        season_number: seasonNumber,
        release_date: releaseDate,
        poster_image: posterImage,
        number_of_episodes: numberOfEpisodes,
        id: id || Math.floor(Math.random() * 1000),
      }),
    );

    // Setup default mock implementation for updateSeason
    (seasonsDb.updateSeason as jest.Mock).mockImplementation((season) => Promise.resolve(season));

    // Setup default mock implementation for saveFavorite for seasons
    (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

    // Setup default mock implementation for episodesDb functions
    (episodesDb.createEpisode as jest.Mock).mockImplementation(
      (
        tmdbId,
        showId,
        seasonId,
        episodeNumber,
        episodeType,
        seasonNumber,
        title,
        overview,
        airDate,
        runtime,
        stillImage,
        id,
      ) => ({
        tmdb_id: tmdbId,
        show_id: showId,
        season_id: seasonId,
        episode_number: episodeNumber,
        episode_type: episodeType,
        season_number: seasonNumber,
        title,
        overview,
        air_date: airDate,
        runtime,
        still_image: stillImage,
        id: id || Math.floor(Math.random() * 1000),
      }),
    );

    (episodesDb.updateEpisode as jest.Mock).mockImplementation((episode) => Promise.resolve(episode));
    (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

    // Setup default mock implementation for season details
    mockTMDBService.getSeasonDetails.mockResolvedValue(mockSeasonDetails);

    // Default for checkSeasonForEpisodeChanges
    (checkSeasonForEpisodeChanges as jest.Mock).mockResolvedValue(true);
  });

  it('should process season changes correctly', async () => {
    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    // Check if filterUniqueSeasonIds was called with the change items
    expect(changesUtility.filterUniqueSeasonIds).toHaveBeenCalledWith(mockChangeItems);

    // Check if seasons were created and updated correctly
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(2);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);

    // Verify season data for first season
    expect(seasonsDb.createSeason).toHaveBeenCalledWith(
      123, // showId
      789, // tmdbId
      'Season 1', // name
      'Season 1 overview', // overview
      1, // seasonNumber
      '2023-01-01', // releaseDate
      '/path/to/poster1.jpg', // posterImage
      8, // numberOfEpisodes
    );

    // Check if seasons were added to profiles' favorites
    expect(seasonsDb.saveFavorite).toHaveBeenCalledTimes(4); // 2 seasons * 2 profiles

    // Check if episode changes were checked
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledWith(789, pastDate, currentDate);
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledWith(790, pastDate, currentDate);

    // Check if season details were fetched
    expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(2);
    expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(456, 1); // tmdbId, seasonNumber
    expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(456, 2);

    // Check if episodes were created and updated
    expect(episodesDb.createEpisode).toHaveBeenCalledTimes(4); // 2 episodes * 2 seasons
    expect(episodesDb.updateEpisode).toHaveBeenCalledTimes(4);

    // Check if episodes were added to profiles' favorites
    expect(episodesDb.saveFavorite).toHaveBeenCalledTimes(8); // 2 episodes * 2 seasons * 2 profiles

    // Check if season watch status was updated
    expect(seasonsService.updateSeasonWatchStatusForNewEpisodes).toHaveBeenCalledTimes(4); // 2 seasons * 2 profiles
  });

  it('should skip specials (season 0)', async () => {
    // Add a specials season to the filter results to ensure it's skipped
    (changesUtility.filterUniqueSeasonIds as jest.Mock).mockReturnValue([789, 790, 999]);

    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    // Should still only process 2 seasons (skipping the specials season)
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(2);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);

    // Verify it's not creating the specials season
    const createSeasonCalls = (seasonsDb.createSeason as jest.Mock).mock.calls;
    const seasonNumbers = createSeasonCalls.map((call) => call[4]); // season_number is the 5th parameter
    expect(seasonNumbers).toContain(1);
    expect(seasonNumbers).toContain(2);
    expect(seasonNumbers).not.toContain(0);
  });

  it('should skip updating episodes if no episode changes are detected', async () => {
    // Set checkSeasonForEpisodeChanges to return false
    (checkSeasonForEpisodeChanges as jest.Mock).mockResolvedValue(false);

    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    // Should still update seasons
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(2);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);

    // Should have checked for episode changes
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);

    // Should not fetch season details or update episodes
    expect(mockTMDBService.getSeasonDetails).not.toHaveBeenCalled();
    expect(episodesDb.createEpisode).not.toHaveBeenCalled();
    expect(episodesDb.updateEpisode).not.toHaveBeenCalled();
    expect(episodesDb.saveFavorite).not.toHaveBeenCalled();
    expect(seasonsService.updateSeasonWatchStatusForNewEpisodes).not.toHaveBeenCalled();
  });

  it('should handle missing season info in the response', async () => {
    // Set up a response with missing season info
    const mockResponseWithMissingSeason = {
      seasons: [
        {
          id: 789,
          name: 'Season 1',
          overview: 'Season 1 overview',
          season_number: 1,
          air_date: '2023-01-01',
          poster_path: '/path/to/poster1.jpg',
          episode_count: 8,
        },
        // Season 790 is missing
      ],
    };

    await processSeasonChanges(
      mockChangeItems,
      mockResponseWithMissingSeason,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    // Should only process the season that exists in the response
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(1);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(1);
    expect(seasonsDb.createSeason).toHaveBeenCalledWith(
      123, // showId
      789, // tmdbId
      'Season 1', // name
      'Season 1 overview', // overview
      1, // seasonNumber
      '2023-01-01', // releaseDate
      '/path/to/poster1.jpg', // posterImage
      8, // numberOfEpisodes
    );
  });

  it('should handle errors when processing a season', async () => {
    (seasonsDb.updateSeason as jest.Mock)
      .mockImplementationOnce(() => Promise.reject(new Error('Database error')))
      .mockImplementation((season) => Promise.resolve(season));

    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    expect(cliLogger.error).toHaveBeenCalledWith(`Error processing season ID 789 for show 123`, expect.any(Error));
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(2);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);
    expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(456, 2);
    const saveFavoriteCalls = (seasonsDb.saveFavorite as jest.Mock).mock.calls;
    expect(saveFavoriteCalls.length).toBeGreaterThan(0);
  });

  it('should handle errors from TMDB API when fetching season details', async () => {
    mockTMDBService.getSeasonDetails
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce(mockSeasonDetails);

    (checkSeasonForEpisodeChanges as jest.Mock).mockResolvedValue(true);

    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    expect(cliLogger.error).toHaveBeenCalledWith(`Error processing season ID 789 for show 123`, expect.any(Error));
    expect(seasonsDb.createSeason).toHaveBeenCalledTimes(2);
    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);
    expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(456, 2);
    const createEpisodeCalls = (episodesDb.createEpisode as jest.Mock).mock.calls;
    expect(createEpisodeCalls.length).toBe(2);
  });

  it('should wait between processing seasons', async () => {
    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
    expect(changesUtility.sleep).toHaveBeenCalledWith(500);
  });

  it('should handle errors from season watch status updates', async () => {
    (seasonsService.updateSeasonWatchStatusForNewEpisodes as jest.Mock).mockRejectedValue(
      new Error('Status update error'),
    );

    await processSeasonChanges(
      mockChangeItems,
      mockResponseShow,
      mockShowContent,
      mockProfileIds,
      pastDate,
      currentDate,
    );

    expect(seasonsDb.updateSeason).toHaveBeenCalledTimes(2);
    expect(episodesDb.updateEpisode).toHaveBeenCalledTimes(4);
    expect(cliLogger.error).toHaveBeenCalledTimes(2);
  });
});
