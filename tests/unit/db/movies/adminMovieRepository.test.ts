import * as moviesDb from '@db/moviesDb';
import { getDbPool } from '@utils/db';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('adminMovieRepository', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();
  });

  describe('getMoviesCount', () => {
    it('should return the total count of movies', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 42 }]]);

      const count = await moviesDb.getMoviesCount();

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT COUNT(DISTINCT m.id) AS total FROM movies m');
      expect(count).toBe(42);
    });

    it('should throw DatabaseError when count fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(moviesDb.getMoviesCount()).rejects.toThrow(
        'Database error getting the count of movies: Database connection failed',
      );
    });
  });

  describe('getAllMovies', () => {
    it('should return all movies with default pagination', async () => {
      const mockMovieRows = [
        {
          id: 1,
          tmdb_id: 12345,
          title: 'Test Movie 1',
          description: 'Description 1',
          release_date: '2023-01-01',
          runtime: 120,
          poster_image: '/poster1.jpg',
          backdrop_image: '/backdrop1.jpg',
          user_rating: 8.5,
          mpa_rating: 'PG-13',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-05'),
          genres: 'Action, Adventure',
          streaming_services: 'Netflix, Disney+',
        },
        {
          id: 2,
          tmdb_id: 67890,
          title: 'Test Movie 2',
          description: 'Description 2',
          release_date: '2023-02-01',
          runtime: 110,
          poster_image: '/poster2.jpg',
          backdrop_image: '/backdrop2.jpg',
          user_rating: 7.5,
          mpa_rating: 'PG',
          created_at: new Date('2023-02-01'),
          updated_at: new Date('2023-02-05'),
          genres: 'Comedy, Drama',
          streaming_services: 'Prime Video',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockMovieRows]);

      const movies = await moviesDb.getAllMovies();

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM admin_movies LIMIT 50 OFFSET 0');
      expect(movies).toHaveLength(2);
      expect(movies[0].id).toBe(1);
      expect(movies[0].tmdbId).toBe(12345);
      expect(movies[0].title).toBe('Test Movie 1');
      expect(movies[0].genres).toBe('Action, Adventure');
      expect(movies[0].streamingServices).toBe('Netflix, Disney+');
      expect(movies[0].lastUpdated).toBe(mockMovieRows[0].updated_at.toISOString());
    });

    it('should return movies with custom pagination', async () => {
      mockPool.execute.mockResolvedValueOnce([
        [
          {
            id: 3,
            tmdb_id: 11111,
            title: 'Test Movie 3',
            description: 'Description 3',
            release_date: '2023-03-01',
            runtime: 130,
            poster_image: '/poster3.jpg',
            backdrop_image: '/backdrop3.jpg',
            user_rating: 9.0,
            mpa_rating: 'R',
            created_at: new Date('2023-03-01'),
            updated_at: new Date('2023-03-05'),
            genres: 'Horror, Thriller',
            streaming_services: 'HBO Max',
          },
        ],
      ]);

      const limit = 10;
      const offset = 20;
      const movies = await moviesDb.getAllMovies(limit, offset);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${limit}`));
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining(`OFFSET ${offset}`));
      expect(movies).toHaveLength(1);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(moviesDb.getAllMovies()).rejects.toThrow(
        'Database error getting all movies: Database connection failed',
      );
    });
  });

  describe('getMovieDetails', () => {
    const movieId = 123;
    const mockMovieRow = {
      id: movieId,
      tmdb_id: 45678,
      title: 'The Test Movie',
      description: 'A movie about testing',
      release_date: '2023-04-15',
      runtime: 125,
      poster_image: '/poster_path.jpg',
      backdrop_image: '/backdrop_path.jpg',
      user_rating: 8.7,
      mpa_rating: 'PG-13',
      created_at: new Date('2023-04-01'),
      updated_at: new Date('2023-04-10'),
      genres: 'Action, Sci-Fi, Thriller',
      streaming_services: 'Netflix, HBO Max',
    };

    it('should return movie details when found', async () => {
      mockPool.execute.mockResolvedValueOnce([[mockMovieRow]]);

      const movie = await moviesDb.getMovieDetails(movieId);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM admin_movie_details WHERE id = ?', [movieId]);
      expect(movie).toEqual({
        id: movieId,
        tmdbId: 45678,
        title: 'The Test Movie',
        description: 'A movie about testing',
        releaseDate: '2023-04-15',
        runtime: 125,
        posterImage: '/poster_path.jpg',
        backdropImage: '/backdrop_path.jpg',
        userRating: 8.7,
        mpaRating: 'PG-13',
        streamingServices: 'Netflix, HBO Max',
        genres: 'Action, Sci-Fi, Thriller',
        lastUpdated: mockMovieRow.updated_at.toISOString(),
      });
    });

    it('should throw NotFoundError when movie is not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await expect(moviesDb.getMovieDetails(movieId)).rejects.toThrow(`Movie with ID ${movieId} not found`);
      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM admin_movie_details WHERE id = ?', [movieId]);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Query execution failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(moviesDb.getMovieDetails(movieId)).rejects.toThrow(
        'Database error getMovieDetails(123): Query execution failed',
      );
    });
  });

  describe('getMovieProfiles', () => {
    const movieId = 123;
    const mockProfiles = [
      {
        profile_id: 1,
        name: 'User One',
        image: 'profile1.jpg',
        account_id: 101,
        account_name: 'Account One',
        watch_status: 'WATCHED',
        added_date: new Date('2023-04-05'),
        status_updated_date: new Date('2023-04-06'),
      },
      {
        profile_id: 2,
        name: 'User Two',
        image: 'profile2.jpg',
        account_id: 102,
        account_name: 'Account Two',
        watch_status: 'WATCHING',
        added_date: new Date('2023-04-07'),
        status_updated_date: new Date('2023-04-08'),
      },
    ];

    it('should return profiles watching a movie', async () => {
      mockPool.execute.mockResolvedValueOnce([mockProfiles]);

      const profiles = await moviesDb.getMovieProfiles(movieId);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM admin_movie_profiles WHERE movie_id = ?', [movieId]);
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toEqual({
        profileId: 1,
        name: 'User One',
        image: 'profile1.jpg',
        accountId: 101,
        accountName: 'Account One',
        watchStatus: 'WATCHED',
        addedDate: mockProfiles[0].added_date.toISOString(),
        lastUpdated: mockProfiles[0].status_updated_date.toISOString(),
      });
      expect(profiles[1].watchStatus).toBe('WATCHING');
    });

    it('should return empty array when no profiles are found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const profiles = await moviesDb.getMovieProfiles(movieId);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM admin_movie_profiles WHERE movie_id = ?', [movieId]);
      expect(profiles).toEqual([]);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Query execution failed');
      mockPool.execute.mockRejectedValueOnce(dbError);

      await expect(moviesDb.getMovieProfiles(movieId)).rejects.toThrow(
        'Database error getMovieProfiles(123): Query execution failed',
      );
    });
  });
});
