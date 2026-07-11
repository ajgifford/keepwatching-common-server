import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getAccountRewatchStats, getProfileRewatchStats } from '@db/statistics/rewatchRepository';

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
      const episodeTotalRows = [{ total: 4 }];
      const episodeRows = [
        {
          episode_id: 100,
          show_id: 1,
          show_title: 'Breaking Bad',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Pilot',
          rewatch_count: 4,
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([showTotalRows])
        .mockResolvedValueOnce([movieTotalRows])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows])
        .mockResolvedValueOnce([episodeTotalRows])
        .mockResolvedValueOnce([episodeRows])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(7);
      expect(result).toEqual({
        totalShowRewatches: 5,
        totalMovieRewatches: 3,
        totalEpisodeRewatches: 4,
        mostRewatchedShows: [
          { showId: 1, showTitle: 'Breaking Bad', rewatchCount: 3 },
          { showId: 2, showTitle: 'The Wire', rewatchCount: 2 },
        ],
        mostRewatchedMovies: [{ movieId: 10, movieTitle: 'Inception', rewatchCount: 3 }],
        mostRewatchedEpisodes: [
          {
            episodeId: 100,
            showId: 1,
            showTitle: 'Breaking Bad',
            seasonNumber: 1,
            episodeNumber: 1,
            episodeTitle: 'Pilot',
            rewatchCount: 4,
          },
        ],
        topRewatchedShowsByEpisodes: [],
      });
    });

    it('should return zero totals and empty lists when there are no rewatches', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(123);

      expect(result).toEqual({
        totalShowRewatches: 0,
        totalMovieRewatches: 0,
        totalEpisodeRewatches: 0,
        mostRewatchedShows: [],
        mostRewatchedMovies: [],
        mostRewatchedEpisodes: [],
        topRewatchedShowsByEpisodes: [],
      });
    });

    it('should query show_watch_status, movie_watch_status, and episode_watch_history with the profileId', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
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
      expect(calls[4][0]).toContain('episode_watch_history');
      expect(calls[4][1]).toEqual([456]);
      expect(calls[5][0]).toContain('ORDER BY rewatch_count DESC');
      expect(calls[5][1]).toEqual([456]);
      expect(calls[6][0]).toContain('episode_watch_history');
      expect(calls[6][0]).toContain('ORDER BY total_rewatch_count DESC');
      expect(calls[6][1]).toEqual([456]);
    });

    it('should limit top rewatch lists to 10 entries and top shows to 5', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileRewatchStats(1);

      expect(mockPool.execute.mock.calls[2][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[3][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[5][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[6][0]).toContain('LIMIT 5');
    });

    it('should coerce numeric total to 0 when total is falsy', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(1);

      expect(result.totalShowRewatches).toBe(0);
      expect(result.totalMovieRewatches).toBe(0);
      expect(result.totalEpisodeRewatches).toBe(0);
    });

    it('should exclude single-watch episodes from the most-rewatched episode list', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getProfileRewatchStats(1);

      expect(mockPool.execute.mock.calls[5][0]).toContain('HAVING COUNT(*) > 1');
    });

    it('should not issue a follow-up query when no shows have rewatched episodes', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileRewatchStats(1);

      expect(mockPool.execute).toHaveBeenCalledTimes(7);
      expect(result.topRewatchedShowsByEpisodes).toEqual([]);
    });

    it('should group episodes by show and slice to the top 3 per show for topRewatchedShowsByEpisodes', async () => {
      const showEpisodeSummaryRows = [
        { show_id: 1, show_title: 'Sirens', total_episodes_rewatched: 2, total_rewatch_count: 6 },
      ];
      const showEpisodeRows = [
        {
          episode_id: 1,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Exile',
          rewatch_count: 3,
        },
        {
          episode_id: 2,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 2,
          episode_title: 'Talons',
          rewatch_count: 3,
        },
        {
          episode_id: 3,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 3,
          episode_title: 'Low',
          rewatch_count: 1,
        },
        {
          episode_id: 4,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 4,
          episode_title: 'Tide',
          rewatch_count: 1,
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([showEpisodeSummaryRows])
        .mockResolvedValueOnce([showEpisodeRows]);

      const result = await getProfileRewatchStats(1);

      expect(mockPool.execute).toHaveBeenCalledTimes(8);
      const followUpCall = mockPool.execute.mock.calls[7];
      expect(followUpCall[0]).toContain('e.show_id IN (?)');
      expect(followUpCall[1]).toEqual([1, 1]);

      expect(result.topRewatchedShowsByEpisodes).toEqual([
        {
          showId: 1,
          showTitle: 'Sirens',
          totalEpisodesRewatched: 2,
          totalRewatchCount: 6,
          topEpisodes: [
            {
              episodeId: 1,
              showId: 1,
              showTitle: 'Sirens',
              seasonNumber: 1,
              episodeNumber: 1,
              episodeTitle: 'Exile',
              rewatchCount: 3,
            },
            {
              episodeId: 2,
              showId: 1,
              showTitle: 'Sirens',
              seasonNumber: 1,
              episodeNumber: 2,
              episodeTitle: 'Talons',
              rewatchCount: 3,
            },
            {
              episodeId: 3,
              showId: 1,
              showTitle: 'Sirens',
              seasonNumber: 1,
              episodeNumber: 3,
              episodeTitle: 'Low',
              rewatchCount: 1,
            },
          ],
        },
      ]);
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
      const episodeTotalRows = [{ total: 6 }];
      const episodeRows = [
        {
          episode_id: 200,
          show_id: 1,
          show_title: 'The Sopranos',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Pilot',
          rewatch_count: 6,
          profile_name: 'Alice',
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([showTotalRows])
        .mockResolvedValueOnce([movieTotalRows])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows])
        .mockResolvedValueOnce([episodeTotalRows])
        .mockResolvedValueOnce([episodeRows])
        .mockResolvedValueOnce([[]]);

      const result = await getAccountRewatchStats(7);

      expect(mockPool.execute).toHaveBeenCalledTimes(7);
      expect(result).toEqual({
        totalShowRewatches: 8,
        totalMovieRewatches: 4,
        totalEpisodeRewatches: 6,
        mostRewatchedShows: [{ showId: 1, showTitle: 'The Sopranos', rewatchCount: 4, profileName: 'Alice' }],
        mostRewatchedMovies: [{ movieId: 20, movieTitle: 'The Matrix', rewatchCount: 4, profileName: 'Bob' }],
        mostRewatchedEpisodes: [
          {
            episodeId: 200,
            showId: 1,
            showTitle: 'The Sopranos',
            seasonNumber: 1,
            episodeNumber: 1,
            episodeTitle: 'Pilot',
            rewatchCount: 6,
            profileName: 'Alice',
          },
        ],
        topRewatchedShowsByEpisodes: [],
      });
    });

    it('should return zero totals and empty lists when there are no rewatches', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getAccountRewatchStats(7);

      expect(result).toEqual({
        totalShowRewatches: 0,
        totalMovieRewatches: 0,
        totalEpisodeRewatches: 0,
        mostRewatchedShows: [],
        mostRewatchedMovies: [],
        mostRewatchedEpisodes: [],
        topRewatchedShowsByEpisodes: [],
      });
    });

    it('should join profiles table and filter by account_id', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
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
      expect(calls[4][0]).toContain('JOIN profiles p');
      expect(calls[4][0]).toContain('p.account_id = ?');
      expect(calls[4][1]).toEqual([99]);
      expect(calls[5][0]).toContain('p.name AS profile_name');
      expect(calls[5][1]).toEqual([99]);
      expect(calls[6][0]).toContain('p.name AS profile_name');
      expect(calls[6][0]).toContain('pr.account_id = ?');
      expect(calls[6][1]).toEqual([99]);
    });

    it('should limit top rewatch lists to 10 entries and top shows to 5', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await getAccountRewatchStats(1);

      expect(mockPool.execute.mock.calls[2][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[3][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[5][0]).toContain('LIMIT 10');
      expect(mockPool.execute.mock.calls[6][0]).toContain('LIMIT 5');
    });

    it('should handle multiple rewatched shows, movies, and episodes across profiles', async () => {
      const showRows = [
        { show_id: 1, show_title: 'Show A', rewatch_count: 5, profile_name: 'Alice' },
        { show_id: 2, show_title: 'Show B', rewatch_count: 3, profile_name: 'Bob' },
      ];
      const movieRows = [
        { movie_id: 10, movie_title: 'Movie X', rewatch_count: 4, profile_name: 'Alice' },
        { movie_id: 11, movie_title: 'Movie Y', rewatch_count: 2, profile_name: 'Carol' },
      ];
      const episodeRows = [
        {
          episode_id: 100,
          show_id: 1,
          show_title: 'Show A',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Pilot',
          rewatch_count: 3,
          profile_name: 'Alice',
        },
        {
          episode_id: 101,
          show_id: 2,
          show_title: 'Show B',
          season_number: 1,
          episode_number: 2,
          episode_title: 'Second',
          rewatch_count: 2,
          profile_name: 'Bob',
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([[{ total: 8 }]])
        .mockResolvedValueOnce([[{ total: 6 }]])
        .mockResolvedValueOnce([showRows])
        .mockResolvedValueOnce([movieRows])
        .mockResolvedValueOnce([[{ total: 5 }]])
        .mockResolvedValueOnce([episodeRows])
        .mockResolvedValueOnce([[]]);

      const result = await getAccountRewatchStats(1);

      expect(result.mostRewatchedShows).toHaveLength(2);
      expect(result.mostRewatchedMovies).toHaveLength(2);
      expect(result.mostRewatchedEpisodes).toHaveLength(2);
      expect(result.mostRewatchedShows[0]).toMatchObject({ showId: 1, profileName: 'Alice' });
      expect(result.mostRewatchedMovies[1]).toMatchObject({ movieId: 11, profileName: 'Carol' });
      expect(result.mostRewatchedEpisodes[1]).toMatchObject({ episodeId: 101, profileName: 'Bob' });
    });

    it('should attribute topRewatchedShowsByEpisodes per (show, profile) pair and dedupe show IDs in the follow-up query', async () => {
      const showEpisodeSummaryRows = [
        {
          show_id: 1,
          show_title: 'Sirens',
          profile_name: 'Alice',
          total_episodes_rewatched: 1,
          total_rewatch_count: 3,
        },
        { show_id: 1, show_title: 'Sirens', profile_name: 'Bob', total_episodes_rewatched: 1, total_rewatch_count: 2 },
      ];
      const showEpisodeRows = [
        {
          episode_id: 1,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Exile',
          rewatch_count: 3,
          profile_name: 'Alice',
        },
        {
          episode_id: 1,
          show_id: 1,
          show_title: 'Sirens',
          season_number: 1,
          episode_number: 1,
          episode_title: 'Exile',
          rewatch_count: 2,
          profile_name: 'Bob',
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([showEpisodeSummaryRows])
        .mockResolvedValueOnce([showEpisodeRows]);

      const result = await getAccountRewatchStats(1);

      const followUpCall = mockPool.execute.mock.calls[7];
      expect(followUpCall[0]).toContain('e.show_id IN (?)');
      expect(followUpCall[1]).toEqual([1, 1]);

      expect(result.topRewatchedShowsByEpisodes).toEqual([
        {
          showId: 1,
          showTitle: 'Sirens',
          profileName: 'Alice',
          totalEpisodesRewatched: 1,
          totalRewatchCount: 3,
          topEpisodes: [
            {
              episodeId: 1,
              showId: 1,
              showTitle: 'Sirens',
              seasonNumber: 1,
              episodeNumber: 1,
              episodeTitle: 'Exile',
              rewatchCount: 3,
            },
          ],
        },
        {
          showId: 1,
          showTitle: 'Sirens',
          profileName: 'Bob',
          totalEpisodesRewatched: 1,
          totalRewatchCount: 2,
          topEpisodes: [
            {
              episodeId: 1,
              showId: 1,
              showTitle: 'Sirens',
              seasonNumber: 1,
              episodeNumber: 1,
              episodeTitle: 'Exile',
              rewatchCount: 2,
            },
          ],
        },
      ]);
    });
  });
});
