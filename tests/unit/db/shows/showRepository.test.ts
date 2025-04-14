import { Show } from '../../../../src/types/showTypes';
import * as showsDb from '@db/showsDb';
import { CustomError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('showRepository', () => {
  let mockPool: ReturnType<typeof getDbPool>;
  let mockConnection: Partial<PoolConnection>;

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    mockPool = getDbPool();
    (mockPool.execute as jest.Mock).mockReset();
    (mockPool.getConnection as jest.Mock).mockReset();
    (mockPool.getConnection as jest.Mock).mockResolvedValue(mockConnection);
  });

  describe('saveShow', () => {
    it('should insert a show into the database with transaction', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([
        { insertId: 5, affectedRows: 1 } as ResultSetHeader,
      ]);

      const show: Show = showsDb.createShow(
        12345, // tmdbId
        'Test Show', // title
        'Test description', // description
        '2023-01-01', // releaseDate
        '/path/to/poster.jpg', // posterImage
        '/path/to/backdrop.jpg', // backdropImage
        8.5, // userRating
        'TV-MA', // contentRating
        undefined, // id
        [1, 2], // streamingServices
        10, // seasonCount
        20, // episodeCount
        [28, 18], // genreIds
        'Running', // status
        'Scripted', // type
        1, // inProduction
        '2023-12-01', // lastAirDate
        1001, // lastEpisodeToAir
        1002, // nextEpisodeToAir
        'Test Network', // network
      );

      const result = await showsDb.saveShow(show);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
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
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(show.id).toBe(5);
    });

    it('should save genres when provided', async () => {
      (mockConnection.execute as jest.Mock)
        .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        12345,
        'Test Show',
        'Test description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        undefined,
        undefined,
        5,
        10,
        [28, 18], // genreIds
      );

      await showsDb.saveShow(show);

      // We expect the genre values to have been saved
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
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
    });

    it('should save streaming services when provided', async () => {
      (mockConnection.execute as jest.Mock)
        .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        12345,
        'Test Show',
        'Test description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        undefined,
        [8, 9], // streamingServices
      );

      await showsDb.saveShow(show);

      // We expect the streaming service values to have been saved
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 8],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 9],
      );
    });

    it('should rollback transaction and throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      const show: Show = showsDb.createShow(
        12345,
        'Test Show',
        'Test description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
      );

      await expect(showsDb.saveShow(show)).rejects.toThrow(CustomError);
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should return false when no rows are affected', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([
        { insertId: 0, affectedRows: 0 } as ResultSetHeader,
      ]);

      const show: Show = showsDb.createShow(
        12345,
        'Test Show',
        'Test description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
      );

      const result = await showsDb.saveShow(show);
      expect(result).toBe(false);
    });
  });

  describe('updateShow', () => {
    it('should update show in DB with transaction', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        12345,
        'Updated Show',
        'Updated description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        5, // id
        [1, 2], // streamingServices
        10, // seasonCount
        20, // episodeCount
      );

      const result = await showsDb.updateShow(show);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
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
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should update genres when provided', async () => {
      (mockConnection.execute as jest.Mock)
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        12345,
        'Updated Show',
        'Updated description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        5, // id
        undefined,
        10,
        20,
        [28, 18], // genreIds
      );

      await showsDb.updateShow(show);

      // We expect the genre values to have been saved
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
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
    });

    it('should update streaming services when provided', async () => {
      (mockConnection.execute as jest.Mock)
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        12345,
        'Updated Show',
        'Updated description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        5, // id
        [8, 9], // streamingServices
      );

      await showsDb.updateShow(show);

      // We expect the streaming service values to have been saved
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 8],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)',
        [5, 9],
      );
    });

    it('should return false when no rows are affected', async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const show: Show = showsDb.createShow(
        99999,
        'Nonexistent Show',
        'Description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        5, // id
      );

      const result = await showsDb.updateShow(show);
      expect(result).toBe(false);
    });

    it('should rollback transaction and throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockConnection.execute as jest.Mock).mockRejectedValueOnce(mockError);

      const show: Show = showsDb.createShow(
        12345,
        'Test Show',
        'Test description',
        '2023-01-01',
        '/path/to/poster.jpg',
        '/path/to/backdrop.jpg',
        8.5,
        'TV-MA',
        5, // id
      );

      await expect(showsDb.updateShow(show)).rejects.toThrow(CustomError);
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
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

      await expect(showsDb.saveShowGenre(5, 28, mockConnection as PoolConnection)).rejects.toThrow(CustomError);
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
        CustomError,
      );
    });
  });

  describe('findShowById', () => {
    it('should return a show when found', async () => {
      const mockShow = {
        id: 5,
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_path: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        season_count: 2,
        episode_count: 10,
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[mockShow] as RowDataPacket[]]);

      const show = await showsDb.findShowById(5);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM shows WHERE id = ?', [5]);
      expect(show).not.toBeNull();
      expect(show?.id).toBe(5);
      expect(show?.title).toBe('Test Show');
      expect(show?.tmdb_id).toBe(12345);
      expect(show?.description).toBe('Test description');
      expect(show?.release_date).toBe('2023-01-01');
      expect(show?.status).toBe('Running');
      expect(show?.network).toBe('Test Network');
    });

    it('should return null when show not found', async () => {
      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[] as RowDataPacket[]]);
      const show = await showsDb.findShowById(999);
      expect(show).toBeNull();
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockPool.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.findShowById(5)).rejects.toThrow(CustomError);
    });
  });

  describe('findShowByTMDBId', () => {
    it('should return a show when found', async () => {
      const mockShow = {
        id: 5,
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_path: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        season_count: 2,
        episode_count: 10,
      };

      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[mockShow] as RowDataPacket[]]);

      const show = await showsDb.findShowByTMDBId(12345);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM shows WHERE tmdb_id = ?', [12345]);
      expect(show).not.toBeNull();
      expect(show?.id).toBe(5);
      expect(show?.tmdb_id).toBe(12345);
      expect(show?.title).toBe('Test Show');
    });

    it('should return null when show not found', async () => {
      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[] as RowDataPacket[]]);
      const show = await showsDb.findShowByTMDBId(99999);
      expect(show).toBeNull();
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockPool.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.findShowByTMDBId(12345)).rejects.toThrow(CustomError);
    });
  });

  describe('getShowsForUpdates', () => {
    it('should return shows that need updates', async () => {
      const mockShows = [
        {
          id: 1,
          title: 'Show 1',
          tmdb_id: 101,
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-05T10:00:00Z',
        },
        {
          id: 2,
          title: 'Show 2',
          tmdb_id: 102,
          created_at: '2023-01-02T10:00:00Z',
          updated_at: '2023-01-06T10:00:00Z',
        },
      ];

      (mockPool.execute as jest.Mock).mockResolvedValueOnce([mockShows as RowDataPacket[]]);

      const shows = await showsDb.getShowsForUpdates();

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, title, tmdb_id, created_at, updated_at from shows where in_production = 1'),
      );
      expect(shows).toHaveLength(2);
      expect(shows[0].id).toBe(1);
      expect(shows[0].title).toBe('Show 1');
      expect(shows[0].tmdb_id).toBe(101);
      expect(shows[1].id).toBe(2);
      expect(shows[1].title).toBe('Show 2');
      expect(shows[1].tmdb_id).toBe(102);
    });

    it('should return empty array when no shows need updates', async () => {
      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[] as RowDataPacket[]]);
      const shows = await showsDb.getShowsForUpdates();
      expect(shows).toHaveLength(0);
    });

    it('should throw DatabaseError on error', async () => {
      const mockError = new Error('Database error');
      (mockPool.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(showsDb.getShowsForUpdates()).rejects.toThrow(CustomError);
    });
  });

  describe('transformShow', () => {
    it('should transform a database row into a Show object', () => {
      const mockRow = {
        id: 5,
        tmdb_id: 12345,
        title: 'Test Show',
        description: 'Test description',
        release_date: '2023-01-01',
        poster_image: '/path/to/poster.jpg',
        backdrop_path: '/path/to/backdrop.jpg',
        user_rating: 8.5,
        content_rating: 'TV-MA',
        season_count: 2,
        episode_count: 10,
        status: 'Running',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-12-01',
        last_episode_to_air: 1001,
        next_episode_to_air: 1002,
        network: 'Test Network',
      };

      const show = showsDb.transformShow(mockRow);

      expect(show.id).toBe(5);
      expect(show.tmdb_id).toBe(12345);
      expect(show.title).toBe('Test Show');
      expect(show.description).toBe('Test description');
      expect(show.release_date).toBe('2023-01-01');
      expect(show.poster_image).toBe('/path/to/poster.jpg');
      expect(show.status).toBe('Running');
      expect(show.type).toBe('Scripted');
      expect(show.in_production).toBe(1);
      expect(show.last_air_date).toBe('2023-12-01');
      expect(show.last_episode_to_air).toBe(1001);
      expect(show.next_episode_to_air).toBe(1002);
      expect(show.network).toBe('Test Network');
    });
  });

  describe('createShow', () => {
    it('should create a properly structured Show object with all fields', () => {
      const show = showsDb.createShow(
        12345, // tmdbId
        'Test Show', // title
        'Test description', // description
        '2023-01-01', // releaseDate
        '/path/to/poster.jpg', // posterImage
        '/path/to/backdrop.jpg', // backdropImage
        8.5, // userRating
        'TV-MA', // contentRating
        5, // id
        [1, 2], // streamingServices
        10, // seasonCount
        20, // episodeCount
        [28, 18], // genreIds
        'Running', // status
        'Scripted', // type
        1, // inProduction
        '2023-12-01', // lastAirDate
        1001, // lastEpisodeToAir
        1002, // nextEpisodeToAir
        'Test Network', // network
      );

      expect(show.id).toBe(5);
      expect(show.tmdb_id).toBe(12345);
      expect(show.title).toBe('Test Show');
      expect(show.description).toBe('Test description');
      expect(show.release_date).toBe('2023-01-01');
      expect(show.poster_image).toBe('/path/to/poster.jpg');
      expect(show.backdrop_image).toBe('/path/to/backdrop.jpg');
      expect(show.user_rating).toBe(8.5);
      expect(show.content_rating).toBe('TV-MA');
      expect(show.streaming_services).toEqual([1, 2]);
      expect(show.season_count).toBe(10);
      expect(show.episode_count).toBe(20);
      expect(show.genreIds).toEqual([28, 18]);
      expect(show.status).toBe('Running');
      expect(show.type).toBe('Scripted');
      expect(show.in_production).toBe(1);
      expect(show.last_air_date).toBe('2023-12-01');
      expect(show.last_episode_to_air).toBe(1001);
      expect(show.next_episode_to_air).toBe(1002);
      expect(show.network).toBe('Test Network');
    });

    it('should create a Show object with only required fields', () => {
      const show = showsDb.createShow(
        12345, // tmdbId
        'Test Show', // title
        'Test description', // description
        '2023-01-01', // releaseDate
        '/path/to/poster.jpg', // posterImage
        '/path/to/backdrop.jpg', // backdropImage
        8.5, // userRating
        'TV-MA', // contentRating
      );

      expect(show.id).toBeUndefined();
      expect(show.tmdb_id).toBe(12345);
      expect(show.title).toBe('Test Show');
      expect(show.description).toBe('Test description');
      expect(show.release_date).toBe('2023-01-01');
      expect(show.poster_image).toBe('/path/to/poster.jpg');
      expect(show.backdrop_image).toBe('/path/to/backdrop.jpg');
      expect(show.user_rating).toBe(8.5);
      expect(show.content_rating).toBe('TV-MA');
      expect(show.streaming_services).toBeUndefined();
      expect(show.season_count).toBeUndefined();
      expect(show.episode_count).toBeUndefined();
      expect(show.genreIds).toBeUndefined();
      expect(show.status).toBeUndefined();
      expect(show.type).toBeUndefined();
      expect(show.in_production).toBeUndefined();
      expect(show.last_air_date).toBeUndefined();
      expect(show.last_episode_to_air).toBeUndefined();
      expect(show.next_episode_to_air).toBeUndefined();
      expect(show.network).toBeUndefined();
    });
  });
});
