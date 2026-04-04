import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getProfileRewatchStats, getAccountRewatchStats } from '@db/statistics/rewatchRepository';

describe('rewatchRepository', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getProfileRewatchStats
  // ---------------------------------------------------------------------------

  describe('getProfileRewatchStats()', () => {
    it('should return aggregated totals and top-10 lists for a profile', async () => {
      const showTotalRows = [{ total: 5 }];
      const movieTotalRows = [{ total: 3 }];
      const showRows = [
        { show_id: 1, show_title: 'Breaking Bad', rewatch_count: 3 },
        { show_id: 2, show_title: 'The Wire', rewatch_count: 2 },
      ];
      const movieRows = [{ movie_id: 10, movie_title: 'Inception', rewatch_count: 3 }];

      mockPool.execute
        .mockResolvedValueOnce([showTotalRows])
        .mockResolvedValueOnce([movieTotalRows])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows]);

      const result = await getProfileRewatchStats(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        totalShowRewatches: 5,
        totalMovieRewatches: 3,
        mostRewatchedShows: [
          { showId: 1, showTitle: 'Breaking Bad', rewatchCount: 3 },
          { showId: 2, showTitle: 'The Wire', rewatchCount: 2 },
        ],
        mostRewatchedMovies: [{ movieId: 10, movieTitle: 'Inception', rewatchCount: 3 }],
      });
    });

    it('should return zero totals and empty lists when there are no rewatches', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(123);

      expect(result).toEqual({
        totalShowRewatches: 0,
        totalMovieRewatches: 0,
        mostRewatchedShows: [],
        mostRewatchedMovies: [],
      });
    });

    it('should query show_watch_status and movie_watch_status with the profileId', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileRewatchStats(456);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('show_watch_status');
      expect(calls[0][1]).toEqual([456]);
      expect(calls[1][0]).toContain('movie_watch_status');
      expect(calls[1][1]).toEqual([456]);
      expect(calls[2][0]).toContain('ORDER BY sws.rewatch_count DESC');
      expect(calls[2][1]).toEqual([456]);
      expect(calls[3][0]).toContain('ORDER BY mws.rewatch_count DESC');
      expect(calls[3][1]).toEqual([456]);
    });

    it('should limit top rewatch lists to 10 entries', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileRewatchStats(1);

      expect(mockPool.execute.mock.calls[2][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[3][0]).toContain('LIMIT 10');
    });

    it('should coerce numeric total to 0 when total is falsy', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(1);

      expect(result.totalShowRewatches).toBe(0);
      expect(result.totalMovieRewatches).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getAccountRewatchStats
  // ---------------------------------------------------------------------------

  describe('getAccountRewatchStats()', () => {
    it('should return aggregated totals and top-10 lists with profile names for an account', async () => {
      const showTotalRows = [{ total: 8 }];
      const movieTotalRows = [{ total: 4 }];
      const showRows = [{ show_id: 1, show_title: 'The Sopranos', rewatch_count: 4, profile_name: 'Alice' }];
      const movieRows = [{ movie_id: 20, movie_title: 'The Matrix', rewatch_count: 4, profile_name: 'Bob' }];

      mockPool.execute
        .mockResolvedValueOnce([showTotalRows])
        .mockResolvedValueOnce([movieTotalRows])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows]);

      const result = await getAccountRewatchStats(7);

      expect(mockPool.execute).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        totalShowRewatches: 8,
        totalMovieRewatches: 4,
        mostRewatchedShows: [{ showId: 1, showTitle: 'The Sopranos', rewatchCount: 4, profileName: 'Alice' }],
        mostRewatchedMovies: [{ movieId: 20, movieTitle: 'The Matrix', rewatchCount: 4, profileName: 'Bob' }],
      });
    });

    it('should return zero totals and empty lists when there are no rewatches', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getAccountRewatchStats(7);

      expect(result).toEqual({
        totalShowRewatches: 0,
        totalMovieRewatches: 0,
        mostRewatchedShows: [],
        mostRewatchedMovies: [],
      });
    });

    it('should join profiles table and filter by account_id', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getAccountRewatchStats(99);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('JOIN profiles p');
      expect(calls[0][0]).toContain('p.account_id = ?');
      expect(calls[0][1]).toEqual([99]);
      expect(calls[1][0]).toContain('JOIN profiles p');
      expect(calls[1][0]).toContain('p.account_id = ?');
      expect(calls[1][1]).toEqual([99]);
      expect(calls[2][0]).toContain('p.name AS profile_name');
      expect(calls[3][0]).toContain('p.name AS profile_name');
    });

    it('should limit top rewatch lists to 10 entries', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getAccountRewatchStats(1);

      expect(mockPool.execute.mock.calls[2][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[3][0]).toContain('LIMIT 10');
    });

    it('should handle multiple rewatched shows and movies across profiles', async () => {
      const showRows = [
        { show_id: 1, show_title: 'Show A', rewatch_count: 5, profile_name: 'Alice' },
        { show_id: 2, show_title: 'Show B', rewatch_count: 3, profile_name: 'Bob' },
      ];
      const movieRows = [
        { movie_id: 10, movie_title: 'Movie X', rewatch_count: 4, profile_name: 'Alice' },
        { movie_id: 11, movie_title: 'Movie Y', rewatch_count: 2, profile_name: 'Carol' },
      ];

      mockPool.execute
        .mockResolvedValueOnce([[{ total: 8 }]])
        .mockResolvedValueOnce([[{ total: 6 }]])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows]);

      const result = await getAccountRewatchStats(1);

      expect(result.mostRewatchedShows).toHaveLength(2);
      expect(result.mostRewatchedMovies).toHaveLength(2);
      expect(result.mostRewatchedShows[0]).toMatchObject({ showId: 1, profileName: 'Alice' });
      expect(result.mostRewatchedMovies[1]).toMatchObject({ movieId: 11, profileName: 'Carol' });
    });
  });
});
