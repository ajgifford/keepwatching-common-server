import { ShowContentUpdates } from '../../../../src/types/contentTypes';
import { ShowReferenceRow } from '../../../../src/types/showTypes';
import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { CreateShowRequest, UpdateShowRequest } from '@ajgifford/keepwatching-types';
import * as showsDb from '@db/showsDb';
import { DatabaseError } from '@middleware/errorMiddleware';
import { ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

describe('showRepository', () => {
  let mockExecute: jest.Mock;
  let mockConnection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockConnection = mocks.mockConnection;
  });

  describe('saveShow', () => {
    it('should insert a show into the database with transaction', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([
        { insertId: 5, affectedRows: 1 } as ResultSetHeader,
      ]);

      const show: CreateShowRequest = {
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      const result = await showsDb.saveShow(show);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO shows'),
        expect.arrayContaining([
          12345,
          'Test Show',
          'Test description',
          '2023-01-01',
          '/path/to/poster.jpg',
          '/path/to/backdrop.jpg',
          8.5,
          'TV-MA',
          10,
          20,
          'Running',
          'Scripted',
          1,
          '2023-12-01',
          1001,
          1002,
          'Test Network',
        ]),
      );
      expect(result).toBe(5);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)',
        [5, 28],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)',
        [5, 18],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        4,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 8],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        5,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 9],
      );
    });

    it('should rollback transaction and throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      const show: CreateShowRequest = {
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      await expect(showsDb.saveShow(show)).rejects.toThrow(DatabaseError);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });

    it('should return false when no rows are affected', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([
        { insertId: 0, affectedRows: 0 } as ResultSetHeader,
      ]);

      const show: CreateShowRequest = {
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      const result = await showsDb.saveShow(show);
      expect(result).toBe(0);
    });
  });

  describe('updateShow', () => {
    it('should update show in DB with transaction', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: UpdateShowRequest = {
        id: 5,
        tmdb_id: 12345,
        title: 'Updated Show',
        description: 'Updated description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      const result = await showsDb.updateShow(show);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shows SET'),
        expect.arrayContaining([
          'Updated Show',
          'Updated description',
          '2023-01-01',
          '/path/to/poster.jpg',
          '/path/to/backdrop.jpg',
          8.5,
          'TV-MA',
          10,
          20,
          12345, // tmdbId at the end for the WHERE clause
        ]),
      );
      expect(result).toBe(true);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(2, 'DELETE FROM show_genres WHERE show_id = ?', [5]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)',
        [5, 28],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        4,
        'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)',
        [5, 18],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(5, 'DELETE FROM show_services WHERE show_id = ?', [5]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        6,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 8],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        7,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 9],
      );
    });

    it('should return false when no rows are affected', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const show: UpdateShowRequest = {
        id: 5,
        tmdb_id: 12345,
        title: 'Updated Show',
        description: 'Updated description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      const result = await showsDb.updateShow(show);
      expect(result).toBe(false);
    });

    it('should rollback transaction and throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      const show: UpdateShowRequest = {
        id: 5,
        tmdb_id: 12345,
        title: 'Updated Show',
        description: 'Updated description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_image: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        streaming_service_ids: [8, 9],
        season_count: 10,
        episode_count: 20,
        genre_ids: [28, 18],
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      await expect(showsDb.updateShow(show)).rejects.toThrow(DatabaseError);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveShowGenre', () => {
    it('should save a genre for a show', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await showsDb.saveShowGenre(5, 28, mockConnection as PoolConnection);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)',
        [5, 28],
      );
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.saveShowGenre(5, 28, mockConnection as PoolConnection)).rejects.toThrow(DatabaseError);
    });
  });

  describe('saveShowStreamingService', () => {
    it('should save a streaming service for a show', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await showsDb.saveShowStreamingService(5, 8, mockConnection as PoolConnection);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 8],
      );
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.saveShowStreamingService(5, 8, mockConnection as PoolConnection)).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  describe('findShowById', () => {
    it('should return a show when found', async () => {
      const mockShow = {
        id: 5,
        tmdb_id: 12345,
        title: 'Show',
      };

      (mockExecute as jest.Mock).mockResolvedValueOnce([[mockShow]]);

      const showTMDBReference = await showsDb.findShowById(5);

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, title, release_date FROM shows WHERE id = ?', [5]);
      expect(showTMDBReference).not.toBeNull();
      expect(showTMDBReference).toEqual({
        id: 5,
        tmdbId: 12345,
        title: 'Show',
      });
    });

    it('should return null when show not found', async () => {
      (mockExecute as jest.Mock).mockResolvedValueOnce([[] as ShowReferenceRow[]]);
      const show = await showsDb.findShowById(999);
      expect(show).toBeNull();
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockExecute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.findShowById(5)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findShowByTMDBId', () => {
    it('should return a show when found', async () => {
      const mockShow = {
        id: 5,
      };

      (mockExecute as jest.Mock).mockResolvedValueOnce([[mockShow] as ShowReferenceRow[]]);

      const show = await showsDb.findShowByTMDBId(12345);

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, title, release_date FROM shows WHERE tmdb_id = ?', [
        12345,
      ]);
      expect(show).not.toBeNull();
      expect(show!.id).toBe(5);
    });

    it('should return null when show not found', async () => {
      (mockExecute as jest.Mock).mockResolvedValueOnce([[] as ShowReferenceRow[]]);
      const show = await showsDb.findShowByTMDBId(99999);
      expect(show).toBeNull();
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockExecute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.findShowByTMDBId(12345)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getShowsForUpdates', () => {
    it('should return shows that need updates', async () => {
      const mockShows: ShowContentUpdates[] = [
        {
          id: 1,
          title: 'Show 1',
          tmdb_id: 101,
          season_count: 3,
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-05T10:00:00Z',
        },
        {
          id: 2,
          title: 'Show 2',
          tmdb_id: 102,
          season_count: 2,
          created_at: '2023-01-02T10:00:00Z',
          updated_at: '2023-01-06T10:00:00Z',
        },
      ];

      (mockExecute as jest.Mock).mockResolvedValueOnce([mockShows]);

      const showUpdates = await showsDb.getShowsForUpdates();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT id, title, tmdb_id, season_count, created_at, updated_at from shows where in_production = 1',
        ),
      );
      expect(showUpdates).toHaveLength(2);
      expect(showUpdates[0].id).toBe(1);
      expect(showUpdates[0].title).toBe('Show 1');
      expect(showUpdates[0].tmdb_id).toBe(101);
      expect(showUpdates[0].season_count).toBe(3);
      expect(showUpdates[1].id).toBe(2);
      expect(showUpdates[1].title).toBe('Show 2');
      expect(showUpdates[1].tmdb_id).toBe(102);
      expect(showUpdates[1].season_count).toBe(2);
    });

    it('should return empty array when no shows need updates', async () => {
      (mockExecute as jest.Mock).mockResolvedValueOnce([[]]);
      const showUpdates = await showsDb.getShowsForUpdates();
      expect(showUpdates).toHaveLength(0);
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockExecute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.getShowsForUpdates()).rejects.toThrow(DatabaseError);
    });
  });
});
