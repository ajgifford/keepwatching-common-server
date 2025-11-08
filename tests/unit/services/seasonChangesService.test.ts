import { ContentUpdates } from '../../../src/types/contentTypes';
import { TMDBChange, TMDBShow } from '../../../src/types/tmdbTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { cliLogger } from '@logger/logger';
import { checkSeasonForEpisodeChanges } from '@services/episodeChangesService';
import { episodesService } from '@services/episodesService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { seasonsService } from '@services/seasonsService';
import { getTMDBService } from '@services/tmdbService';
import { filterUniqueSeasonIds, sleep } from '@utils/changesUtility';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/episodesService');
vi.mock('@services/seasonsService');
vi.mock('@services/episodeChangesService');
vi.mock('@services/tmdbService');
vi.mock('@utils/changesUtility');
vi.mock('@logger/logger');

describe('processSeasonChanges', () => {
  const mockChanges: TMDBChange = {
    key: 'season',
    items: [
      {
        value: { season_id: 123, season_number: 1 },
        id: '',
        action: 'added',
        time: '',
        iso_639_1: '',
        iso_3166_1: '',
        original_value: undefined,
      },
      {
        value: { season_id: 456, season_number: 2 },
        id: '',
        action: 'added',
        time: '',
        iso_639_1: '',
        iso_3166_1: '',
        original_value: undefined,
      },
    ],
  };

  const mockResponseShow: TMDBShow = {
    backdrop_path: '',
    first_air_date: '',
    genres: [],
    in_production: false,
    last_air_date: '',
    last_episode_to_air: null,
    name: '',
    next_episode_to_air: null,
    networks: [],
    number_of_episodes: 0,
    number_of_seasons: 0,
    overview: '',
    popularity: 0,
    poster_path: '',
    production_companies: [],
    status: '',
    type: '',
    vote_average: 0,
    content_ratings: { results: [{ descriptors: [], iso_3166_1: '', rating: 'TV-13' }] },
    id: 0,
    seasons: [
      {
        id: 123,
        name: 'Season 1',
        overview: 'Season 1 overview',
        season_number: 1,
        air_date: '2024-01-01',
        poster_path: '/path1.jpg',
        episode_count: 10,
        vote_average: 0,
      },
      {
        id: 456,
        name: 'Season 2',
        overview: 'Season 2 overview',
        season_number: 2,
        air_date: '2024-06-01',
        poster_path: '/path2.jpg',
        episode_count: 8,
        vote_average: 0,
      },
      {
        id: 789,
        name: 'Specials',
        overview: 'Specials',
        season_number: 0,
        air_date: '2024-05-01',
        poster_path: '/path3.jpg',
        episode_count: 2,
        vote_average: 0,
      },
    ],
    'watch/providers': {
      results: {
        ['US']: {
          link: '',
          flatrate: [
            {
              display_priority: 0,
              logo_path: '',
              provider_id: 0,
              provider_name: '',
            },
          ],
        },
      },
    },
    credits: {
      cast: [],
    },
    aggregate_credits: {
      cast: [],
    },
  };

  const mockContent: ContentUpdates = {
    id: 100,
    tmdb_id: 12345,
    title: 'Test Show',
    created_at: '',
    updated_at: '',
  };

  const mockProfileAccountMappings = [
    { accountId: 1, profileId: 101 },
    { accountId: 1, profileId: 202 },
  ];

  const mockDates = { pastDate: '2024-01-01', currentDate: '2024-06-01' };

  const mockTmdbService = {
    getSeasonDetails: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (filterUniqueSeasonIds as Mock).mockReturnValue([123, 456, 789]);
    (sleep as Mock).mockResolvedValue(undefined);
    (getTMDBService as Mock).mockReturnValue(mockTmdbService);

    const mockUpdatedSeason = 500;
    (seasonsService.updateSeason as Mock).mockResolvedValue(mockUpdatedSeason);
    (seasonsService.addSeasonToFavorites as Mock).mockResolvedValue(undefined);

    (checkSeasonForEpisodeChanges as Mock).mockResolvedValue(true);

    const mockEpisodeDetails = {
      episodes: [
        {
          id: 1001,
          episode_number: 1,
          episode_type: 'standard',
          season_number: 1,
          name: 'Episode 1',
          overview: 'Overview',
          air_date: '2024-01-01',
          runtime: 45,
          still_path: '/still1.jpg',
        },
        {
          id: 1002,
          episode_number: 2,
          episode_type: 'standard',
          season_number: 1,
          name: 'Episode 2',
          overview: 'Overview',
          air_date: '2024-01-08',
          runtime: 42,
          still_path: '/still2.jpg',
        },
      ],
    };
    mockTmdbService.getSeasonDetails.mockResolvedValue(mockEpisodeDetails);

    const mockUpdatedEpisode = { id: 2000 };
    (episodesService.updateEpisode as Mock).mockResolvedValue(mockUpdatedEpisode);
    (episodesService.addEpisodeToFavorites as Mock).mockResolvedValue(undefined);
  });

  it('should process season changes correctly', async () => {
    await processSeasonChanges(
      mockChanges,
      mockResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(getTMDBService).toHaveBeenCalled();
    expect(filterUniqueSeasonIds).toHaveBeenCalledWith(mockChanges);
    expect(sleep).toHaveBeenCalledTimes(3); // One call for each season ID
    expect(seasonsService.updateSeason).toHaveBeenCalledTimes(2); // Should not process season 0
    expect(seasonsService.updateSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        show_id: 100,
        tmdb_id: 123,
        name: 'Season 1',
      }),
    );

    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledTimes(4); // 2 seasons × 2 profiles
    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledWith(101, 500, WatchStatus.NOT_WATCHED);
    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledWith(202, 500, WatchStatus.NOT_WATCHED);
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    expect(mockTmdbService.getSeasonDetails).toHaveBeenCalledTimes(2);
    expect(episodesService.updateEpisode).toHaveBeenCalledTimes(4); // 2 episodes × 2 seasons
    expect(episodesService.addEpisodeToFavorites).toHaveBeenCalledTimes(8); // 2 episodes × 2 seasons × 2 profiles
  });

  it('should skip seasons with number 0 (specials)', async () => {
    (filterUniqueSeasonIds as Mock).mockReturnValue([789]);

    await processSeasonChanges(
      mockChanges,
      mockResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(sleep).toHaveBeenCalledTimes(1); // Called once for the one season
    expect(seasonsService.updateSeason).not.toHaveBeenCalled(); // Should not process season 0
    expect(seasonsService.addSeasonToFavorites).not.toHaveBeenCalled();
    expect(checkSeasonForEpisodeChanges).not.toHaveBeenCalled();
  });

  it('should continue processing other seasons when one fails', async () => {
    (seasonsService.updateSeason as Mock).mockImplementation((seasonData) => {
      if (seasonData.tmdb_id === 123) {
        throw new Error('Test error');
      }
      return 501;
    });

    await processSeasonChanges(
      mockChanges,
      mockResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(cliLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing season ID 123'),
      expect.any(Error),
    );

    expect(seasonsService.updateSeason).toHaveBeenCalledTimes(2);
    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledTimes(2); // Only for season 2
  });

  it('should not fetch episode details when no episode changes found', async () => {
    (checkSeasonForEpisodeChanges as Mock).mockResolvedValue(false);

    // Create a show with future air dates so seasonHasAired will be false
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateString = futureDate.toISOString().split('T')[0];

    const futureResponseShow = {
      ...mockResponseShow,
      seasons: [
        {
          ...mockResponseShow.seasons[0],
          air_date: futureDateString,
        },
        {
          ...mockResponseShow.seasons[1],
          air_date: futureDateString,
        },
        {
          ...mockResponseShow.seasons[2],
          air_date: futureDateString,
        },
      ],
    };

    await processSeasonChanges(
      mockChanges,
      futureResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    expect(mockTmdbService.getSeasonDetails).not.toHaveBeenCalled();
    expect(episodesService.updateEpisode).not.toHaveBeenCalled();
    expect(episodesService.addEpisodeToFavorites).not.toHaveBeenCalled();
  });

  it('should fetch episode details when season has aired even if no episode changes found', async () => {
    (checkSeasonForEpisodeChanges as Mock).mockResolvedValue(false);

    // Use a show with past air dates (default mockResponseShow has aired dates)
    await processSeasonChanges(
      mockChanges,
      mockResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    // Should fetch episodes because seasons have aired, even though no changes detected
    expect(mockTmdbService.getSeasonDetails).toHaveBeenCalledTimes(2);
    expect(mockTmdbService.getSeasonDetails).toHaveBeenCalledWith(12345, 1);
    expect(mockTmdbService.getSeasonDetails).toHaveBeenCalledWith(12345, 2);
    expect(episodesService.updateEpisode).toHaveBeenCalledTimes(4); // 2 episodes × 2 seasons
    expect(episodesService.addEpisodeToFavorites).toHaveBeenCalledTimes(8); // 2 episodes × 2 seasons × 2 profiles
  });
});
