import { NotFoundError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TimestampUtil } from '../utils/timestampUtil';
import { AdminWatchHistoryDetailResponse } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// ---------------------------------------------------------------------------
// Admin watch-history editor — read/update raw status + history rows for a
// single profile + content item. Distinct from watchHistoryDb.ts, which serves
// the profile-facing paginated/combined history feed; these functions serve
// the admin dashboard's targeted date/time correction tool.
// ---------------------------------------------------------------------------

interface StatusRow extends RowDataPacket {
  status: string;
  watched_at?: string | null;
  is_prior_watch?: number | boolean | null;
  rewatch_count?: number | null;
}

interface HistoryRow extends RowDataPacket {
  id: number;
  watch_number: number;
  watched_at: string;
  is_prior_watch?: number | boolean | null;
  created_at?: string | null;
}

function toDetailResponse(
  contentType: AdminWatchHistoryDetailResponse['contentType'],
  statusRow: StatusRow,
  historyRows: HistoryRow[],
): AdminWatchHistoryDetailResponse {
  return {
    contentType,
    status: {
      status: statusRow.status as AdminWatchHistoryDetailResponse['status']['status'],
      watchedAt: statusRow.watched_at ?? null,
      isPriorWatch: statusRow.is_prior_watch === undefined ? undefined : Boolean(statusRow.is_prior_watch),
      rewatchCount: statusRow.rewatch_count ?? undefined,
    },
    history: historyRows.map((row) => ({
      historyId: row.id,
      watchedAt: row.watched_at,
      watchNumber: row.watch_number,
      isPriorWatch: row.is_prior_watch === undefined ? undefined : Boolean(row.is_prior_watch),
      createdAt: row.created_at ?? undefined,
    })),
  };
}

export async function getEpisodeWatchDetail(
  profileId: number,
  episodeId: number,
): Promise<AdminWatchHistoryDetailResponse> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getEpisodeWatchDetail', async () => {
      const pool = getDbPool();
      const [[statusRow], [historyRows]] = await Promise.all([
        pool.execute<StatusRow[]>(
          `SELECT status, watched_at, is_prior_watch FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?`,
          [profileId, episodeId],
        ),
        pool.execute<HistoryRow[]>(
          `SELECT id, watch_number, watched_at, is_prior_watch, created_at FROM episode_watch_history WHERE profile_id = ? AND episode_id = ? ORDER BY watch_number ASC`,
          [profileId, episodeId],
        ),
      ]);

      if (!statusRow[0]) {
        throw new NotFoundError(`No watch status found for profile ${profileId} and episode ${episodeId}`);
      }

      return toDetailResponse('episode', statusRow[0], historyRows);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting episode watch detail');
  }
}

export async function getMovieWatchDetail(
  profileId: number,
  movieId: number,
): Promise<AdminWatchHistoryDetailResponse> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMovieWatchDetail', async () => {
      const pool = getDbPool();
      const [[statusRow], [historyRows]] = await Promise.all([
        pool.execute<StatusRow[]>(
          `SELECT status, watched_at, is_prior_watch, rewatch_count FROM movie_watch_status WHERE profile_id = ? AND movie_id = ?`,
          [profileId, movieId],
        ),
        pool.execute<HistoryRow[]>(
          `SELECT id, watch_number, watched_at, is_prior_watch, created_at FROM movie_watch_history WHERE profile_id = ? AND movie_id = ? ORDER BY watch_number ASC`,
          [profileId, movieId],
        ),
      ]);

      if (!statusRow[0]) {
        throw new NotFoundError(`No watch status found for profile ${profileId} and movie ${movieId}`);
      }

      return toDetailResponse('movie', statusRow[0], historyRows);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting movie watch detail');
  }
}

export async function getSeasonWatchDetail(
  profileId: number,
  seasonId: number,
): Promise<AdminWatchHistoryDetailResponse> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getSeasonWatchDetail', async () => {
      const pool = getDbPool();
      const [[statusRow], [historyRows]] = await Promise.all([
        pool.execute<StatusRow[]>(`SELECT status FROM season_watch_status WHERE profile_id = ? AND season_id = ?`, [
          profileId,
          seasonId,
        ]),
        pool.execute<HistoryRow[]>(
          `SELECT id, watch_number, watched_at FROM season_watch_history WHERE profile_id = ? AND season_id = ? ORDER BY watch_number ASC`,
          [profileId, seasonId],
        ),
      ]);

      if (!statusRow[0]) {
        throw new NotFoundError(`No watch status found for profile ${profileId} and season ${seasonId}`);
      }

      return toDetailResponse('season', statusRow[0], historyRows);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting season watch detail');
  }
}

