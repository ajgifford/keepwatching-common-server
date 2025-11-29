import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getContentDepthStats } from '@db/statistics/contentDepthRepository';
import { RowDataPacket } from 'mysql2/promise';

describe('contentDepthRepository', () => {
  let mockConnection: any;
  let mockPool: any;
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockConnection = mocks.mockConnection;
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getContentDepthStats', () => {
    it('should return empty/zero stats when no data', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.averageEpisodeCountPerShow).toBe(0);
      expect(result.averageMovieRuntime).toBe(0);
      expect(result.releaseYearDistribution).toEqual({
        [`${currentYear - 4}-${currentYear}`]: 0,
        [`${currentYear - 9}-${currentYear - 5}`]: 0,
        [`${currentYear - 14}-${currentYear - 10}`]: 0,
        [`${currentYear - 24}-${currentYear - 15}`]: 0,
        [`Before ${currentYear - 24}`]: 0,
      });
      expect(result.contentMaturityDistribution).toEqual({});
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should calculate average episode count per show correctly', async () => {
      const mockShowDepthRows = [{ total_shows: 5, total_episodes: 50 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      // 50 episodes / 5 shows = 10.0
      expect(result.averageEpisodeCountPerShow).toBe(10.0);
    });

    it('should round average episode count to one decimal place', async () => {
      const mockShowDepthRows = [{ total_shows: 3, total_episodes: 10 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      // 10 episodes / 3 shows = 3.333... rounded to 3.3
      expect(result.averageEpisodeCountPerShow).toBe(3.3);
    });

    it('should calculate average movie runtime correctly', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 4, total_movie_runtime: 480 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      // 480 minutes / 4 movies = 120 minutes
      expect(result.averageMovieRuntime).toBe(120);
    });

    it('should round average movie runtime to integer', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 3, total_movie_runtime: 350 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      // 350 minutes / 3 movies = 116.666... rounded to 117
      expect(result.averageMovieRuntime).toBe(117);
    });

    it('should categorize release years into correct ranges', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [
        { release_year: currentYear, content_count: 2 },
        { release_year: currentYear - 2, content_count: 3 },
        { release_year: currentYear - 7, content_count: 1 },
        { release_year: currentYear - 12, content_count: 4 },
        { release_year: currentYear - 20, content_count: 2 },
        { release_year: currentYear - 30, content_count: 1 },
      ] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.releaseYearDistribution).toEqual({
        [`${currentYear - 4}-${currentYear}`]: 5, // currentYear + (currentYear - 2)
        [`${currentYear - 9}-${currentYear - 5}`]: 1, // currentYear - 7
        [`${currentYear - 14}-${currentYear - 10}`]: 4, // currentYear - 12
        [`${currentYear - 24}-${currentYear - 15}`]: 2, // currentYear - 20
        [`Before ${currentYear - 24}`]: 1, // currentYear - 30
      });
    });

    it('should combine release years from shows and movies', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [
        { release_year: currentYear, content_count: 2 },
        { release_year: currentYear - 10, content_count: 3 },
      ] as RowDataPacket[];
      const mockMovieYearRows = [
        { release_year: currentYear - 1, content_count: 4 },
        { release_year: currentYear - 10, content_count: 2 },
      ] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.releaseYearDistribution).toEqual({
        [`${currentYear - 4}-${currentYear}`]: 6, // 2 + 4
        [`${currentYear - 9}-${currentYear - 5}`]: 0,
        [`${currentYear - 14}-${currentYear - 10}`]: 5, // 3 + 2
        [`${currentYear - 24}-${currentYear - 15}`]: 0,
        [`Before ${currentYear - 24}`]: 0,
      });
    });

    it('should combine content ratings from shows and movies', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [
        { content_rating: 'TV-14', content_count: 5 },
        { content_rating: 'TV-MA', content_count: 3 },
      ] as RowDataPacket[];
      const mockMovieRatingRows = [
        { content_rating: 'PG-13', content_count: 7 },
        { content_rating: 'R', content_count: 4 },
      ] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.contentMaturityDistribution).toEqual({
        'TV-14': 5,
        'TV-MA': 3,
        'PG-13': 7,
        R: 4,
      });
    });

    it('should aggregate same ratings from shows and movies', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [
        { content_rating: 'PG', content_count: 5 },
        { content_rating: 'PG-13', content_count: 3 },
      ] as RowDataPacket[];
      const mockMovieRatingRows = [
        { content_rating: 'PG', content_count: 7 },
        { content_rating: 'R', content_count: 4 },
      ] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.contentMaturityDistribution).toEqual({
        PG: 12, // 5 + 7
        'PG-13': 3,
        R: 4,
      });
    });

    it('should handle null content ratings as "Not Rated"', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [
        { content_rating: null, content_count: 5 },
        { content_rating: 'TV-14', content_count: 3 },
      ] as RowDataPacket[];
      const mockMovieRatingRows = [
        { content_rating: null, content_count: 2 },
        { content_rating: 'PG-13', content_count: 4 },
      ] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.contentMaturityDistribution).toEqual({
        'Not Rated': 7, // 5 + 2
        'TV-14': 3,
        'PG-13': 4,
      });
    });

    it('should return complete stats with all data types', async () => {
      const mockShowDepthRows = [{ total_shows: 5, total_episodes: 50 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 10, total_movie_runtime: 1200 }] as RowDataPacket[];
      const mockShowYearRows = [{ release_year: currentYear - 2, content_count: 3 }] as RowDataPacket[];
      const mockMovieYearRows = [{ release_year: currentYear - 15, content_count: 2 }] as RowDataPacket[];
      const mockShowRatingRows = [{ content_rating: 'TV-14', content_count: 5 }] as RowDataPacket[];
      const mockMovieRatingRows = [{ content_rating: 'PG-13', content_count: 7 }] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(6);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result.averageEpisodeCountPerShow).toBe(10.0);
      expect(result.averageMovieRuntime).toBe(120);
      expect(result.releaseYearDistribution[`${currentYear - 4}-${currentYear}`]).toBe(3);
      expect(result.releaseYearDistribution[`${currentYear - 24}-${currentYear - 15}`]).toBe(2);
      expect(result.contentMaturityDistribution).toEqual({
        'TV-14': 5,
        'PG-13': 7,
      });
    });

    it('should handle zero shows without division by zero', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 10 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.averageEpisodeCountPerShow).toBe(0);
    });

    it('should handle zero movies without division by zero', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 500 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      expect(result.averageMovieRuntime).toBe(0);
    });

    it('should release connection on error in first query', async () => {
      const mockError = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(mockError);

      await expect(getContentDepthStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection on error in middle query', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockError = new Error('Database error');

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockRejectedValueOnce(mockError);

      await expect(getContentDepthStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profileId to all queries', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      await getContentDepthStats(456);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(1, expect.any(String), [456]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(2, expect.any(String), [456]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(3, expect.any(String), [456]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(4, expect.any(String), [456]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(5, expect.any(String), [456]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(6, expect.any(String), [456]);
    });

    it('should handle edge case with content at year boundary', async () => {
      const mockShowDepthRows = [{ total_shows: 0, total_episodes: 0 }] as RowDataPacket[];
      const mockMovieDepthRows = [{ total_movies: 0, total_movie_runtime: 0 }] as RowDataPacket[];
      const mockShowYearRows = [
        { release_year: currentYear - 4, content_count: 1 }, // exactly at boundary
        { release_year: currentYear - 5, content_count: 1 }, // exactly at next range
      ] as RowDataPacket[];
      const mockMovieYearRows = [] as RowDataPacket[];
      const mockShowRatingRows = [] as RowDataPacket[];
      const mockMovieRatingRows = [] as RowDataPacket[];

      mockConnection.execute
        .mockResolvedValueOnce([mockShowDepthRows])
        .mockResolvedValueOnce([mockMovieDepthRows])
        .mockResolvedValueOnce([mockShowYearRows])
        .mockResolvedValueOnce([mockMovieYearRows])
        .mockResolvedValueOnce([mockShowRatingRows])
        .mockResolvedValueOnce([mockMovieRatingRows]);

      const result = await getContentDepthStats(123);

      // currentYear - 4 should be in the most recent range
      expect(result.releaseYearDistribution[`${currentYear - 4}-${currentYear}`]).toBe(1);
      // currentYear - 5 should be in the next range
      expect(result.releaseYearDistribution[`${currentYear - 9}-${currentYear - 5}`]).toBe(1);
    });
  });
});
