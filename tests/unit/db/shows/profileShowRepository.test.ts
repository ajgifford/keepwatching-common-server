import * as showsDb from '@db/showsDb';
import { getDbPool } from '@utils/db';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('profileShowRepository', () => {
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    mockPool = getDbPool();
    mockPool.execute.mockReset();
    mockPool.getConnection.mockReset();
    mockPool.getConnection.mockResolvedValue(mockConnection);
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

      mockPool.execute.mockResolvedValueOnce([mockShows]);

      const shows = await showsDb.getAllShowsForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
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
      mockPool.execute.mockResolvedValueOnce([[]]);

      const shows = await showsDb.getAllShowsForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
      expect(shows).toHaveLength(0);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(showsDb.getAllShowsForProfile(123)).rejects.toThrow('Database connection failed');
      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
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

      mockPool.execute.mockResolvedValueOnce([[mockShow]]);

      const show = await showsDb.getShowForProfile(123, 1);

      expect(mockPool.execute).toHaveBeenCalledWith(
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
      mockPool.execute.mockResolvedValueOnce([[]]);

      await expect(showsDb.getShowForProfile(123, 999)).rejects.toThrow();
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?',
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
      mockPool.execute.mockResolvedValueOnce([[mockShow]]);
      mockPool.execute.mockResolvedValueOnce([mockSeasons]);
      mockPool.execute.mockResolvedValueOnce([mockEpisodes]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 1);

      expect(mockPool.execute).toHaveBeenCalledTimes(3);
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM profile_shows where profile_id = ? AND show_id = ?',
        [123, 1],
      );
      expect(mockPool.execute).toHaveBeenNthCalledWith(
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
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 999);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
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

      mockPool.execute.mockResolvedValueOnce([[mockShow]]);
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getShowWithSeasonsForProfile(123, 1);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(0);
    });
  });

  describe('getNextUnwatchedEpisodesForProfile', () => {
    it('should return next unwatched episodes for shows the profile is watching', async () => {
      const mockRecentShows = [
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: new Date('2023-01-10'),
          profile_id: 123,
        },
        {
          show_id: 2,
          show_title: 'Test Show 2',
          poster_image: '/path/to/poster2.jpg',
          last_watched_date: new Date('2023-01-05'),
          profile_id: 123,
        },
      ];

      const mockShow1Episodes = [
        {
          episode_id: 101,
          episode_title: 'Next Episode 1',
          show_id: 1,
          show_name: 'Test Show 1',
          season_id: 1001,
          episode_number: 3,
          season_number: 1,
          episode_rank: 1,
          profile_id: 123,
        },
        {
          episode_id: 102,
          episode_title: 'Next Episode 2',
          show_id: 1,
          show_name: 'Test Show 1',
          season_id: 1001,
          episode_number: 4,
          season_number: 1,
          episode_rank: 2,
          profile_id: 123,
        },
      ];

      const mockShow2Episodes = [
        {
          episode_id: 201,
          episode_title: 'Next Episode for Show 2',
          show_id: 2,
          show_name: 'Test Show 2',
          season_id: 2001,
          episode_number: 5,
          season_number: 2,
          episode_rank: 1,
          profile_id: 123,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRecentShows]);
      mockPool.execute.mockResolvedValueOnce([mockShow1Episodes]);
      mockPool.execute.mockResolvedValueOnce([mockShow2Episodes]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(3);
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM profile_recent_shows_with_unwatched WHERE profile_id'),
        [123],
      );

      expect(result).toHaveLength(2);
      expect(result[0].showId).toBe(1);
      expect(result[0].showTitle).toBe('Test Show 1');
      expect(result[0].episodes).toHaveLength(2);
      expect(result[1].showId).toBe(2);
      expect(result[1].episodes).toHaveLength(1);
    });

    it('should return empty array when no shows are being watched', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(0);
    });

    it('should handle database error properly', async () => {
      const dbError = new Error('Database query failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

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

      mockPool.execute.mockResolvedValueOnce([mockProfiles]);

      const profilesForShows = await showsDb.getProfilesForShow(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('profiles p ON sws.profile_id = p.profile_id'),
        [123],
      );
      expect(profilesForShows.profileAccountMappings).toHaveLength(3);
      expect(profilesForShows.profileAccountMappings).toEqual([
        { accountId: 1, profileId: 1 },
        { accountId: 1, profileId: 2 },
        { accountId: 2, profileId: 3 },
      ]);
    });

    it('should return empty array when no profiles have added the show', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const profilesForShows = await showsDb.getProfilesForShow(999);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('profiles p ON sws.profile_id = p.profile_id'),
        [999],
      );
      expect(profilesForShows.profileAccountMappings).toHaveLength(0);
    });
  });
});
