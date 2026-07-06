import { setupDatabaseTest } from './helpers/dbTestSetup';
import {
  getEpisodeIdsWithExistingHistory,
  getEpisodeWatchCount,
  getShowIdForSeason,
  getWatchHistoryForProfile,
  hasMovieHistoryRow,
  logEpisodeWatched,
  logEpisodesWatched,
  logMovieWatched,
  logSeasonWatched,
  logShowWatched,
  markEpisodesHistoryAsPrior,
  markEpisodesHistoryAsPriorPreservingDate,
  markMostRecentEpisodeHistoryAsPrior,
  markMostRecentEpisodeHistoryAsPriorPreservingDate,
  recalculateShowStatusAfterSeasonReset,
  recordEpisodeRewatch,
  recordMovieRewatch,
  resetSeasonForRewatch,
  resetShowForRewatch,
} from '@db/watchHistoryDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/errorHandlingUtility');

describe('watchHistoryDb Module', () => {
  let mockPool: any;
  let mockConn: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;

    mockConn = { execute: jest.fn() };

    jest.mocked(handleDatabaseError).mockImplementation((error, context) => {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error ${context}: ${msg}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // logEpisodeWatched
  // ---------------------------------------------------------------------------

  describe('logEpisodeWatched()', () => {
    it('should insert a history row with defaults (isPriorWatch=false, watchedAt=null)', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logEpisodeWatched(mockConn, 1, 100);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO episode_watch_history'), [
        1,
        100,
        null,
        false,
        1,
        100,
      ]);
    });

    it('should pass watchedAt and isPriorWatch when provided', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logEpisodeWatched(mockConn, 2, 200, true, '2024-01-15');

      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO episode_watch_history'), [
        2,
        200,
        '2024-01-15',
        true,
        2,
        200,
      ]);
    });

    it('should use null for watchedAt when not provided even with isPriorWatch=true', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logEpisodeWatched(mockConn, 1, 100, true);

      expect(mockConn.execute).toHaveBeenCalledWith(expect.any(String), [1, 100, null, true, 1, 100]);
    });
  });

  // ---------------------------------------------------------------------------
  // logEpisodesWatched
  // ---------------------------------------------------------------------------

  describe('logEpisodesWatched()', () => {
    it('should call logEpisodeWatched once per episode ID', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await logEpisodesWatched(mockConn, 1, [10, 20, 30]);

      expect(mockConn.execute).toHaveBeenCalledTimes(3);
      expect(mockConn.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO episode_watch_history'),
        [1, 10, null, false, 1, 10],
      );
      expect(mockConn.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO episode_watch_history'),
        [1, 20, null, false, 1, 20],
      );
      expect(mockConn.execute).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO episode_watch_history'),
        [1, 30, null, false, 1, 30],
      );
    });

    it('should not call execute when episodeIds is empty', async () => {
      await logEpisodesWatched(mockConn, 1, []);

      expect(mockConn.execute).not.toHaveBeenCalled();
    });

    it('should forward isPriorWatch=true to each episode', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await logEpisodesWatched(mockConn, 5, [99], true);

      expect(mockConn.execute).toHaveBeenCalledWith(expect.any(String), [5, 99, null, true, 5, 99]);
    });
  });

  // ---------------------------------------------------------------------------
  // markMostRecentEpisodeHistoryAsPrior
  // ---------------------------------------------------------------------------

  describe('markMostRecentEpisodeHistoryAsPrior()', () => {
    it('should update the most recent history row with is_prior_watch=TRUE and the given watchedAt', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await markMostRecentEpisodeHistoryAsPrior(mockConn, 1, 100, '2024-01-15');

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('UPDATE episode_watch_history');
      expect(sql).toContain('is_prior_watch = TRUE');
      expect(sql).toContain('watched_at = ?');
      expect(sql).toContain('MAX(id)');
      expect(params).toEqual(['2024-01-15', 1, 100, 1, 100]);
    });

    it('should be a no-op (zero affected rows) when no matching history row exists', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(markMostRecentEpisodeHistoryAsPrior(mockConn, 1, 999, '2024-01-15')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // markMostRecentEpisodeHistoryAsPriorPreservingDate
  // ---------------------------------------------------------------------------

  describe('markMostRecentEpisodeHistoryAsPriorPreservingDate()', () => {
    it('should update the most recent history row with is_prior_watch=TRUE and leave watched_at untouched', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await markMostRecentEpisodeHistoryAsPriorPreservingDate(mockConn, 1, 100);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('UPDATE episode_watch_history');
      expect(sql).toContain('is_prior_watch = TRUE');
      expect(sql).not.toContain('watched_at = ?');
      expect(sql).toContain('MAX(id)');
      expect(params).toEqual([1, 100, 1, 100]);
    });
  });

  // ---------------------------------------------------------------------------
  // markEpisodesHistoryAsPrior
  // ---------------------------------------------------------------------------

  describe('markEpisodesHistoryAsPrior()', () => {
    it('should call markMostRecentEpisodeHistoryAsPrior once per map entry', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const map = new Map<number, string>([
        [10, '2024-01-01'],
        [20, '2024-02-01'],
      ]);
      await markEpisodesHistoryAsPrior(mockConn, 1, map);

      expect(mockConn.execute).toHaveBeenCalledTimes(2);
      expect(mockConn.execute).toHaveBeenNthCalledWith(1, expect.any(String), ['2024-01-01', 1, 10, 1, 10]);
      expect(mockConn.execute).toHaveBeenNthCalledWith(2, expect.any(String), ['2024-02-01', 1, 20, 1, 20]);
    });

    it('should not call execute when the map is empty', async () => {
      await markEpisodesHistoryAsPrior(mockConn, 1, new Map());

      expect(mockConn.execute).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // markEpisodesHistoryAsPriorPreservingDate
  // ---------------------------------------------------------------------------

  describe('markEpisodesHistoryAsPriorPreservingDate()', () => {
    it('should call markMostRecentEpisodeHistoryAsPriorPreservingDate once per episode ID', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await markEpisodesHistoryAsPriorPreservingDate(mockConn, 1, [10, 20]);

      expect(mockConn.execute).toHaveBeenCalledTimes(2);
      expect(mockConn.execute).toHaveBeenNthCalledWith(1, expect.any(String), [1, 10, 1, 10]);
      expect(mockConn.execute).toHaveBeenNthCalledWith(2, expect.any(String), [1, 20, 1, 20]);
    });

    it('should not call execute when episodeIds is empty', async () => {
      await markEpisodesHistoryAsPriorPreservingDate(mockConn, 1, []);

      expect(mockConn.execute).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // logMovieWatched
  // ---------------------------------------------------------------------------

  describe('logMovieWatched()', () => {
    it('should insert a movie watch history row with defaults (isPriorWatch=false, no watchedAt)', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logMovieWatched(mockConn, 3, 50);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movie_watch_history'), [
        3,
        50,
        false,
        3,
        50,
      ]);
    });

    it('should use the provided watchedAt date and isPriorWatch when given', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logMovieWatched(mockConn, 3, 50, true, '2024-01-15');

      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movie_watch_history'), [
        3,
        50,
        '2024-01-15',
        true,
        3,
        50,
      ]);
    });

    it('should use CURRENT_TIMESTAMP when isPriorWatch=true but watchedAt is omitted', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logMovieWatched(mockConn, 3, 50, true);

      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movie_watch_history'), [
        3,
        50,
        true,
        3,
        50,
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // logSeasonWatched
  // ---------------------------------------------------------------------------

  describe('logSeasonWatched()', () => {
    it('should insert a season watch history row', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logSeasonWatched(mockConn, 3, 7);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO season_watch_history'),
        [3, 7, 3, 7],
      );
    });
  });

  // ---------------------------------------------------------------------------
  // logShowWatched
  // ---------------------------------------------------------------------------

  describe('logShowWatched()', () => {
    it('should insert a show watch history row', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await logShowWatched(mockConn, 3, 42);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO show_watch_history'),
        [3, 42, 3, 42],
      );
    });
  });

  // ---------------------------------------------------------------------------
  // resetShowForRewatch
  // ---------------------------------------------------------------------------

  describe('resetShowForRewatch()', () => {
    it('should execute 3 UPDATE statements in sequence', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetShowForRewatch(mockConn, 1, 5);

      expect(mockConn.execute).toHaveBeenCalledTimes(3);
    });

    it('should reset episodes to NOT_WATCHED with NULL watched_at', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetShowForRewatch(mockConn, 1, 5);

      const firstCall = mockConn.execute.mock.calls[0];
      expect(firstCall[0]).toContain("ews.status = 'NOT_WATCHED'");
      expect(firstCall[0]).toContain('ews.watched_at = NULL');
      expect(firstCall[1]).toEqual([1, 5]);
    });

    it('should stamp rewatch_reset_at on each reset episode', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetShowForRewatch(mockConn, 1, 5);

      const firstCall = mockConn.execute.mock.calls[0];
      expect(firstCall[0]).toContain('ews.rewatch_reset_at = CURRENT_TIMESTAMP');
    });

    it('should reset season statuses to NOT_WATCHED', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetShowForRewatch(mockConn, 1, 5);

      const secondCall = mockConn.execute.mock.calls[1];
      expect(secondCall[0]).toContain("sws.status = 'NOT_WATCHED'");
      expect(secondCall[0]).toContain('season_watch_status');
      expect(secondCall[1]).toEqual([1, 5]);
    });

    it('should reset show status and increment rewatch_count', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetShowForRewatch(mockConn, 1, 5);

      const thirdCall = mockConn.execute.mock.calls[2];
      expect(thirdCall[0]).toContain('rewatch_count = rewatch_count + 1');
      expect(thirdCall[0]).toContain('show_watch_status');
      expect(thirdCall[1]).toEqual([1, 5]);
    });
  });

  // ---------------------------------------------------------------------------
  // resetSeasonForRewatch
  // ---------------------------------------------------------------------------

  describe('resetSeasonForRewatch()', () => {
    it('should execute 2 UPDATE statements', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetSeasonForRewatch(mockConn, 2, 10);

      expect(mockConn.execute).toHaveBeenCalledTimes(2);
    });

    it('should reset episodes in the season to NOT_WATCHED', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetSeasonForRewatch(mockConn, 2, 10);

      const firstCall = mockConn.execute.mock.calls[0];
      expect(firstCall[0]).toContain("ews.status = 'NOT_WATCHED'");
      expect(firstCall[0]).toContain('e.season_id = ?');
      expect(firstCall[1]).toEqual([2, 10]);
    });

    it('should stamp rewatch_reset_at on each reset episode', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetSeasonForRewatch(mockConn, 2, 10);

      const firstCall = mockConn.execute.mock.calls[0];
      expect(firstCall[0]).toContain('ews.rewatch_reset_at = CURRENT_TIMESTAMP');
    });

    it('should reset the season itself to NOT_WATCHED', async () => {
      mockConn.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await resetSeasonForRewatch(mockConn, 2, 10);

      const secondCall = mockConn.execute.mock.calls[1];
      expect(secondCall[0]).toContain('season_watch_status');
      expect(secondCall[0]).toContain("status = 'NOT_WATCHED'");
      expect(secondCall[1]).toEqual([2, 10]);
    });
  });

  // ---------------------------------------------------------------------------
  // recordMovieRewatch
  // ---------------------------------------------------------------------------

  describe('recordMovieRewatch()', () => {
    it('should reset movie status and increment rewatch_count', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await recordMovieRewatch(mockConn, 4, 77);

      expect(mockConn.execute).toHaveBeenCalledTimes(2);
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('movie_watch_status');
      expect(sql).toContain('rewatch_count = rewatch_count + 1');
      expect(params).toEqual([4, 77]);
    });
  });

  // ---------------------------------------------------------------------------
  // recordEpisodeRewatch
  // ---------------------------------------------------------------------------

  describe('recordEpisodeRewatch()', () => {
    it('should delegate to logEpisodeWatched with isPriorWatch=false', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await recordEpisodeRewatch(mockConn, 6, 55);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO episode_watch_history'), [
        6,
        55,
        null,
        false,
        6,
        55,
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // getShowIdForSeason
  // ---------------------------------------------------------------------------

  describe('getShowIdForSeason()', () => {
    it('should return the show_id for the given season', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ show_id: 99 }]]);

      const result = await getShowIdForSeason(mockConn, 12);

      expect(result).toBe(99);
      expect(mockConn.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT show_id FROM seasons'), [12]);
    });

    it('should return null when no row is found', async () => {
      mockConn.execute.mockResolvedValueOnce([[]]);

      const result = await getShowIdForSeason(mockConn, 999);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // recalculateShowStatusAfterSeasonReset
  // ---------------------------------------------------------------------------

  describe('recalculateShowStatusAfterSeasonReset()', () => {
    it('should execute a CASE UPDATE on show_watch_status', async () => {
      mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await recalculateShowStatusAfterSeasonReset(mockConn, 1, 5);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('show_watch_status');
      expect(sql).toContain('WATCHING');
      expect(sql).toContain('NOT_WATCHED');
      expect(params).toEqual([1, 5, 1, 5]);
    });
  });

  // ---------------------------------------------------------------------------
  // getEpisodeWatchCount
  // ---------------------------------------------------------------------------

  describe('getEpisodeWatchCount()', () => {
    it('should return the watch count from the query', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ watch_count: 3 }]]);

      const result = await getEpisodeWatchCount(1, 100);

      expect(result).toBe(3);
      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('episode_watch_history'), [1, 100]);
    });

    it('should return 0 when no history rows exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ watch_count: 0 }]]);

      const result = await getEpisodeWatchCount(1, 999);

      expect(result).toBe(0);
    });

    it('should propagate errors via handleDatabaseError', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('query timeout'));

      await expect(getEpisodeWatchCount(1, 100)).rejects.toThrow(
        'Database error getting episode watch count: query timeout',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getEpisodeIdsWithExistingHistory
  // ---------------------------------------------------------------------------

  describe('getEpisodeIdsWithExistingHistory()', () => {
    it('should return an empty set without querying the database when episodeIds is empty', async () => {
      const result = await getEpisodeIdsWithExistingHistory(mockConn, 1, []);

      expect(result).toEqual(new Set());
      expect(mockConn.execute).not.toHaveBeenCalled();
    });

    it('should return an empty set when none of the given episodes have history', async () => {
      mockConn.execute.mockResolvedValueOnce([[]]);

      const result = await getEpisodeIdsWithExistingHistory(mockConn, 1, [10, 20]);

      expect(result).toEqual(new Set());
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('SELECT DISTINCT ewh.episode_id');
      expect(sql).toContain('FROM episode_watch_history ewh');
      expect(sql).toContain('LEFT JOIN episode_watch_status ews');
      expect(sql).toContain('ews.rewatch_reset_at IS NULL OR ewh.created_at > ews.rewatch_reset_at');
      expect(sql).toContain('IN (?, ?)');
      expect(params).toEqual([1, 10, 20]);
    });

    it('should return the subset of episode IDs that already have history rows', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ episode_id: 10 }]]);

      const result = await getEpisodeIdsWithExistingHistory(mockConn, 1, [10, 20, 30]);

      expect(result).toEqual(new Set([10]));
    });

    it('should return all given episode IDs when all of them already have history', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ episode_id: 10 }, { episode_id: 20 }, { episode_id: 30 }]]);

      const result = await getEpisodeIdsWithExistingHistory(mockConn, 1, [10, 20, 30]);

      expect(result).toEqual(new Set([10, 20, 30]));
    });

    it('should correctly distinguish multiple episodes with a mix of existing and no history', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ episode_id: 20 }, { episode_id: 40 }]]);

      const result = await getEpisodeIdsWithExistingHistory(mockConn, 1, [10, 20, 30, 40]);

      expect(result).toEqual(new Set([20, 40]));
      expect(result.has(10)).toBe(false);
      expect(result.has(30)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // hasMovieHistoryRow
  // ---------------------------------------------------------------------------

  describe('hasMovieHistoryRow()', () => {
    it('should return true when a movie_watch_history row exists', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ hasHistory: 1 }]]);

      const result = await hasMovieHistoryRow(mockConn, 3, 50);

      expect(result).toBe(true);
      const [sql, params] = mockConn.execute.mock.calls[0];
      expect(sql).toContain('movie_watch_history');
      expect(sql).toContain('EXISTS');
      expect(params).toEqual([3, 50]);
    });

    it('should return false when no movie_watch_history row exists', async () => {
      mockConn.execute.mockResolvedValueOnce([[{ hasHistory: 0 }]]);

      const result = await hasMovieHistoryRow(mockConn, 3, 999);

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getWatchHistoryForProfile
  // ---------------------------------------------------------------------------

  describe('getWatchHistoryForProfile()', () => {
    const makeEpisodeRow = (overrides = {}) => ({
      historyId: 1,
      contentType: 'episode',
      contentId: 10,
      title: 'Pilot',
      parentTitle: 'Great Show',
      seasonNumber: 1,
      episodeNumber: 1,
      posterImage: '/img.jpg',
      watchedAt: '2024-01-01T00:00:00Z',
      watchNumber: 1,
      isPriorWatch: false,
      runtime: 45,
      ...overrides,
    });

    it('should return items and totalCount for contentType=all (default)', async () => {
      const mockItems = [makeEpisodeRow()];

      mockPool.execute.mockResolvedValueOnce([[{ total: 1 }], []]).mockResolvedValueOnce([mockItems, []]);

      const result = await getWatchHistoryForProfile(1, 1, 10);

      expect(result.totalCount).toBe(1);
      expect(result.items).toEqual(mockItems);
      expect(mockPool.execute).toHaveBeenCalledTimes(2);
    });

    it('should return items for contentType=episode', async () => {
      const mockItems = [makeEpisodeRow()];

      mockPool.execute.mockResolvedValueOnce([[{ total: 1 }], []]).mockResolvedValueOnce([mockItems, []]);

      const result = await getWatchHistoryForProfile(1, 1, 10, 'episode');

      expect(result.totalCount).toBe(1);
      expect(result.items).toEqual(mockItems);
    });

    it('should return items for contentType=movie', async () => {
      const mockMovieRow = makeEpisodeRow({
        contentType: 'movie',
        parentTitle: null,
        seasonNumber: null,
        episodeNumber: null,
      });

      mockPool.execute.mockResolvedValueOnce([[{ total: 1 }], []]).mockResolvedValueOnce([[mockMovieRow], []]);

      const result = await getWatchHistoryForProfile(1, 1, 10, 'movie');

      expect(result.totalCount).toBe(1);
      expect(result.items[0].contentType).toBe('movie');
    });

    it('should return totalCount=0 and empty items when no results', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      const result = await getWatchHistoryForProfile(1, 1, 10);

      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should default totalCount to 0 when count row is missing', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([[], []]);

      const result = await getWatchHistoryForProfile(1, 1, 10);

      expect(result.totalCount).toBe(0);
    });

    it('should use ASC sort order when sortOrder=asc', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'all', 'asc');

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('ASC');
      expect(dataCall[0]).not.toContain('DESC');
    });

    it('should clamp page to 1 when page <= 0', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 0, 10);

      // OFFSET should be 0 (page clamped to 1)
      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('OFFSET 0');
    });

    it('should clamp pageSize to 100 when pageSize > 100', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 500);

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('LIMIT 100');
    });

    it('should include date range params when dateFrom and dateTo are provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'all', 'desc', '2024-01-01', '2024-01-31');

      const countCall = mockPool.execute.mock.calls[0];
      expect(countCall[1]).toContain('2024-01-01');
      expect(countCall[1]).toContain('2024-01-31');
    });

    it('should include isPriorWatch filter params when isPriorWatchOnly=true', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'episode', 'desc', undefined, undefined, true);

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('is_prior_watch = TRUE');
    });

    it('should include excludePriorWatch filter when excludePriorWatch=true', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'episode', 'desc', undefined, undefined, false, undefined, true);

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('is_prior_watch = FALSE');
    });

    it('should apply isPriorWatchOnly filter to movie query when contentType=movie', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'movie', 'desc', undefined, undefined, true);

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('is_prior_watch = TRUE');
    });

    it('should apply excludePriorWatch filter to movie query when contentType=movie', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'movie', 'desc', undefined, undefined, false, undefined, true);

      const dataCall = mockPool.execute.mock.calls[1];
      expect(dataCall[0]).toContain('is_prior_watch = FALSE');
    });

    it('should include search query LIKE param when searchQuery is provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ total: 0 }], []]).mockResolvedValueOnce([[], []]);

      await getWatchHistoryForProfile(1, 1, 10, 'all', 'desc', undefined, undefined, false, 'Breaking');

      const countCall = mockPool.execute.mock.calls[0];
      expect(countCall[1]).toContain('%Breaking%');
    });

    it('should propagate errors via handleDatabaseError', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('pool exhausted'));

      await expect(getWatchHistoryForProfile(1, 1, 10)).rejects.toThrow(
        'Database error getting watch history for profile: pool exhausted',
      );
    });
  });
});
