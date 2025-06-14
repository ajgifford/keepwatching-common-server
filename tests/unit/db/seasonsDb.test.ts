import { CreateSeasonRequest, UpdateSeasonRequest } from '@ajgifford/keepwatching-types';
import * as seasonsDb from '@db/seasonsDb';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
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
        'INSERT IGNORE INTO season_watch_status (profile_id, season_id) VALUES (?, ?)',
        [123, 456],
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

  describe('updateWatchStatus', () => {
    it('should update watch status for a season', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const result = await seasonsDb.updateWatchStatus(123, 456, 'WATCHED');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['WATCHED', 123, 456],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const result = await seasonsDb.updateWatchStatus(123, 999, 'WATCHED');

      expect(result).toBe(false);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(seasonsDb.updateWatchStatus(0, 456, 'WATCHED')).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.updateWatchStatus(123, 0, 'WATCHED')).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.updateWatchStatus(123, 456, '')).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when updating watch status fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.updateWatchStatus(123, 456, 'WATCHED')).rejects.toThrow(
        'Database error updating the watch status of a season: Database connection failed',
      );
    });
  });

  describe('updateWatchStatusByEpisode', () => {
    let mockTransactionHelper: jest.Mocked<TransactionHelper>;

    beforeEach(() => {
      mockTransactionHelper = {
        executeInTransaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockConnection);
        }),
      } as unknown as jest.Mocked<TransactionHelper>;

      (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
    });

    it('should update season status to WATCHED when all episodes are watched and there are no future episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [
            {
              total_episodes: 10,
              watched_aired_episodes: 10,
              aired_episodes: 10,
              future_episodes: 0,
              watched_episodes: 10,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await seasonsDb.updateWatchStatusByEpisode(123, 456);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`SUM(CASE WHEN ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_episodes`),
        [456, 123],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['WATCHED', 123, 456],
      );
    });

    it('should update season status to UP_TO_DATE when all episodes are watched and there are future episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [
            {
              total_episodes: 13,
              watched_aired_episodes: 10,
              aired_episodes: 10,
              future_episodes: 3,
              watched_episodes: 10,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await seasonsDb.updateWatchStatusByEpisode(123, 456);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`SUM(CASE WHEN ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_episodes`),
        [456, 123],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['UP_TO_DATE', 123, 456],
      );
    });

    it('should update season status to WATCHING when there unwatched aired episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [
            {
              total_episodes: 13,
              watched_aired_episodes: 8,
              aired_episodes: 10,
              future_episodes: 3,
              watched_episodes: 10,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await seasonsDb.updateWatchStatusByEpisode(123, 456);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`SUM(CASE WHEN ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_episodes`),
        [456, 123],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['WATCHING', 123, 456],
      );
    });

    it('should update season status to UP_TO_DATE when the season has no episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [
            {
              total_episodes: 0,
              watched_aired_episodes: 0,
              aired_episodes: 0,
              future_episodes: 0,
              watched_episodes: 0,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await seasonsDb.updateWatchStatusByEpisode(123, 456);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`SUM(CASE WHEN ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_episodes`),
        [456, 123],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE season_watch_status SET status = UP_TO_DATE WHERE profile_id = ? AND season_id = ?',
        [123, 456],
      );
    });

    it('should do nothing when no status result is returned', async () => {
      mockConnection.execute.mockResolvedValueOnce([[]]);

      await seasonsDb.updateWatchStatusByEpisode(123, 456);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).not.toHaveBeenCalledWith(
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        expect.anything(),
      );
    });

    it('should throw error when parameters are missing', async () => {
      await expect(seasonsDb.updateWatchStatusByEpisode(0, 456)).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.updateWatchStatusByEpisode(123, 0)).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when updating by episode fails', async () => {
      const mockError = new Error('Database connection failed');
      mockConnection.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.updateWatchStatusByEpisode(123, 456)).rejects.toThrow(
        'Database error updating season watch status using episode status: Database connection failed',
      );
    });
  });

  describe('updateAllWatchStatuses', () => {
    let mockTransactionHelper: jest.Mocked<TransactionHelper>;

    beforeEach(() => {
      mockTransactionHelper = {
        executeInTransaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockConnection);
        }),
      } as unknown as jest.Mocked<TransactionHelper>;

      (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
    });

    it('should update season and episodes watch status', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Season update
        .mockResolvedValueOnce([{ affectedRows: 5 } as ResultSetHeader]); // Episodes update

      const result = await seasonsDb.updateAllWatchStatuses(123, 456, 'WATCHED');

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['WATCHED', 123, 456],
      );

      const secondCall = mockConnection.execute.mock.calls[1];
      expect(secondCall[0]).toContain('UPDATE episode_watch_status');
      expect(secondCall[0]).toContain('WHERE profile_id = ?');
      expect(secondCall[0]).toContain('AND episode_id IN');
      expect(secondCall[0]).toContain('SELECT id from episodes where season_id');
      expect(secondCall[1]).toEqual(['WATCHED', 123, 456]);

      expect(result).toBe(true);
    });

    it('should update season and episodes watch status for UP_TO_DATE', async () => {
      const currentDate = new Date().toISOString().split('T')[0];

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Season update

      const result = await seasonsDb.updateAllWatchStatuses(123, 456, 'UP_TO_DATE');

      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?',
        ['UP_TO_DATE', 123, 456],
      );

      const secondCall = mockConnection.execute.mock.calls[1];
      expect(secondCall[0]).toContain('UPDATE episode_watch_status ews');
      expect(secondCall[0]).toContain('JOIN episodes e ON ews.episode_id = e.id');
      expect(secondCall[0]).toContain(`SET ews.status = 'WATCHED'`);
      expect(secondCall[0]).toContain('WHERE ews.profile_id = ?');
      expect(secondCall[0]).toContain('AND e.season_id = ?');
      expect(secondCall[0]).toContain('AND (e.air_date IS NULL OR e.air_date <= ?)');
      expect(secondCall[1]).toEqual([123, 456, currentDate]);

      const thirdCall = mockConnection.execute.mock.calls[2];
      expect(thirdCall[0]).toContain('UPDATE episode_watch_status ews');
      expect(thirdCall[0]).toContain('JOIN episodes e ON ews.episode_id = e.id');
      expect(thirdCall[0]).toContain(`SET ews.status = 'NOT_WATCHED'`);
      expect(thirdCall[0]).toContain('WHERE ews.profile_id = ?');
      expect(thirdCall[0]).toContain('AND e.season_id = ?');
      expect(thirdCall[0]).toContain('AND e.air_date > ?');
      expect(thirdCall[1]).toEqual([123, 456, currentDate]);

      expect(result).toBe(true);
    });

    it('should return false when season update fails', async () => {
      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const result = await seasonsDb.updateAllWatchStatuses(123, 456, 'WATCHED');

      expect(result).toBe(false);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(seasonsDb.updateAllWatchStatuses(0, 456, 'WATCHED')).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.updateAllWatchStatuses(123, 0, 'WATCHED')).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.updateAllWatchStatuses(123, 456, '')).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when updating all statuses fails', async () => {
      const mockError = new Error('Database connection failed');
      mockConnection.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.updateAllWatchStatuses(123, 456, 'WATCHED')).rejects.toThrow(
        'Database error updating a season watch status and its episodes: Database connection failed',
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

  describe('getWatchStatus', () => {
    it('should return watch status for a season', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ status: 'WATCHED' }]]);

      const status = await seasonsDb.getWatchStatus(123, 1);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT status FROM season_watch_status WHERE profile_id = ? AND season_id = ?',
        [123, 1],
      );
      expect(status).toBe('WATCHED');
    });

    it('should return null when watch status not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const status = await seasonsDb.getWatchStatus(123, 999);

      expect(status).toBeNull();
    });

    it('should throw error when parameters are missing', async () => {
      await expect(seasonsDb.getWatchStatus(0, 1)).rejects.toThrow('Invalid parameters');
      await expect(seasonsDb.getWatchStatus(123, 0)).rejects.toThrow('Invalid parameters');
    });

    it('should throw DatabaseError when getting watch status fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(seasonsDb.getWatchStatus(123, 1)).rejects.toThrow(
        'Database error getting a seasons watch status: Database connection failed',
      );
    });
  });
});
