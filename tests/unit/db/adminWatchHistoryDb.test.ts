import { setupDatabaseTest } from './helpers/dbTestSetup';
import {
  getEpisodeWatchDetail,
  getMovieWatchDetail,
  getSeasonWatchDetail,
  getShowWatchDetail,
  updateEpisodeWatchHistoryDate,
  updateEpisodeWatchStatusDate,
  updateMovieWatchHistoryDate,
  updateMovieWatchStatusDate,
  updateSeasonWatchHistoryDate,
  updateShowWatchHistoryDate,
} from '@db/adminWatchHistoryDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { TimestampUtil } from '@utils/timestampUtil';
import { ResultSetHeader } from 'mysql2';

describe('adminWatchHistoryDb Module', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;

    // toMySQLDatetime formats using local Date getters, so pin it to a fixed,
    // timezone-independent value for assertions rather than asserting an exact
    // conversion of the input ISO string.
    jest.spyOn(TimestampUtil, 'toMySQLDatetime').mockReturnValue('2024-01-01 00:00:00');
  });

  // ---------------------------------------------------------------------------
  // getEpisodeWatchDetail
  // ---------------------------------------------------------------------------

  describe('getEpisodeWatchDetail()', () => {
    it('should return status and history for an episode', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ status: 'WATCHED', watched_at: '2024-01-15T20:30:00.000Z', is_prior_watch: 0 }]])
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              watch_number: 1,
              watched_at: '2024-01-15T20:30:00.000Z',
              is_prior_watch: 0,
              created_at: '2024-01-15T20:30:00.000Z',
            },
          ],
        ]);

      const result = await getEpisodeWatchDetail(10, 100);

      expect(result).toEqual({
        contentType: 'episode',
        status: {
          status: 'WATCHED',
          watchedAt: '2024-01-15T20:30:00.000Z',
          isPriorWatch: false,
          rewatchCount: undefined,
        },
        history: [
          {
            historyId: 1,
            watchedAt: '2024-01-15T20:30:00.000Z',
            watchNumber: 1,
            isPriorWatch: false,
            createdAt: '2024-01-15T20:30:00.000Z',
          },
        ],
      });
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM episode_watch_status'), [10, 100]);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM episode_watch_history'), [10, 100]);
    });

    it('should throw NotFoundError when no status row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      await expect(getEpisodeWatchDetail(10, 100)).rejects.toThrow(
        new NotFoundError('No watch status found for profile 10 and episode 100'),
      );
    });

    it('should propagate errors via handleDatabaseError', async () => {
      mockExecute.mockRejectedValueOnce(new Error('query timeout'));

      await expect(getEpisodeWatchDetail(10, 100)).rejects.toThrow(
        'Database error getting episode watch detail: query timeout',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getMovieWatchDetail
  // ---------------------------------------------------------------------------

  describe('getMovieWatchDetail()', () => {
    it('should return status and history for a movie', async () => {
      mockExecute
        .mockResolvedValueOnce([
          [{ status: 'WATCHED', watched_at: '2024-02-01T00:00:00.000Z', is_prior_watch: 1, rewatch_count: 2 }],
        ])
        .mockResolvedValueOnce([
          [
            {
              id: 5,
              watch_number: 1,
              watched_at: '2024-02-01T00:00:00.000Z',
              is_prior_watch: 1,
              created_at: '2024-02-01T00:00:00.000Z',
            },
          ],
        ]);

      const result = await getMovieWatchDetail(10, 200);

      expect(result.contentType).toBe('movie');
      expect(result.status).toEqual({
        status: 'WATCHED',
        watchedAt: '2024-02-01T00:00:00.000Z',
        isPriorWatch: true,
        rewatchCount: 2,
      });
      expect(result.history).toHaveLength(1);
    });

    it('should throw NotFoundError when no status row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      await expect(getMovieWatchDetail(10, 200)).rejects.toThrow(
        new NotFoundError('No watch status found for profile 10 and movie 200'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getSeasonWatchDetail
  // ---------------------------------------------------------------------------

  describe('getSeasonWatchDetail()', () => {
    it('should return status and history for a season without watchedAt/isPriorWatch on status', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ status: 'WATCHED' }]])
        .mockResolvedValueOnce([[{ id: 7, watch_number: 1, watched_at: '2024-03-01T00:00:00.000Z' }]]);

      const result = await getSeasonWatchDetail(10, 300);

      expect(result).toEqual({
        contentType: 'season',
        status: { status: 'WATCHED', watchedAt: null, isPriorWatch: undefined, rewatchCount: undefined },
        history: [
          {
            historyId: 7,
            watchedAt: '2024-03-01T00:00:00.000Z',
            watchNumber: 1,
            isPriorWatch: undefined,
            createdAt: undefined,
          },
        ],
      });
    });

    it('should throw NotFoundError when no status row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      await expect(getSeasonWatchDetail(10, 300)).rejects.toThrow(
        new NotFoundError('No watch status found for profile 10 and season 300'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getShowWatchDetail
  // ---------------------------------------------------------------------------

  describe('getShowWatchDetail()', () => {
    it('should return status and history for a show', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ status: 'UP_TO_DATE', rewatch_count: 1 }]])
        .mockResolvedValueOnce([[{ id: 9, watch_number: 1, watched_at: '2024-04-01T00:00:00.000Z' }]]);

      const result = await getShowWatchDetail(10, 400);

      expect(result.contentType).toBe('show');
      expect(result.status).toEqual({
        status: 'UP_TO_DATE',
        watchedAt: null,
        isPriorWatch: undefined,
        rewatchCount: 1,
      });
      expect(result.history).toEqual([
        {
          historyId: 9,
          watchedAt: '2024-04-01T00:00:00.000Z',
          watchNumber: 1,
          isPriorWatch: undefined,
          createdAt: undefined,
        },
      ]);
    });

    it('should throw NotFoundError when no status row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

      await expect(getShowWatchDetail(10, 400)).rejects.toThrow(
        new NotFoundError('No watch status found for profile 10 and show 400'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update*WatchHistoryDate
  // ---------------------------------------------------------------------------

  describe('updateEpisodeWatchHistoryDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the history row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateEpisodeWatchHistoryDate(1, '2024-01-01T00:00:00.000Z');

      expect(TimestampUtil.toMySQLDatetime).toHaveBeenCalledWith('2024-01-01T00:00:00.000Z');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE episode_watch_history'), [
        '2024-01-01 00:00:00',
        1,
      ]);
    });

    it('should throw NotFoundError when no row is affected', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(updateEpisodeWatchHistoryDate(999, '2024-01-01T00:00:00.000Z')).rejects.toThrow(
        new NotFoundError('No episode_watch_history row found with id 999'),
      );
    });
  });

  describe('updateMovieWatchHistoryDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the history row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateMovieWatchHistoryDate(2, '2024-01-01T00:00:00.000Z');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE movie_watch_history'), [
        '2024-01-01 00:00:00',
        2,
      ]);
    });
  });

  describe('updateSeasonWatchHistoryDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the history row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateSeasonWatchHistoryDate(3, '2024-01-01T00:00:00.000Z');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE season_watch_history'), [
        '2024-01-01 00:00:00',
        3,
      ]);
    });
  });

  describe('updateShowWatchHistoryDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the history row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateShowWatchHistoryDate(4, '2024-01-01T00:00:00.000Z');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE show_watch_history'), [
        '2024-01-01 00:00:00',
        4,
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // update*WatchStatusDate
  // ---------------------------------------------------------------------------

  describe('updateEpisodeWatchStatusDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the status row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateEpisodeWatchStatusDate(10, 100, '2024-01-01T00:00:00.000Z');

      expect(TimestampUtil.toMySQLDatetime).toHaveBeenCalledWith('2024-01-01T00:00:00.000Z');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE episode_watch_status'), [
        '2024-01-01 00:00:00',
        10,
        100,
      ]);
    });

    it('should throw NotFoundError when no row is affected', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(updateEpisodeWatchStatusDate(10, 999, '2024-01-01T00:00:00.000Z')).rejects.toThrow(
        new NotFoundError('No episode_watch_status row found for profile 10 and episode_id 999'),
      );
    });
  });

  describe('updateMovieWatchStatusDate()', () => {
    it('should convert watchedAt to MySQL datetime format before updating the status row', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateMovieWatchStatusDate(10, 200, '2024-01-01T00:00:00.000Z');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE movie_watch_status'), [
        '2024-01-01 00:00:00',
        10,
        200,
      ]);
    });
  });

  describe('falls back to the raw watchedAt string if conversion returns null', () => {
    it('passes the original watchedAt through when TimestampUtil.toMySQLDatetime returns null', async () => {
      jest.spyOn(TimestampUtil, 'toMySQLDatetime').mockReturnValue(null);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await updateEpisodeWatchHistoryDate(1, '2024-01-01T00:00:00.000Z');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE episode_watch_history'), [
        '2024-01-01T00:00:00.000Z',
        1,
      ]);
    });
  });
});
