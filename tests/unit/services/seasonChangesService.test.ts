import { ChangeItem, ContentUpdates } from '../../../src/types/contentTypes';
import { cliLogger } from '@logger/logger';
import { checkSeasonForEpisodeChanges } from '@services/episodeChangesService';
import { episodesService } from '@services/episodesService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { seasonsService } from '@services/seasonsService';
import { getTMDBService } from '@services/tmdbService';
import { filterUniqueSeasonIds, sleep } from '@utils/changesUtility';

jest.mock('@services/episodesService');
jest.mock('@services/seasonsService');
jest.mock('@services/episodeChangesService');
jest.mock('@services/tmdbService');
jest.mock('@utils/changesUtility');
jest.mock('@logger/logger');

describe('processSeasonChanges', () => {
  const mockChanges: ChangeItem[] = [
    {
      value: { season_id: 123 },
      id: '',
      action: '',
      time: '',
      iso_639_1: '',
      iso_3166_1: '',
      original_value: undefined,
    },
    {
      value: { season_id: 456 },
      id: '',
      action: '',
      time: '',
      iso_639_1: '',
      iso_3166_1: '',
      original_value: undefined,
    },
  ];
  const mockResponseShow = {
    seasons: [
      {
        id: 123,
        name: 'Season 1',
        overview: 'Season 1 overview',
        season_number: 1,
        air_date: '2024-01-01',
        poster_path: '/path1.jpg',
        episode_count: 10,
      },
      {
        id: 456,
        name: 'Season 2',
        overview: 'Season 2 overview',
        season_number: 2,
        air_date: '2024-06-01',
        poster_path: '/path2.jpg',
        episode_count: 8,
      },
      {
        id: 789,
        name: 'Specials',
        overview: 'Specials',
        season_number: 0,
        air_date: '2024-05-01',
        poster_path: '/path3.jpg',
        episode_count: 2,
      },
    ],
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
    getSeasonDetails: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (filterUniqueSeasonIds as jest.Mock).mockReturnValue([123, 456, 789]);
    (sleep as jest.Mock).mockResolvedValue(undefined);
    (getTMDBService as jest.Mock).mockReturnValue(mockTmdbService);

    const mockUpdatedSeason = 500;
    (seasonsService.updateSeason as jest.Mock).mockResolvedValue(mockUpdatedSeason);
    (seasonsService.addSeasonToFavorites as jest.Mock).mockResolvedValue(undefined);

    (checkSeasonForEpisodeChanges as jest.Mock).mockResolvedValue(true);

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
    (episodesService.updateEpisode as jest.Mock).mockResolvedValue(mockUpdatedEpisode);
    (episodesService.addEpisodeToFavorites as jest.Mock).mockResolvedValue(undefined);

    (seasonsService.updateSeasonWatchStatusForNewEpisodes as jest.Mock).mockResolvedValue(undefined);
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
    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledWith(101, 500);
    expect(seasonsService.addSeasonToFavorites).toHaveBeenCalledWith(202, 500);
    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    expect(mockTmdbService.getSeasonDetails).toHaveBeenCalledTimes(2);
    expect(episodesService.updateEpisode).toHaveBeenCalledTimes(4); // 2 episodes × 2 seasons
    expect(episodesService.addEpisodeToFavorites).toHaveBeenCalledTimes(8); // 2 episodes × 2 seasons × 2 profiles
    expect(seasonsService.updateSeasonWatchStatusForNewEpisodes).toHaveBeenCalledTimes(4); // 2 seasons × 2 profiles
  });

  it('should skip seasons with number 0 (specials)', async () => {
    (filterUniqueSeasonIds as jest.Mock).mockReturnValue([789]);

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
    (seasonsService.updateSeason as jest.Mock).mockImplementation((seasonData) => {
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
    (checkSeasonForEpisodeChanges as jest.Mock).mockResolvedValue(false);

    await processSeasonChanges(
      mockChanges,
      mockResponseShow,
      mockContent,
      mockProfileAccountMappings,
      mockDates.pastDate,
      mockDates.currentDate,
    );

    expect(checkSeasonForEpisodeChanges).toHaveBeenCalledTimes(2);
    expect(mockTmdbService.getSeasonDetails).not.toHaveBeenCalled();
    expect(episodesService.updateEpisode).not.toHaveBeenCalled();
    expect(episodesService.addEpisodeToFavorites).not.toHaveBeenCalled();
    expect(seasonsService.updateSeasonWatchStatusForNewEpisodes).not.toHaveBeenCalled();
  });
});
