import { setupDatabaseTest } from '../helpers/dbTestSetup';
import * as showsDb from '@db/showsDb';

describe('profileShowRepository', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('getAllShowsForProfile', () => {
    it('should return shows for a profile', async () => {
      const mockShows = [
        {
          show_id: 1,
          title: 'Show 1',
          watch_status: 'WATCHED',
          last_episode_title: 'Last Episode',
          last_episode_air_date: '2023-01-01',
          last_episode_number: 10,
          last_episode_season: 1,
          next_episode_title: 'Next Episode',
          next_episode_air_date: '2023-01-08',
          next_episode_number: 11,
          next_episode_season: 1,
        },
        {
          show_id: 2,
          title: 'Show 2',
          watch_status: 'WATCHING',
          last_episode_title: null,
          last_episode_air_date: null,
          last_episode_number: null,
          last_episode_season: null,
          next_episode_title: null,
          next_episode_air_date: null,
          next_episode_number: null,
          next_episode_season: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockShows]);

      const shows = await showsDb.getAllShowsForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
      expect(shows).toHaveLength(2);
      expect(shows[0].title).toBe('Show 1');
      expect(shows[0].lastEpisode).toEqual({
        title: 'Last Episode',
        airDate: '2023-01-01',
        episodeNumber: 10,
        seasonNumber: 1,
      });
      expect(shows[1].lastEpisode).toBeNull();
    });

    it('should handle empty result set', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const shows = await showsDb.getAllShowsForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
      expect(shows).toHaveLength(0);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(showsDb.getAllShowsForProfile(123)).rejects.toThrow('Database connection failed');
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
    });
  });

  describe('getShowForProfile', () => {
    it('should return a show for a profile', async () => {
      const mockShow = {
        show_id: 1,
        title: 'Show 1',
        watch_status: 'WATCHED',
        last_episode_title: 'Last Episode',
        last_episode_air_date: '2023-01-01',
        last_episode_number: 10,
        last_episode_season: 1,
        next_episode_title: 'Next Episode',
        next_episode_air_date: '2023-01-08',
        next_episode_number: 11,
        next_episode_season: 1,
      };

      mockExecute.mockResolvedValueOnce([[mockShow]]);

      const show = await showsDb.getShowForProfile(123, 1);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?',
        [123, 1],
      );
      expect(show.title).toBe('Show 1');
      expect(show.lastEpisode).toEqual({
        title: 'Last Episode',
        airDate: '2023-01-01',
        episodeNumber: 10,
        seasonNumber: 1,
      });
      expect(show.nextEpisode).toEqual({
        title: 'Next Episode',
        airDate: '2023-01-08',
        episodeNumber: 11,
        seasonNumber: 1,
      });
    });

    it('should throw error when show does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await expect(showsDb.getShowForProfile(123, 999)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?',
        [123, 999],
      );
    });
  });

  describe('getShowForProfileByChild', () => {
    const mockShow = {
      show_id: 1,
      title: 'Show 1',
      watch_status: 'WATCHED',
      last_episode_title: 'Last Episode',
      last_episode_air_date: '2023-01-01',
      last_episode_number: 10,
      last_episode_season: 1,
      next_episode_title: 'Next Episode',
      next_episode_air_date: '2023-01-08',
      next_episode_number: 11,
      next_episode_season: 1,
    };

    it('should return a show for a profile by episode', async () => {
      mockExecute.mockResolvedValueOnce([[mockShow]]);

      const show = await showsDb.getShowForProfileByChild(123, 100, 'episodes');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from episodes where id = ?)',
        [123, 100],
      );
      expect(show.title).toBe('Show 1');
    });

    it('should return a show for a profile by season', async () => {
      mockExecute.mockResolvedValueOnce([[mockShow]]);

      const show = await showsDb.getShowForProfileByChild(123, 10, 'seasons');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from seasons where id = ?)',
        [123, 10],
      );
      expect(show.title).toBe('Show 1');
    });

    it('should throw error when show does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await expect(showsDb.getShowForProfileByChild(123, 999, 'episodes')).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from episodes where id = ?)',
        [123, 999],
      );
    });
  });

  describe('getShowWithSeasonsForProfile', () => {
    it('should return a show with its seasons and episodes', async () => {
      // Mock show data
      const mockShow = {
        show_id: 1,
        title: 'Test Show',
        watch_status: 'WATCHING',
        profile_id: 123,
        season_count: 2,
        episode_count: 10,
      };

      // Mock seasons data
      const mockSeasons = [
        {
          season_id: 101,
          show_id: 1,
          name: 'Season 1',
          season_number: 1,
          watch_status: 'WATCHED',
          profile_id: 123,
          number_of_episodes: 5,
        },
        {
          season_id: 102,
          show_id: 1,
          name: 'Season 2',
          season_number: 2,
          watch_status: 'WATCHING',
          profile_id: 123,
          number_of_episodes: 5,
        },
      ];

      // Mock episodes data
      const mockEpisodes = [
        {
          episode_id: 1001,
          season_id: 101,
          show_id: 1,
          episode_number: 1,
          season_number: 1,
          title: 'Episode 1',
          watch_status: 'WATCHED',
          profile_id: 123,
        },
        {
          episode_id: 1002,
          season_id: 101,
          show_id: 1,
          episode_number: 2,
          season_number: 1,
          title: 'Episode 2',
          watch_status: 'WATCHED',
          profile_id: 123,
        },
        {
          episode_id: 1003,
          season_id: 102,
          show_id: 1,
          episode_number: 1,
          season_number: 2,
          title: 'Episode 3',
          watch_status: 'WATCHING',
          profile_id: 123,
        },
      ];

      // Setup mock responses
      mockExecute.mockResolvedValueOnce([[mockShow]]);
      mockExecute.mockResolvedValueOnce([mockSeasons]);
      mockExecute.mockResolvedValueOnce([mockEpisodes]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 1);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM profile_shows where profile_id = ? AND show_id = ?',
        [123, 1],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number',
        [123, 1],
      );

      // Verify the structure of the result
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(2);
      expect(result!.seasons![0].id).toBe(101);
      expect(result!.seasons![0].episodes).toHaveLength(2);
      expect(result!.seasons![1].episodes).toHaveLength(1);
    });

    it('should return null when show does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 999);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should return show without seasons when no seasons exist', async () => {
      const mockShow = {
        show_id: 1,
        title: 'Test Show',
        watch_status: 'WATCHING',
        profile_id: 123,
        season_count: 0,
        episode_count: 0,
      };

      mockExecute.mockResolvedValueOnce([[mockShow]]);
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 1);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(0);
    });
  });

  describe('getShowWithSeasonsForProfileByChild', () => {
    // Mock show data
    const mockShow = {
      show_id: 1,
      title: 'Test Show',
      watch_status: 'WATCHING',
      profile_id: 123,
      season_count: 2,
      episode_count: 10,
    };

    // Mock seasons data
    const mockSeasons = [
      {
        season_id: 101,
        show_id: 1,
        name: 'Season 1',
        season_number: 1,
        watch_status: 'WATCHED',
        profile_id: 123,
        number_of_episodes: 5,
      },
      {
        season_id: 102,
        show_id: 1,
        name: 'Season 2',
        season_number: 2,
        watch_status: 'WATCHING',
        profile_id: 123,
        number_of_episodes: 5,
      },
    ];

    // Mock episodes data
    const mockEpisodes = [
      {
        episode_id: 1001,
        season_id: 101,
        show_id: 1,
        episode_number: 1,
        season_number: 1,
        title: 'Episode 1',
        watch_status: 'WATCHED',
        profile_id: 123,
      },
      {
        episode_id: 1002,
        season_id: 101,
        show_id: 1,
        episode_number: 2,
        season_number: 1,
        title: 'Episode 2',
        watch_status: 'WATCHED',
        profile_id: 123,
      },
      {
        episode_id: 1003,
        season_id: 102,
        show_id: 1,
        episode_number: 1,
        season_number: 2,
        title: 'Episode 3',
        watch_status: 'WATCHING',
        profile_id: 123,
      },
    ];

    it('should return a show with its seasons and episodes by a child episode', async () => {
      mockExecute.mockResolvedValueOnce([[mockShow]]);
      mockExecute.mockResolvedValueOnce([mockSeasons]);
      mockExecute.mockResolvedValueOnce([mockEpisodes]);

      const result = await showsDb.getShowWithSeasonsForProfileByChild(123, 1001, 'episodes');

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from episodes where id = ?)',
        [123, 1001],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number',
        [123, 1],
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(2);
      expect(result!.seasons![0].id).toBe(101);
      expect(result!.seasons![0].episodes).toHaveLength(2);
      expect(result!.seasons![1].episodes).toHaveLength(1);
    });

    it('should return a show with its seasons and episodes by a child season', async () => {
      mockExecute.mockResolvedValueOnce([[mockShow]]);
      mockExecute.mockResolvedValueOnce([mockSeasons]);
      mockExecute.mockResolvedValueOnce([mockEpisodes]);

      const result = await showsDb.getShowWithSeasonsForProfileByChild(123, 101, 'seasons');

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from seasons where id = ?)',
        [123, 101],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number',
        [123, 1],
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(2);
      expect(result!.seasons![0].id).toBe(101);
      expect(result!.seasons![0].episodes).toHaveLength(2);
      expect(result!.seasons![1].episodes).toHaveLength(1);
    });

    it('should return null when show does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getShowWithSeasonsForProfileByChild(123, 999, 'episodes');

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('getNextUnwatchedEpisodesForProfile', () => {
    it('should return next unwatched episodes for shows the profile is watching', async () => {
      const mockRows = [
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          episode_id: 101,
          episode_title: 'Next Episode 1',
          overview: 'Episode 1 overview',
          episode_number: 3,
          season_number: 1,
          season_id: 1001,
          still_image: '/path/to/still1.jpg',
          air_date: '2023-01-15',
          network: 'Network 1',
          streaming_services: 'Netflix, Hulu',
        },
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          episode_id: 102,
          episode_title: 'Next Episode 2',
          overview: 'Episode 2 overview',
          episode_number: 4,
          season_number: 1,
          season_id: 1001,
          still_image: '/path/to/still2.jpg',
          air_date: '2023-01-22',
          network: 'Network 1',
          streaming_services: 'Netflix, Hulu',
        },
        {
          show_id: 2,
          show_title: 'Test Show 2',
          poster_image: '/path/to/poster2.jpg',
          last_watched_date: new Date('2023-01-05'),
          episode_id: 201,
          episode_title: 'Next Episode for Show 2',
          overview: 'Show 2 episode overview',
          episode_number: 5,
          season_number: 2,
          season_id: 2001,
          still_image: '/path/to/still3.jpg',
          air_date: '2023-01-08',
          network: 'Network 2',
          streaming_services: 'Prime Video',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('WITH recent_shows AS'),
        [123, 123, 123, 123],
      );

      expect(result).toHaveLength(2);

      // Verify first show (most recently watched)
      expect(result[0].showId).toBe(1);
      expect(result[0].showTitle).toBe('Test Show 1');
      expect(result[0].posterImage).toBe('/path/to/poster1.jpg');
      expect(result[0].lastWatched).toBe(new Date('2023-01-10').toISOString());
      expect(result[0].episodes).toHaveLength(2);

      // Verify first show's episodes
      expect(result[0].episodes[0].episodeId).toBe(101);
      expect(result[0].episodes[0].episodeTitle).toBe('Next Episode 1');
      expect(result[0].episodes[0].overview).toBe('Episode 1 overview');
      expect(result[0].episodes[0].episodeNumber).toBe(3);
      expect(result[0].episodes[0].seasonNumber).toBe(1);
      expect(result[0].episodes[0].seasonId).toBe(1001);
      expect(result[0].episodes[0].episodeStillImage).toBe('/path/to/still1.jpg');
      expect(result[0].episodes[0].airDate).toBe('2023-01-15');
      expect(result[0].episodes[0].network).toBe('Network 1');
      expect(result[0].episodes[0].streamingServices).toBe('Netflix, Hulu');
      expect(result[0].episodes[0].profileId).toBe(123);

      // Verify second show
      expect(result[1].showId).toBe(2);
      expect(result[1].showTitle).toBe('Test Show 2');
      expect(result[1].episodes).toHaveLength(1);
      expect(result[1].episodes[0].episodeId).toBe(201);
    });

    it('should return empty array when no shows are being watched', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(0);
    });

    it('should limit episodes to 2 per show', async () => {
      const mockRows = [
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          episode_id: 101,
          episode_title: 'Episode 1',
          overview: 'Overview 1',
          episode_number: 1,
          season_number: 1,
          season_id: 1001,
          still_image: '/still1.jpg',
          air_date: '2023-01-01',
          network: 'Network 1',
          streaming_services: 'Netflix',
        },
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          episode_id: 102,
          episode_title: 'Episode 2',
          overview: 'Overview 2',
          episode_number: 2,
          season_number: 1,
          season_id: 1001,
          still_image: '/still2.jpg',
          air_date: '2023-01-08',
          network: 'Network 1',
          streaming_services: 'Netflix',
        },
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          episode_id: 103,
          episode_title: 'Episode 3',
          overview: 'Overview 3',
          episode_number: 3,
          season_number: 1,
          season_id: 1001,
          still_image: '/still3.jpg',
          air_date: '2023-01-15',
          network: 'Network 1',
          streaming_services: 'Netflix',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(result).toHaveLength(1);
      expect(result[0].showId).toBe(1);
      expect(result[0].episodes).toHaveLength(2);
      expect(result[0].episodes[0].episodeId).toBe(101);
      expect(result[0].episodes[1].episodeId).toBe(102);
    });

    it('should handle null values for optional fields', async () => {
      const mockRows = [
        {
          show_id: 1,
          show_title: 'Test Show',
          poster_image: null,
          last_watched_date: new Date('2023-01-10'),
          episode_id: 101,
          episode_title: 'Episode',
          overview: null,
          episode_number: 1,
          season_number: 1,
          season_id: 1001,
          still_image: null,
          air_date: '2023-01-01',
          network: null,
          streaming_services: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(result).toHaveLength(1);
      expect(result[0].posterImage).toBe('');
      expect(result[0].episodes[0].overview).toBe('');
      expect(result[0].episodes[0].episodeStillImage).toBe('');
      expect(result[0].episodes[0].network).toBe('');
      expect(result[0].episodes[0].streamingServices).toBe('');
    });

    it('should handle database error properly', async () => {
      const dbError = new Error('Database query failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(showsDb.getNextUnwatchedEpisodesForProfile(123)).rejects.toThrow('Database query failed');
    });
  });

  describe('getProfilesForShow', () => {
    it('should return profiles that have added a show to their favorites', async () => {
      const mockProfiles = [
        { account_id: 1, profile_id: 1 },
        { account_id: 1, profile_id: 2 },
        { account_id: 2, profile_id: 3 },
      ];

      mockExecute.mockResolvedValueOnce([mockProfiles]);

      const profilesForShows = await showsDb.getProfilesForShow(123);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('profiles p ON sws.profile_id = p.profile_id'), [
        123,
      ]);
      expect(profilesForShows.profileAccountMappings).toHaveLength(3);
      expect(profilesForShows.profileAccountMappings).toEqual([
        { accountId: 1, profileId: 1 },
        { accountId: 1, profileId: 2 },
        { accountId: 2, profileId: 3 },
      ]);
    });

    it('should return empty array when no profiles have added the show', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const profilesForShows = await showsDb.getProfilesForShow(999);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('profiles p ON sws.profile_id = p.profile_id'), [
        999,
      ]);
      expect(profilesForShows.profileAccountMappings).toHaveLength(0);
    });
  });
});