export async function getShowWatchDetail(profileId: number, showId: number): Promise<AdminWatchHistoryDetailResponse> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowWatchDetail', async () => {
      const pool = getDbPool();
      const [[statusRow], [historyRows]] = await Promise.all([
        pool.execute<StatusRow[]>(
          `SELECT status, rewatch_count FROM show_watch_status WHERE profile_id = ? AND show_id = ?`,
          [profileId, showId],
        ),
        pool.execute<HistoryRow[]>(
          `SELECT id, watch_number, watched_at FROM show_watch_history WHERE profile_id = ? AND show_id = ? ORDER BY watch_number ASC`,
          [profileId, showId],
        ),
      ]);

      if (!statusRow[0]) {
        throw new NotFoundError(`No watch status found for profile ${profileId} and show ${showId}`);
      }

      return toDetailResponse('show', statusRow[0], historyRows);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting show watch detail');
  }
}

async function updateHistoryDate(
  table: string,
  historyId: number,
  watchedAt: string,
  timingLabel: string,
): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming(timingLabel, async () => {
      const mysqlWatchedAt = TimestampUtil.toMySQLDatetime(watchedAt) ?? watchedAt;
      const [result] = await getDbPool().execute<ResultSetHeader>(`UPDATE ${table} SET watched_at = ? WHERE id = ?`, [
        mysqlWatchedAt,
        historyId,
      ]);
      if (result.affectedRows === 0) {
        throw new NotFoundError(`No ${table} row found with id ${historyId}`);
      }
    });
  } catch (error) {
    handleDatabaseError(error, `updating ${table} date`);
  }
}

export function updateEpisodeWatchHistoryDate(historyId: number, watchedAt: string): Promise<void> {
  return updateHistoryDate('episode_watch_history', historyId, watchedAt, 'updateEpisodeWatchHistoryDate');
}

export function updateMovieWatchHistoryDate(historyId: number, watchedAt: string): Promise<void> {
  return updateHistoryDate('movie_watch_history', historyId, watchedAt, 'updateMovieWatchHistoryDate');
}

export function updateSeasonWatchHistoryDate(historyId: number, watchedAt: string): Promise<void> {
  return updateHistoryDate('season_watch_history', historyId, watchedAt, 'updateSeasonWatchHistoryDate');
}

export function updateShowWatchHistoryDate(historyId: number, watchedAt: string): Promise<void> {
  return updateHistoryDate('show_watch_history', historyId, watchedAt, 'updateShowWatchHistoryDate');
}

async function updateStatusDate(
  table: string,
  idColumn: string,
  profileId: number,
  contentId: number,
  watchedAt: string,
  timingLabel: string,
): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming(timingLabel, async () => {
      const mysqlWatchedAt = TimestampUtil.toMySQLDatetime(watchedAt) ?? watchedAt;
      const [result] = await getDbPool().execute<ResultSetHeader>(
        `UPDATE ${table} SET watched_at = ?, updated_at = CURRENT_TIMESTAMP WHERE profile_id = ? AND ${idColumn} = ?`,
        [mysqlWatchedAt, profileId, contentId],
      );
      if (result.affectedRows === 0) {
        throw new NotFoundError(`No ${table} row found for profile ${profileId} and ${idColumn} ${contentId}`);
      }
    });
  } catch (error) {
    handleDatabaseError(error, `updating ${table} date`);
  }
}

export function updateEpisodeWatchStatusDate(profileId: number, episodeId: number, watchedAt: string): Promise<void> {
  return updateStatusDate(
    'episode_watch_status',
    'episode_id',
    profileId,
    episodeId,
    watchedAt,
    'updateEpisodeWatchStatusDate',
  );
}

export function updateMovieWatchStatusDate(profileId: number, movieId: number, watchedAt: string): Promise<void> {
  return updateStatusDate(
    'movie_watch_status',
    'movie_id',
    profileId,
    movieId,
    watchedAt,
    'updateMovieWatchStatusDate',
  );
}
