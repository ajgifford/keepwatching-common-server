import { AccountRewatchStats, ProfileRewatchStats } from '@ajgifford/keepwatching-types';
import {
  mapRowToRewatchedMovie,
  mapRowToRewatchedMovieWithProfile,
  mapRowToRewatchedShow,
  mapRowToRewatchedShowWithProfile,
  MovieRewatchRow,
  MovieRewatchWithProfileRow,
  RewatchTotalRow,
  ShowRewatchRow,
  ShowRewatchWithProfileRow,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';

/**
 * Get rewatch statistics for a single profile.
 *
 * @param profileId - ID of the profile
 * @returns Profile rewatch statistics
 */
export async function getProfileRewatchStats(profileId: number): Promise<ProfileRewatchStats> {
  return await DbMonitor.getInstance().executeWithTiming('getProfileRewatchStats', async () => {
    const pool = getDbPool();

    const [showTotals, movieTotals, showRows, movieRows] = await Promise.all([
      pool.execute<RewatchTotalRow[]>(
        `SELECT COALESCE(SUM(rewatch_count), 0) AS total
         FROM show_watch_status
         WHERE profile_id = ? AND rewatch_count > 0`,
        [profileId],
      ),
      pool.execute<RewatchTotalRow[]>(
        `SELECT COALESCE(SUM(rewatch_count), 0) AS total
         FROM movie_watch_status
         WHERE profile_id = ? AND rewatch_count > 0`,
        [profileId],
      ),
      pool.execute<ShowRewatchRow[]>(
        `SELECT s.id AS show_id, s.title AS show_title, sws.rewatch_count
         FROM show_watch_status sws
         JOIN shows s ON s.id = sws.show_id
         WHERE sws.profile_id = ? AND sws.rewatch_count > 0
         ORDER BY sws.rewatch_count DESC
         LIMIT 10`,
        [profileId],
      ),
      pool.execute<MovieRewatchRow[]>(
        `SELECT m.id AS movie_id, m.title AS movie_title, mws.rewatch_count
         FROM movie_watch_status mws
         JOIN movies m ON m.id = mws.movie_id
         WHERE mws.profile_id = ? AND mws.rewatch_count > 0
         ORDER BY mws.rewatch_count DESC
         LIMIT 10`,
        [profileId],
      ),
    ]);

    return {
      totalShowRewatches: Number(showTotals[0][0].total) || 0,
      totalMovieRewatches: Number(movieTotals[0][0].total) || 0,
      mostRewatchedShows: (showRows[0] as ShowRewatchRow[]).map(mapRowToRewatchedShow),
      mostRewatchedMovies: (movieRows[0] as MovieRewatchRow[]).map(mapRowToRewatchedMovie),
    };
  });
}

/**
 * Get rewatch statistics aggregated across all profiles in an account.
 *
 * @param accountId - ID of the account
 * @returns Account-wide rewatch statistics
 */
export async function getAccountRewatchStats(accountId: number): Promise<AccountRewatchStats> {
  return await DbMonitor.getInstance().executeWithTiming('getAccountRewatchStats', async () => {
    const pool = getDbPool();

    const [showTotals, movieTotals, showRows, movieRows] = await Promise.all([
      pool.execute<RewatchTotalRow[]>(
        `SELECT COALESCE(SUM(sws.rewatch_count), 0) AS total
         FROM show_watch_status sws
         JOIN profiles p ON p.profile_id = sws.profile_id
         WHERE p.account_id = ? AND sws.rewatch_count > 0`,
        [accountId],
      ),
      pool.execute<RewatchTotalRow[]>(
        `SELECT COALESCE(SUM(mws.rewatch_count), 0) AS total
         FROM movie_watch_status mws
         JOIN profiles p ON p.profile_id = mws.profile_id
         WHERE p.account_id = ? AND mws.rewatch_count > 0`,
        [accountId],
      ),
      pool.execute<ShowRewatchWithProfileRow[]>(
        `SELECT s.id AS show_id, s.title AS show_title, sws.rewatch_count, p.name AS profile_name
         FROM show_watch_status sws
         JOIN shows s ON s.id = sws.show_id
         JOIN profiles p ON p.profile_id = sws.profile_id
         WHERE p.account_id = ? AND sws.rewatch_count > 0
         ORDER BY sws.rewatch_count DESC
         LIMIT 10`,
        [accountId],
      ),
      pool.execute<MovieRewatchWithProfileRow[]>(
        `SELECT m.id AS movie_id, m.title AS movie_title, mws.rewatch_count, p.name AS profile_name
         FROM movie_watch_status mws
         JOIN movies m ON m.id = mws.movie_id
         JOIN profiles p ON p.profile_id = mws.profile_id
         WHERE p.account_id = ? AND mws.rewatch_count > 0
         ORDER BY mws.rewatch_count DESC
         LIMIT 10`,
        [accountId],
      ),
    ]);

    return {
      totalShowRewatches: Number(showTotals[0][0].total) || 0,
      totalMovieRewatches: Number(movieTotals[0][0].total) || 0,
      mostRewatchedShows: (showRows[0] as ShowRewatchWithProfileRow[]).map(mapRowToRewatchedShowWithProfile),
      mostRewatchedMovies: (movieRows[0] as MovieRewatchWithProfileRow[]).map(mapRowToRewatchedMovieWithProfile),
    };
  });
}
