import { CreateSeasonRequest, UpdateSeasonRequest, WatchStatus } from '@ajgifford/keepwatching-types';
import * as seasonsDb from '@db/seasonsDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

jest.mock('@utils/transactionHelper');

describe('seasonsDb Module', () => {
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

  describe('saveSeason', () => {
    it('should save a season to the database', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const season: CreateSeasonRequest = {
        show_id: 10,
        tmdb_id: 12345,
        name: 'Season 1',
        overview: 'First season of the show',
        season_number: 1,
        release_date: '2023-01-15',
        poster_image: '/path/to/poster.jpg',
        number_of_episodes: 8,
      };

      const seasonId = await seasonsDb.saveSeason(season);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO seasons'), [
        10,
        12345,
        'Season 1',
        'First season of the show',
        1,
        '2023-01-15',
        '/path/to/poster.jpg',
        8,
      ]);
      expect(seasonId).toBe(5);
    });

    it('should throw DatabaseError when saving fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      const season: CreateSeasonRequest = {
        show_id: 10,
        tmdb_id: 12345,
        name: 'Season 1',
        overview: 'First season of the show',
        season_number: 1,
        release_date: '2023-01-15',
        poster_image: '/path/to/poster.jpg',
        number_of_episodes: 8,
      };

      await expect(seasonsDb.saveSeason(season)).rejects.toThrow(
        'Database error saving a season: Database connection failed',
      );
    });

    it('should handle error with generic message when error has no message', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      const season: CreateSeasonRequest = {
        show_id: 10,
        tmdb_id: 12345,
        name: 'Season 1',
        overview: 'First season of the show',
        season_number: 1,
        release_date: '2023-01-15',
        poster_image: '/path/to/poster.jpg',
        number_of_episodes: 8,
      };

      await expect(seasonsDb.saveSeason(season)).rejects.toThrow('Unknown database error saving a season');
    });
  });

  describe('updateSeason', () => {
    it('should update an existing season or insert a new one', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const season: UpdateSeasonRequest = {
        show_id: 10,
        tmdb_id: 12345,
        name: 'Season 1 Updated',
        overview: 'Updated first season of the show',
        season_number: 1,
        release_date: '2023-01-15',
        poster_image: '/path/to/new_poster.jpg',
        number_of_episodes: 10,
      };

      const seasonId = await seasonsDb.updateSeason(season);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO seasons'),
        expect.arrayContaining([
          // Insert values
          10,
          12345,
          'Season 1 Updated',
          'Updated first season of the show',
          1,
          '2023-01-15',
          '/path/to/new_poster.jpg',
          10,
          // Update values
          'Season 1 Updated',
          'Updated first season of the show',
          1,
          '2023-01-15',
          '/path/to/new_poster.jpg',
          10,
        ]),
      );
      expect(seasonId).toBe(5);
    });

    it('should throw DatabaseError when update fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      const season: CreateSeasonRequest = {
        show_id: 10,
        tmdb_id: 12345,
        name: 'Season 1 Updated',
        overview: 'Updated first season of the show',
        season_number: 1,
        release_date: '2023-01-15',
        poster_image: '/path/to/new_poster.jpg',
        number_of_episodes: 10,
      };

      await expect(seasonsDb.updateSeason(season)).rejects.toThrow(
        'Database error updating a season: Database connection failed',
      );
    });
  });

  describe('saveFavorite', () => {
    it('should save a season as favorite for a profile', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await seasonsDb.saveFavorite(123, 456);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO season_watch_status (profile_id, season_id, status) VALUES (?,?,?)',
        [123, 456, WatchStatus.NOT_WATCHED],
      );
    });

    it('should throw error when profile or season id is missing', async () => {
      await expect(seasonsDb.saveFavorite(0, 456)).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.saveFavorite(123, 0)).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when saving favorite fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.saveFavorite(123, 456)).rejects.toThrow(
        'Database error saving a season as a favorite: Database connection failed',
      );
    });
  });

  describe('getSeasonsForShow', () => {
    it('should return seasons with episodes for a show', async () => {
      // Mock seasons data
      const mockSeasons = [
        {
          season_id: 1,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 1001,
          name: 'Season 1',
          overview: 'First season',
          season_number: 1,
          release_date: '2023-01-01',
          poster_image: '/path/to/poster1.jpg',
          number_of_episodes: 8,
          watch_status: 'WATCHED',
        },
        {
          season_id: 2,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 1002,
          name: 'Season 2',
          overview: 'Second season',
          season_number: 2,
          release_date: '2023-06-01',
          poster_image: '/path/to/poster2.jpg',
          number_of_episodes: 10,
          watch_status: 'WATCHING',
        },
      ];

      // Mock episodes data
      const mockEpisodes = [
        {
          episode_id: 101,
          season_id: 1,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 10001,
          episode_number: 1,
          season_number: 1,
          title: 'Episode 1',
          overview: 'First episode',
          runtime: 45,
          air_date: '2023-01-01',
          still_image: '/path/to/still1.jpg',
          watch_status: 'WATCHED',
        },
        {
          episode_id: 102,
          season_id: 1,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 10002,
          episode_number: 2,
          season_number: 1,
          title: 'Episode 2',
          overview: 'Second episode',
          runtime: 42,
          air_date: '2023-01-08',
          still_image: '/path/to/still2.jpg',
          watch_status: 'WATCHED',
        },
        {
          episode_id: 201,
          season_id: 2,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 20001,
          episode_number: 1,
          season_number: 2,
          title: 'Season 2 Episode 1',
          overview: 'First episode of season 2',
          runtime: 48,
          air_date: '2023-06-01',
          still_image: '/path/to/still3.jpg',
          watch_status: 'WATCHED',
        },
        {
          episode_id: 202,
          season_id: 2,
          show_id: 100,
          profile_id: 123,
          tmdb_id: 20002,
          episode_number: 2,
          season_number: 2,
          title: 'Season 2 Episode 2',
          overview: 'Second episode of season 2',
          runtime: 45,
          air_date: '2023-06-08',
          still_image: '/path/to/still4.jpg',
          watch_status: 'WATCHING',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockSeasons]).mockResolvedValueOnce([mockEpisodes]);

      const seasons = await seasonsDb.getSeasonsForShow(123, 100);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM profile_seasons'),
        [123, 100],
      );
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SELECT * FROM profile_episodes'),
        expect.arrayContaining([123, 1, 2]),
      );

      expect(seasons).toHaveLength(2);
      expect(seasons[0].id).toBe(1);
      expect(seasons[0].episodes).toHaveLength(2);
      expect(seasons[1].id).toBe(2);
      expect(seasons[1].episodes).toHaveLength(2);
      expect(seasons[0].episodes[0].id).toBe(101);
      expect(seasons[1].episodes[1].id).toBe(202);
    });

    it('should return empty array when no seasons found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const seasons = await seasonsDb.getSeasonsForShow(123, 100);

      expect(seasons).toHaveLength(0);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(seasonsDb.getSeasonsForShow(0, 100)).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.getSeasonsForShow(123, 0)).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when getting seasons fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.getSeasonsForShow(123, 100)).rejects.toThrow(
        'Database error getting all seasons for a show: Database connection failed',
      );
    });
  });

  describe('getShowIdForSeason', () => {
    it('should return show ID for a season', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ show_id: 100 }]]);

      const showId = await seasonsDb.getShowIdForSeason(1);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT show_id FROM seasons WHERE id = ?', [1]);
      expect(showId).toBe(100);
    });

    it('should return null when season not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const showId = await seasonsDb.getShowIdForSeason(999);

      expect(showId).toBeNull();
    });

    it('should throw error when season id is missing', async () => {
      await expect(seasonsDb.getShowIdForSeason(0)).rejects.toThrow('Invalid parameter: seasonId is required');
    });

    it('should throw DatabaseError when getting show ID fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.getShowIdForSeason(1)).rejects.toThrow(
        'Database error getting the show id for a season: Database connection failed',
      );
    });
  });
});
