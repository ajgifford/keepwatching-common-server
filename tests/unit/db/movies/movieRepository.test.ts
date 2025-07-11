import { CreateMovieRequest, UpdateMovieRequest, WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

jest.mock('@utils/transactionHelper');

describe('movieRepository', () => {
  let mockPool: any;
  let mockConnection: any;
  let mockTransactionHelper: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();

    mockConnection = {
      execute: jest.fn().mockResolvedValue([{ insertId: 1 }]),
    };

    mockTransactionHelper = {
      executeInTransaction: jest.fn((callback) => callback(mockConnection)),
    };

    (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
  });

  describe('saveMovie', () => {
    it('should save a movie to the database', async () => {
      const movieData: CreateMovieRequest = {
        tmdb_id: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        release_date: '2025-01-01',
        runtime: 120,
        poster_image: '/test-poster.jpg',
        backdrop_image: '/test-backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        budget: 50000,
        revenue: 123456,
        director: 'Director A',
        production_companies: 'Production A',
        genre_ids: [28, 12],
        streaming_service_ids: [1, 2],
      };

      mockConnection.execute.mockImplementation((query: string | string[]) => {
        if (query.includes('INSERT into movies')) {
          return [{ insertId: 1 }];
        }
        return [{}];
      });

      const result = await moviesDb.saveMovie(movieData);

      expect(TransactionHelper).toHaveBeenCalled();
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalled();

      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT into movies'), [
        12345,
        'Test Movie',
        'A test movie description',
        '2025-01-01',
        120,
        '/test-poster.jpg',
        '/test-backdrop.jpg',
        8.5,
        'PG-13',
        'Director A',
        'Production A',
        50000,
        123456,
      ]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_genres'),
        expect.arrayContaining([1, 28]),
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_genres'),
        expect.arrayContaining([1, 12]),
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_services'),
        expect.arrayContaining([1, 1]),
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_services'),
        expect.arrayContaining([1, 2]),
      );
      expect(result).toBe(1);
    });

    it('should handle a movie without genres and streaming services', async () => {
      const movieData: CreateMovieRequest = {
        tmdb_id: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        release_date: '2025-01-01',
        runtime: 120,
        poster_image: '/test-poster.jpg',
        backdrop_image: '/test-backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        budget: 50000,
        revenue: 123456,
        director: 'Director A',
        production_companies: 'Production A',
      };

      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);

      const result = await moviesDb.saveMovie(movieData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT into movies'),
        expect.any(Array),
      );

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(1);
    });

    it('should throw DatabaseError when database operation fails', async () => {
      const movieData: CreateMovieRequest = {
        tmdb_id: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        release_date: '2025-01-01',
        runtime: 120,
        poster_image: '/test-poster.jpg',
        backdrop_image: '/test-backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        budget: 50000,
        revenue: 123456,
        director: 'Director A',
        production_companies: 'Production A',
      };

      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(moviesDb.saveMovie(movieData)).rejects.toThrow('Database error saving a movie');
    });
  });

  describe('updateMovie', () => {
    it('should update an existing movie', async () => {
      const movieData: UpdateMovieRequest = {
        id: 1,
        tmdb_id: 12345,
        title: 'Updated Movie',
        description: 'An updated description',
        release_date: '2025-01-01',
        runtime: 130,
        poster_image: '/updated-poster.jpg',
        backdrop_image: '/updated-backdrop.jpg',
        user_rating: 9.0,
        mpa_rating: 'R',
        budget: 50000,
        revenue: 123456,
        director: 'Director A',
        production_companies: 'Production A',
        genre_ids: [28, 53],
        streaming_service_ids: [3],
      };

      mockConnection.execute.mockImplementation((query: string | string[]) => {
        if (query.includes('UPDATE movies')) {
          return [{ affectedRows: 1 }];
        }
        return [{}];
      });

      const result = await moviesDb.updateMovie(movieData);

      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE movies'), [
        'Updated Movie',
        'An updated description',
        '2025-01-01',
        130,
        '/updated-poster.jpg',
        '/updated-backdrop.jpg',
        9.0,
        'R',
        'Director A',
        'Production A',
        50000,
        123456,
        12345,
      ]);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_genres'),
        expect.arrayContaining([1, 28]),
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT IGNORE INTO movie_services'),
        expect.arrayContaining([1, 3]),
      );
      expect(result).toBe(true);
    });

    it('should throw DatabaseError when update fails', async () => {
      const movieData: UpdateMovieRequest = {
        id: 1,
        tmdb_id: 12345,
        title: 'Updated Movie',
        description: 'An updated description',
        release_date: '2025-01-01',
        runtime: 130,
        poster_image: '/updated-poster.jpg',
        backdrop_image: '/updated-backdrop.jpg',
        user_rating: 9.0,
        mpa_rating: 'R',
        budget: 50000,
        revenue: 123456,
        director: 'Director A',
        production_companies: 'Production A',
      };

      const dbError = new Error('Update failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(moviesDb.updateMovie(movieData)).rejects.toThrow('Database error updating a movie');
    });
  });

  describe('saveFavorite', () => {
    it('should add a movie to user favorites', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await moviesDb.saveFavorite(123, 456);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO movie_watch_status (profile_id, movie_id, status) VALUES (?,?,?)',
        [123, 456, WatchStatus.NOT_WATCHED],
      );
    });

    it('should throw DatabaseError when saving favorite fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.saveFavorite(123, 456)).rejects.toThrow('Database error saving a movie as a favorite');
    });
  });

  describe('removeFavorite', () => {
    it('should remove a movie from user favorites', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await moviesDb.removeFavorite(123, 456);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM movie_watch_status WHERE profile_id = ? AND movie_id = ?',
        [123, 456],
      );
    });

    it('should throw DatabaseError when removing favorite fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.removeFavorite(123, 456)).rejects.toThrow('Database error removing a movie as a favorite');
    });
  });

  describe('updateWatchStatus', () => {
    it('should update watch status successfully', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await moviesDb.updateWatchStatus(123, 456, 'WATCHED');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE movie_watch_status SET status = ? WHERE profile_id = ? AND movie_id = ?',
        ['WATCHED', 123, 456],
      );
      expect(result).toBe(true);
    });

    it('should return false if no rows were affected', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await moviesDb.updateWatchStatus(123, 456, 'WATCHED');

      expect(result).toBe(false);
    });

    it('should throw DatabaseError when update fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.updateWatchStatus(123, 456, 'WATCHED')).rejects.toThrow(
        'Database error updating a movie watch status',
      );
    });
  });

  describe('findMovieById', () => {
    it('should return a movie if found', async () => {
      const mockMovie = {
        id: 123,
        tmdb_id: 12345,
        title: 'Test Movie',
      };

      mockPool.execute.mockResolvedValue([[mockMovie]]);

      const result = await moviesDb.findMovieById(123);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT id, title, tmdb_id FROM movies WHERE id = ?', [123]);
      expect(result).toEqual({
        id: 123,
        tmdbId: 12345,
        title: 'Test Movie',
      });
    });

    it('should return null if movie not found', async () => {
      mockPool.execute.mockResolvedValue([[]]);

      const result = await moviesDb.findMovieById(999);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT id, title, tmdb_id FROM movies WHERE id = ?', [999]);
      expect(result).toBeNull();
    });

    it('should throw DatabaseError when search fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.findMovieById(123)).rejects.toThrow('Database error finding a movie by id');
    });
  });

  describe('findMovieByTMDBId', () => {
    it('should return a movie if found', async () => {
      const mockMovie = {
        id: 123,
        tmdb_id: 12345,
        title: 'Test Movie',
        release_date: '2025-01-01',
      };

      mockPool.execute.mockResolvedValue([[mockMovie]]);

      const result = await moviesDb.findMovieByTMDBId(12345);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, title, tmdb_id, release_date FROM movies WHERE tmdb_id = ?',
        [12345],
      );
      expect(result).toEqual({
        id: 123,
        tmdbId: 12345,
        title: 'Test Movie',
        releaseDate: '2025-01-01',
      });
    });

    it('should return null if movie not found', async () => {
      mockPool.execute.mockResolvedValue([[]]);

      const result = await moviesDb.findMovieByTMDBId(99999);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, title, tmdb_id, release_date FROM movies WHERE tmdb_id = ?',
        [99999],
      );
      expect(result).toBeNull();
    });

    it('should throw DatabaseError when search fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.findMovieByTMDBId(12345)).rejects.toThrow('Database error finding a movie by TMDB id');
    });
  });

  describe('getAllMoviesForProfile', () => {
    it('should return all movies for a profile', async () => {
      const profileMovies = [
        {
          profile_id: 123,
          movie_id: 1,
          tmdb_id: 12345,
          title: 'First Movie',
          description: 'First movie description',
          release_date: '2025-01-01',
          poster_image: '/poster1.jpg',
          backdrop_image: '/backdrop1.jpg',
          runtime: 120,
          user_rating: 8.5,
          mpa_rating: 'PG-13',
          watch_status: 'WATCHED',
          genres: 'Action, Adventure',
          streaming_services: 'Netflix, Disney+',
        },
        {
          profile_id: 123,
          movie_id: 2,
          tmdb_id: 67890,
          title: 'Second Movie',
          description: 'Second movie description',
          release_date: '2025-02-01',
          poster_image: '/poster2.jpg',
          backdrop_image: '/backdrop2.jpg',
          runtime: 110,
          user_rating: 7.5,
          mpa_rating: 'PG',
          watch_status: 'NOT_WATCHED',
          genres: 'Comedy, Drama',
          streaming_services: 'Prime Video',
        },
      ];
      const expectedMovies = [
        {
          profileId: 123,
          id: 1,
          tmdbId: 12345,
          title: 'First Movie',
          description: 'First movie description',
          releaseDate: '2025-01-01',
          posterImage: '/poster1.jpg',
          backdropImage: '/backdrop1.jpg',
          runtime: 120,
          userRating: 8.5,
          mpaRating: 'PG-13',
          watchStatus: 'WATCHED',
          genres: 'Action, Adventure',
          streamingServices: 'Netflix, Disney+',
        },
        {
          profileId: 123,
          id: 2,
          tmdbId: 67890,
          title: 'Second Movie',
          description: 'Second movie description',
          releaseDate: '2025-02-01',
          posterImage: '/poster2.jpg',
          backdropImage: '/backdrop2.jpg',
          runtime: 110,
          userRating: 7.5,
          mpaRating: 'PG',
          watchStatus: 'NOT_WATCHED',
          genres: 'Comedy, Drama',
          streamingServices: 'Prime Video',
        },
      ];

      mockPool.execute.mockResolvedValue([profileMovies]);

      const result = await moviesDb.getAllMoviesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profile_movies where profile_id = ?', [123]);
      expect(result).toEqual(expectedMovies);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getAllMoviesForProfile(123)).rejects.toThrow(
        'Database error getting all movies for a profile',
      );
    });
  });

  describe('getMovieForProfile', () => {
    it('should return a specific movie for a profile', async () => {
      const profileMovie = {
        profile_id: 123,
        movie_id: 456,
        tmdb_id: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        release_date: '2025-01-01',
        poster_image: '/poster.jpg',
        backdrop_image: '/backdrop.jpg',
        runtime: 120,
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        watch_status: 'WATCHED',
        genres: 'Action, Adventure',
        streaming_services: 'Netflix, Disney+',
      };
      const expectedMovie = {
        profileId: 123,
        id: 456,
        tmdbId: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        releaseDate: '2025-01-01',
        posterImage: '/poster.jpg',
        backdropImage: '/backdrop.jpg',
        runtime: 120,
        userRating: 8.5,
        mpaRating: 'PG-13',
        watchStatus: 'WATCHED',
        genres: 'Action, Adventure',
        streamingServices: 'Netflix, Disney+',
      };

      mockPool.execute.mockResolvedValue([[profileMovie]]);

      const result = await moviesDb.getMovieForProfile(123, 456);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_movies where profile_id = ? AND movie_id = ?',
        [123, 456],
      );
      expect(result).toEqual(expectedMovie);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getMovieForProfile(123, 456)).rejects.toThrow(
        'Database error getting a movie for a profile',
      );
    });
  });

  describe('getMovieDetailsForProfile', () => {
    it('should return a specific movie for a profile', async () => {
      const profileMovie = {
        profile_id: 123,
        movie_id: 456,
        tmdb_id: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        release_date: '2025-01-01',
        poster_image: '/poster.jpg',
        backdrop_image: '/backdrop.jpg',
        runtime: 120,
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        watch_status: 'WATCHED',
        genres: 'Action, Adventure',
        streaming_services: 'Netflix, Disney+',
        director: 'Director 1',
        production_companies: 'Prod Company A, Prod Company B',
        budget: 12345600,
        revenue: 23456700,
      };
      const expectedMovie = {
        profileId: 123,
        id: 456,
        tmdbId: 12345,
        title: 'Test Movie',
        description: 'A test movie description',
        releaseDate: '2025-01-01',
        posterImage: '/poster.jpg',
        backdropImage: '/backdrop.jpg',
        runtime: 120,
        userRating: 8.5,
        mpaRating: 'PG-13',
        watchStatus: 'WATCHED',
        genres: 'Action, Adventure',
        streamingServices: 'Netflix, Disney+',
        director: 'Director 1',
        productionCompanies: 'Prod Company A, Prod Company B',
        budget: 12345600,
        revenue: 23456700,
      };

      mockPool.execute.mockResolvedValue([[profileMovie]]);

      const result = await moviesDb.getMovieDetailsForProfile(123, 456);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_movies_details where profile_id = ? AND movie_id = ?',
        [123, 456],
      );
      expect(result).toEqual(expectedMovie);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getMovieDetailsForProfile(123, 456)).rejects.toThrow(
        'Database error getting a movie with details for a profile',
      );
    });
  });

  describe('getRecentMovieReleasesForProfile', () => {
    it('should return recent movie releases for a profile', async () => {
      const recentMovies = [{ id: 1 }, { id: 2 }];
      const expectedMovies = [{ id: 1 }, { id: 2 }];

      mockPool.execute.mockResolvedValue([recentMovies]);

      const result = await moviesDb.getRecentMovieReleasesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT movie_id as id, title, tmdb_id, release_date from profile_movies WHERE profile_id = ? AND release_date BETWEEN',
        ),
        [123],
      );
      expect(result).toEqual(expectedMovies);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getRecentMovieReleasesForProfile(123)).rejects.toThrow(
        'Database error getting recent movie releases for a profile: Database connection failed',
      );
    });
  });

  describe('getUpcomingMovieReleasesForProfile', () => {
    it('should return upcoming movie releases for a profile', async () => {
      const upcomingMovies = [{ id: 1 }, { id: 2 }];
      const expectedMovies = [{ id: 1 }, { id: 2 }];

      mockPool.execute.mockResolvedValue([upcomingMovies]);

      const result = await moviesDb.getUpcomingMovieReleasesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT movie_id as id, title, tmdb_id, release_date from profile_movies WHERE profile_id = ? AND release_date BETWEEN',
        ),
        [123],
      );
      expect(result).toEqual(expectedMovies);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getUpcomingMovieReleasesForProfile(123)).rejects.toThrow(
        'Database error getting upcoming movie releases for a profile: Database connection failed',
      );
    });
  });

  describe('getMoviesForUpdates', () => {
    it('should return movies needing updates', async () => {
      const mockMovies = [
        { id: 1, title: 'Movie 1', tmdb_id: 12345, created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, title: 'Movie 2', tmdb_id: 67890, created_at: '2025-02-01', updated_at: '2025-02-01' },
      ];

      mockPool.execute.mockResolvedValue([mockMovies]);

      const result = await moviesDb.getMoviesForUpdates();

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, title, tmdb_id, created_at, updated_at FROM movies WHERE release_date > NOW() - INTERVAL 30 DAY',
      );
      expect(result).toEqual(mockMovies);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValue(dbError);

      await expect(moviesDb.getMoviesForUpdates()).rejects.toThrow('Database error getting movies for updates');
    });
  });
});
