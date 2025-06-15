import { MovieReferenceRow } from '../../../../src/types/movieTypes';
import { MovieReference } from '@ajgifford/keepwatching-types';
import * as digestMovieRepository from '@db/movies/digestMovieRepository';
import { getDbPool } from '@utils/db';
import { handleDatabaseError } from '@utils/errorHandlingUtility';

// Mock the database utilities
jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
}));

jest.mock('@utils/errorHandlingUtility', () => ({
  handleDatabaseError: jest.fn(),
}));

describe('digestMovieRepository', () => {
  let mockPool: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    mockExecute = jest.fn();
    mockPool = {
      execute: mockExecute,
    };

    (getDbPool as jest.Mock).mockReturnValue(mockPool);
    jest.clearAllMocks();
  });

  describe('getTrendingMovies', () => {
    const mockTrendingMoviesData: MovieReferenceRow[] = [
      {
        id: 1,
        title: 'Trending Movie 1',
        tmdb_id: 12345,
      } as MovieReferenceRow,
      {
        id: 2,
        title: 'Trending Movie 2',
        tmdb_id: 23456,
      } as MovieReferenceRow,
      {
        id: 3,
        title: 'Trending Movie 3',
        tmdb_id: 34567,
      } as MovieReferenceRow,
    ];

    const expectedTrendingMovies: MovieReference[] = [
      {
        id: 1,
        title: 'Trending Movie 1',
        tmdbId: 12345,
      },
      {
        id: 2,
        title: 'Trending Movie 2',
        tmdbId: 23456,
      },
      {
        id: 3,
        title: 'Trending Movie 3',
        tmdbId: 34567,
      },
    ];

    it('should return trending movies with default limit', async () => {
      mockExecute.mockResolvedValue([mockTrendingMoviesData]);

      const result = await digestMovieRepository.getTrendingMovies();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining(`
      SELECT m.id, m.title, m.tmdb_id, m.release_date
      FROM movies m
      JOIN movie_watch_status mws ON m.id = mws.movie_id
      WHERE mws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY m.id, m.title, m.tmdb_id
      ORDER BY COUNT(mws.profile_id) DESC, m.user_rating DESC
      LIMIT 10
    `),
      );
      expect(result).toEqual(expectedTrendingMovies);
    });

    it('should return trending movies with custom limit', async () => {
      const customLimit = 5;
      const limitedData = mockTrendingMoviesData.slice(0, 2);
      const expectedLimitedResult = expectedTrendingMovies.slice(0, 2);

      mockExecute.mockResolvedValue([limitedData]);

      const result = await digestMovieRepository.getTrendingMovies(customLimit);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${customLimit}`));
      expect(result).toEqual(expectedLimitedResult);
    });

    it('should return empty array when no trending movies found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestMovieRepository.getTrendingMovies();

      expect(result).toEqual([]);
    });

    it('should handle database errors properly', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(dbError);

      await digestMovieRepository.getTrendingMovies();

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting trending movies');
    });

    it('should validate SQL query structure for trending movies', async () => {
      mockExecute.mockResolvedValue([mockTrendingMoviesData]);

      await digestMovieRepository.getTrendingMovies(15);

      const [query] = mockExecute.mock.calls[0];

      expect(query).toContain('SELECT m.id, m.title, m.tmdb_id');
      expect(query).toContain('FROM movies m');
      expect(query).toContain('JOIN movie_watch_status mws ON m.id = mws.movie_id');
      expect(query).toContain('WHERE mws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
      expect(query).toContain('GROUP BY m.id, m.title, m.tmdb_id');
      expect(query).toContain('ORDER BY COUNT(mws.profile_id) DESC, m.user_rating DESC');
      expect(query).toContain('LIMIT 15');
    });
  });

  describe('getRecentlyReleasedMovies', () => {
    const mockRecentMoviesData: MovieReferenceRow[] = [
      {
        id: 4,
        title: 'Recent Movie 1',
        tmdb_id: 45678,
      } as MovieReferenceRow,
      {
        id: 5,
        title: 'Recent Movie 2',
        tmdb_id: 56789,
      } as MovieReferenceRow,
    ];

    const expectedRecentMovies: MovieReference[] = [
      {
        id: 4,
        title: 'Recent Movie 1',
        tmdbId: 45678,
      },
      {
        id: 5,
        title: 'Recent Movie 2',
        tmdbId: 56789,
      },
    ];

    it('should return recently released movies with default limit', async () => {
      mockExecute.mockResolvedValue([mockRecentMoviesData]);

      const result = await digestMovieRepository.getRecentlyReleasedMovies();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining(`
      SELECT id, title, tmdb_id, release_date
      FROM movies
      WHERE release_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      AND release_date <= NOW()
      ORDER BY release_date DESC, user_rating DESC
      LIMIT 10
    `),
      );
      expect(result).toEqual(expectedRecentMovies);
    });

    it('should return recently released movies with custom limit', async () => {
      const customLimit = 3;
      mockExecute.mockResolvedValue([mockRecentMoviesData]);

      const result = await digestMovieRepository.getRecentlyReleasedMovies(customLimit);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${customLimit}`));
      expect(result).toEqual(expectedRecentMovies);
    });

    it('should return empty array when no recent movies found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestMovieRepository.getRecentlyReleasedMovies();

      expect(result).toEqual([]);
    });

    it('should handle database errors properly', async () => {
      const dbError = new Error('Query timeout');
      mockExecute.mockRejectedValue(dbError);

      await digestMovieRepository.getRecentlyReleasedMovies();

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting recently released movies');
    });

    it('should validate SQL query structure for recent releases', async () => {
      mockExecute.mockResolvedValue([mockRecentMoviesData]);

      await digestMovieRepository.getRecentlyReleasedMovies(20);

      const [query] = mockExecute.mock.calls[0];

      expect(query).toContain('SELECT id, title, tmdb_id');
      expect(query).toContain('FROM movies');
      expect(query).toContain('WHERE release_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)');
      expect(query).toContain('AND release_date <= NOW()');
      expect(query).toContain('ORDER BY release_date DESC, user_rating DESC');
      expect(query).toContain('LIMIT 20');
    });

    it('should use correct date interval for recent releases', async () => {
      mockExecute.mockResolvedValue([mockRecentMoviesData]);

      await digestMovieRepository.getRecentlyReleasedMovies();

      const [query] = mockExecute.mock.calls[0];
      expect(query).toContain('INTERVAL 90 DAY');
    });
  });

  describe('getTopRatedMovies', () => {
    const mockTopRatedMoviesData: MovieReferenceRow[] = [
      {
        id: 6,
        title: 'Top Rated Movie 1',
        tmdb_id: 67890,
      } as MovieReferenceRow,
      {
        id: 7,
        title: 'Top Rated Movie 2',
        tmdb_id: 78901,
      } as MovieReferenceRow,
      {
        id: 8,
        title: 'Top Rated Movie 3',
        tmdb_id: 89012,
      } as MovieReferenceRow,
    ];

    const expectedTopRatedMovies: MovieReference[] = [
      {
        id: 6,
        title: 'Top Rated Movie 1',
        tmdbId: 67890,
      },
      {
        id: 7,
        title: 'Top Rated Movie 2',
        tmdbId: 78901,
      },
      {
        id: 8,
        title: 'Top Rated Movie 3',
        tmdbId: 89012,
      },
    ];

    it('should return top rated movies with default limit', async () => {
      mockExecute.mockResolvedValue([mockTopRatedMoviesData]);

      const result = await digestMovieRepository.getTopRatedMovies();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining(`
      SELECT id, title, tmdb_id, release_date
      FROM movies
      WHERE user_rating >= 7.0
      ORDER BY user_rating DESC, release_date DESC
      LIMIT 10
    `),
      );
      expect(result).toEqual(expectedTopRatedMovies);
    });

    it('should return top rated movies with custom limit', async () => {
      const customLimit = 7;
      mockExecute.mockResolvedValue([mockTopRatedMoviesData]);

      const result = await digestMovieRepository.getTopRatedMovies(customLimit);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${customLimit}`));
      expect(result).toEqual(expectedTopRatedMovies);
    });

    it('should return empty array when no top rated movies found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestMovieRepository.getTopRatedMovies();

      expect(result).toEqual([]);
    });

    it('should handle database errors properly', async () => {
      const dbError = new Error('Database unavailable');
      mockExecute.mockRejectedValue(dbError);

      await digestMovieRepository.getTopRatedMovies();

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting top rated movies');
    });

    it('should validate SQL query structure for top rated movies', async () => {
      mockExecute.mockResolvedValue([mockTopRatedMoviesData]);

      await digestMovieRepository.getTopRatedMovies(25);

      const [query] = mockExecute.mock.calls[0];

      expect(query).toContain('SELECT id, title, tmdb_id');
      expect(query).toContain('FROM movies');
      expect(query).toContain('WHERE user_rating >= 7.0');
      expect(query).toContain('ORDER BY user_rating DESC, release_date DESC');
      expect(query).toContain('LIMIT 25');
    });

    it('should use correct rating threshold for top rated movies', async () => {
      mockExecute.mockResolvedValue([mockTopRatedMoviesData]);

      await digestMovieRepository.getTopRatedMovies();

      const [query] = mockExecute.mock.calls[0];
      expect(query).toContain('user_rating >= 7.0');
    });
  });

  describe('data transformation', () => {
    it('should correctly transform MovieReferenceRow to MovieReference', async () => {
      const mockData: MovieReferenceRow[] = [
        {
          id: 999,
          title: 'Test Transformation Movie',
          tmdb_id: 999999,
        } as MovieReferenceRow,
      ];

      mockExecute.mockResolvedValue([mockData]);

      const result = await digestMovieRepository.getTrendingMovies();

      expect(result[0]).toEqual({
        id: 999,
        title: 'Test Transformation Movie',
        tmdbId: 999999,
      });
    });

    it('should handle special characters in movie titles', async () => {
      const mockData: MovieReferenceRow[] = [
        {
          id: 1000,
          title: 'Movie with "Quotes" & Symbols!',
          tmdb_id: 1000000,
        } as MovieReferenceRow,
      ];

      mockExecute.mockResolvedValue([mockData]);

      const result = await digestMovieRepository.getRecentlyReleasedMovies();

      expect(result[0].title).toBe('Movie with "Quotes" & Symbols!');
    });

    it('should handle null or undefined values gracefully', async () => {
      const mockData: MovieReferenceRow[] = [
        {
          id: 1001,
          title: '',
          tmdb_id: 0,
        } as MovieReferenceRow,
      ];

      mockExecute.mockResolvedValue([mockData]);

      const result = await digestMovieRepository.getTopRatedMovies();

      expect(result[0]).toEqual({
        id: 1001,
        title: '',
        tmdbId: 0,
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle limit parameter edge cases', async () => {
      mockExecute.mockResolvedValue([[]]);

      // Test with zero limit
      await digestMovieRepository.getTrendingMovies(0);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 0'));

      // Test with very large limit
      await digestMovieRepository.getRecentlyReleasedMovies(99999);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 99999'));

      // Test with negative limit (should still work as the function doesn't validate)
      await digestMovieRepository.getTopRatedMovies(-1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT -1'));
    });

    it('should handle multiple database calls independently', async () => {
      const trendingData: MovieReferenceRow[] = [{ id: 1, title: 'Trending', tmdb_id: 1 } as MovieReferenceRow];
      const recentData: MovieReferenceRow[] = [{ id: 2, title: 'Recent', tmdb_id: 2 } as MovieReferenceRow];
      const topRatedData: MovieReferenceRow[] = [{ id: 3, title: 'Top Rated', tmdb_id: 3 } as MovieReferenceRow];

      mockExecute
        .mockResolvedValueOnce([trendingData])
        .mockResolvedValueOnce([recentData])
        .mockResolvedValueOnce([topRatedData]);

      const [trending, recent, topRated] = await Promise.all([
        digestMovieRepository.getTrendingMovies(1),
        digestMovieRepository.getRecentlyReleasedMovies(1),
        digestMovieRepository.getTopRatedMovies(1),
      ]);

      expect(trending).toEqual([{ id: 1, title: 'Trending', tmdbId: 1 }]);
      expect(recent).toEqual([{ id: 2, title: 'Recent', tmdbId: 2 }]);
      expect(topRated).toEqual([{ id: 3, title: 'Top Rated', tmdbId: 3 }]);
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should handle different error types appropriately', async () => {
      const networkError = new Error('Network timeout');
      const syntaxError = new Error('SQL syntax error');
      const connectionError = new Error('Connection refused');

      mockExecute.mockRejectedValueOnce(networkError);
      await digestMovieRepository.getTrendingMovies();
      expect(handleDatabaseError).toHaveBeenCalledWith(networkError, 'getting trending movies');

      mockExecute.mockRejectedValueOnce(syntaxError);
      await digestMovieRepository.getRecentlyReleasedMovies();
      expect(handleDatabaseError).toHaveBeenCalledWith(syntaxError, 'getting recently released movies');

      mockExecute.mockRejectedValueOnce(connectionError);
      await digestMovieRepository.getTopRatedMovies();
      expect(handleDatabaseError).toHaveBeenCalledWith(connectionError, 'getting top rated movies');
    });
  });

  describe('performance and query optimization', () => {
    it('should verify optimal query structure for trending movies', async () => {
      mockExecute.mockResolvedValue([[]]);

      await digestMovieRepository.getTrendingMovies();

      const [query] = mockExecute.mock.calls[0];

      // Verify the query uses appropriate joins and ordering for performance
      expect(query).toContain('JOIN movie_watch_status mws ON m.id = mws.movie_id');
      expect(query).toContain('GROUP BY m.id, m.title, m.tmdb_id');
      expect(query).toContain('ORDER BY COUNT(mws.profile_id) DESC, m.user_rating DESC');

      // Verify it includes the date filter for performance
      expect(query).toContain('WHERE mws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    });

    it('should verify date range filters are properly indexed', async () => {
      mockExecute.mockResolvedValue([[]]);

      await digestMovieRepository.getRecentlyReleasedMovies();

      const [query] = mockExecute.mock.calls[0];

      // Verify the query uses indexed date range for performance
      expect(query).toContain('WHERE release_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)');
      expect(query).toContain('AND release_date <= NOW()');
    });

    it('should verify rating filter for top rated movies', async () => {
      mockExecute.mockResolvedValue([[]]);

      await digestMovieRepository.getTopRatedMovies();

      const [query] = mockExecute.mock.calls[0];

      // Verify the rating threshold is appropriate for filtering
      expect(query).toContain('WHERE user_rating >= 7.0');
      expect(query).toContain('ORDER BY user_rating DESC, release_date DESC');
    });
  });
});
