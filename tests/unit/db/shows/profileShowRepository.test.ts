import * as showsDb from '@db/showsDb';
import { getDbPool } from '@utils/db';
import { RowDataPacket } from 'mysql2';

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

      mockPool.execute.mockResolvedValueOnce([mockShows as RowDataPacket[]]);

      const shows = await showsDb.getAllShowsForProfile('123');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
      expect(shows).toHaveLength(2);
      expect(shows[0].title).toBe('Show 1');
      expect(shows[0].last_episode).toEqual({
        title: 'Last Episode',
        air_date: '2023-01-01',
        episode_number: 10,
        season_number: 1,
      });
      expect(shows[1].last_episode).toBeNull();
    });

    it('should handle empty result set', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const shows = await showsDb.getAllShowsForProfile('123');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_shows WHERE profile_id = ?', [123]);
      expect(shows).toHaveLength(0);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(showsDb.getAllShowsForProfile('123')).rejects.toThrow('Database connection failed');
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

      mockPool.execute.mockResolvedValueOnce([[mockShow] as RowDataPacket[]]);

      const show = await showsDb.getShowForProfile('123', 1);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?',
        [123, 1],
      );
      expect(show.title).toBe('Show 1');
      expect(show.last_episode).toEqual({
        title: 'Last Episode',
        air_date: '2023-01-01',
        episode_number: 10,
        season_number: 1,
      });
      expect(show.next_episode).toEqual({
        title: 'Next Episode',
        air_date: '2023-01-08',
        episode_number: 11,
        season_number: 1,
      });
    });

    it('should throw error when show does not exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      await expect(showsDb.getShowForProfile('123', 999)).rejects.toThrow();
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
      mockPool.execute.mockResolvedValueOnce([[mockShow] as RowDataPacket[]]);
      mockPool.execute.mockResolvedValueOnce([mockSeasons as RowDataPacket[]]);
      mockPool.execute.mockResolvedValueOnce([mockEpisodes as RowDataPacket[]]);

      const result = await showsDb.getShowWithSeasonsForProfile('123', '1');

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
      expect(result!.seasons![0].season_id).toBe(101);
      expect(result!.seasons![0].episodes).toHaveLength(2);
      expect(result!.seasons![1].episodes).toHaveLength(1);
    });

    it('should return null when show does not exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const result = await showsDb.getShowWithSeasonsForProfile('123', '999');

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

      mockPool.execute.mockResolvedValueOnce([[mockShow] as RowDataPacket[]]);
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const result = await showsDb.getShowWithSeasonsForProfile('123', '1');

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Show');
      expect(result!.seasons).toHaveLength(0);
    });
  });

  describe('getNextUnwatchedEpisodesForProfile', () => {
    it('should return next unwatched episodes for shows the profile is watching', async () => {
      // Mock recent shows
      const mockRecentShows = [
        {
          show_id: 1,
          show_title: 'Test Show 1',
          poster_image: '/path/to/poster1.jpg',
          last_watched_date: '2023-01-10',
          profile_id: 123,
        },
        {
          show_id: 2,
          show_title: 'Test Show 2',
          poster_image: '/path/to/poster2.jpg',
          last_watched_date: '2023-01-05',
          profile_id: 123,
        },
      ];

      // Mock next episodes for first show
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

      // Mock next episodes for second show
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

      // Setup mock responses
      mockPool.execute.mockResolvedValueOnce([mockRecentShows as RowDataPacket[]]);
      mockPool.execute.mockResolvedValueOnce([mockShow1Episodes as RowDataPacket[]]);
      mockPool.execute.mockResolvedValueOnce([mockShow2Episodes as RowDataPacket[]]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile('123');

      expect(mockPool.execute).toHaveBeenCalledTimes(3);
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM profile_recent_shows_with_unwatched WHERE profile_id'),
        ['123'],
      );

      // Verify the structure of the result
      expect(result).toHaveLength(2);
      expect(result[0].show_id).toBe(1);
      expect(result[0].show_title).toBe('Test Show 1');
      expect(result[0].episodes).toHaveLength(2);
      expect(result[1].show_id).toBe(2);
      expect(result[1].episodes).toHaveLength(1);
    });

    it('should return empty array when no shows are being watched', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const result = await showsDb.getNextUnwatchedEpisodesForProfile('123');

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(0);
    });

    it('should handle database error properly', async () => {
      const dbError = new Error('Database query failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(showsDb.getNextUnwatchedEpisodesForProfile('123')).rejects.toThrow('Database query failed');
    });
  });

  describe('getProfilesForShow', () => {
    it('should return profiles that have added a show to their favorites', async () => {
      const mockProfiles = [{ profile_id: 1 }, { profile_id: 2 }, { profile_id: 3 }];

      mockPool.execute.mockResolvedValueOnce([mockProfiles as RowDataPacket[]]);

      const profileIds = await showsDb.getProfilesForShow(123);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT profile_id FROM show_watch_status where show_id = ?', [
        123,
      ]);
      expect(profileIds).toHaveLength(3);
      expect(profileIds).toEqual([1, 2, 3]);
    });

    it('should return empty array when no profiles have added the show', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const profileIds = await showsDb.getProfilesForShow(999);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT profile_id FROM show_watch_status where show_id = ?', [
        999,
      ]);
      expect(profileIds).toHaveLength(0);
    });
  });

  describe('transformRow', () => {
    it('should transform row data to ProfileShow object with last episode', () => {
      const mockRow = {
        profile_id: 123,
        show_id: 1,
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        season_count: 3,
        episode_count: 30,
        watch_status: 'WATCHING',
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        genres: 'Drama, Thriller',
        streaming_services: 'Netflix, Prime Video',
        network: 'HBO',
        last_episode_title: 'Finale',
        last_episode_air_date: '2023-06-15',
        last_episode_number: 10,
        last_episode_season: 3,
        next_episode_title: null,
        next_episode_air_date: null,
        next_episode_number: null,
        next_episode_season: null,
      } as unknown as RowDataPacket;

      const result = showsDb.transformRow(mockRow);

      expect(result.profile_id).toBe(123);
      expect(result.show_id).toBe(1);
      expect(result.title).toBe('Test Show');
      expect(result.description).toBe('Test description');
      expect(result.watch_status).toBe('WATCHING');
      expect(result.genres).toBe('Drama, Thriller');
      expect(result.streaming_services).toBe('Netflix, Prime Video');
      expect(result.last_episode).toEqual({
        title: 'Finale',
        air_date: '2023-06-15',
        episode_number: 10,
        season_number: 3,
      });
      expect(result.next_episode).toBeNull();
    });

    it('should transform row data to ProfileShow object with next episode', () => {
      const mockRow = {
        profile_id: 123,
        show_id: 1,
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        season_count: 3,
        episode_count: 30,
        watch_status: 'WATCHING',
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        genres: 'Drama, Thriller',
        streaming_services: 'Netflix, Prime Video',
        network: 'HBO',
        last_episode_title: null,
        last_episode_air_date: null,
        last_episode_number: null,
        last_episode_season: null,
        next_episode_title: 'Season Premiere',
        next_episode_air_date: '2023-07-15',
        next_episode_number: 1,
        next_episode_season: 4,
      } as unknown as RowDataPacket;

      const result = showsDb.transformRow(mockRow);

      expect(result.profile_id).toBe(123);
      expect(result.show_id).toBe(1);
      expect(result.title).toBe('Test Show');
      expect(result.last_episode).toBeNull();
      expect(result.next_episode).toEqual({
        title: 'Season Premiere',
        air_date: '2023-07-15',
        episode_number: 1,
        season_number: 4,
      });
    });

    it('should throw error when row is null or undefined', () => {
      expect(() => showsDb.transformRow(null as any)).toThrow('Cannot transform undefined or null row');
      expect(() => showsDb.transformRow(undefined as any)).toThrow('Cannot transform undefined or null row');
    });
  });
});
