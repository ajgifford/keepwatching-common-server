import {
  EpisodeRewatchRow,
  EpisodeRewatchWithProfileRow,
  MovieRewatchRow,
  MovieRewatchWithProfileRow,
  RewatchTotalRow,
  ShowEpisodeRewatchSummaryRow,
  ShowEpisodeRewatchSummaryWithProfileRow,
  ShowRewatchRow,
  ShowRewatchWithProfileRow,
  mapRowToRewatchedEpisode,
  mapRowToRewatchedEpisodeWithProfile,
  mapRowToRewatchedMovie,
  mapRowToRewatchedMovieWithProfile,
  mapRowToRewatchedShow,
  mapRowToRewatchedShowWithProfile,
  mapRowsToRewatchedShowEpisodeSummaries,
  mapRowsToRewatchedShowEpisodeSummariesWithProfile,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AccountRewatchStats, ProfileRewatchStats } from '@ajgifford/keepwatching-types';

/**
 * Get rewatch statistics for a single profile.
 *
 * @param profileId - ID of the profile
 * @returns Profile rewatch statistics
 */
export async function getProfileRewatchStats(profileId: number): Promise<ProfileRewatchStats> {
  return await DbMonitor.getInstance().executeWithTiming('getProfileRewatchStats', async () => {
    const pool = getDbPool();

    const [showTotals, movieTotals, showRows, movieRows, episodeTotals, episodeRows, showEpisodeSummaryRows] =
      await Promise.all([
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
        pool.execute<RewatchTotalRow[]>(
          `SELECT COUNT(*) AS total
         FROM episode_watch_history
         WHERE profile_id = ? AND watch_number > 1`,
          [profileId],
        ),
        pool.execute<EpisodeRewatchRow[]>(
          `SELECT e.id AS episode_id, e.show_id, sh.title AS show_title,
                e.season_number, e.episode_number, e.title AS episode_title,
                COUNT(*) - 1 AS rewatch_count
         FROM episode_watch_history ewh
         JOIN episodes e ON e.id = ewh.episode_id
         JOIN shows sh ON sh.id = e.show_id
         WHERE ewh.profile_id = ?
         GROUP BY e.id, e.show_id, sh.title, e.season_number, e.episode_number, e.title
         HAVING COUNT(*) > 1
         ORDER BY rewatch_count DESC
         LIMIT 10`,
          [profileId],
        ),
        pool.execute<ShowEpisodeRewatchSummaryRow[]>(
          `SELECT e.show_id, sh.title AS show_title,
                COUNT(*) AS total_episodes_rewatched,
                SUM(sub.rewatch_count) AS total_rewatch_count
         FROM (
           SELECT episode_id, COUNT(*) - 1 AS rewatch_count
           FROM episode_watch_history
           WHERE profile_id = ?
           GROUP BY episode_id
           HAVING COUNT(*) > 1
         ) sub
         JOIN episodes e ON e.id = sub.episode_id
         JOIN shows sh ON sh.id = e.show_id
         GROUP BY e.show_id, sh.title
         ORDER BY total_rewatch_count DESC
         LIMIT 5`,
          [profileId],
        ),
      ]);

    const topShowIds = (showEpisodeSummaryRows[0] as ShowEpisodeRewatchSummaryRow[]).map((row) => row.show_id);
    const showEpisodeRows =
      topShowIds.length === 0
        ? []
        : (
            await pool.execute<EpisodeRewatchRow[]>(
              `SELECT e.id AS episode_id, e.show_id, sh.title AS show_title,
                e.season_number, e.episode_number, e.title AS episode_title,
                COUNT(*) - 1 AS rewatch_count
         FROM episode_watch_history ewh
         JOIN episodes e ON e.id = ewh.episode_id
         JOIN shows sh ON sh.id = e.show_id
         WHERE ewh.profile_id = ? AND e.show_id IN (${topShowIds.map(() => '?').join(',')})
         GROUP BY e.id, e.show_id, sh.title, e.season_number, e.episode_number, e.title
         HAVING COUNT(*) > 1
         ORDER BY rewatch_count DESC`,
              [profileId, ...topShowIds],
            )
          )[0];

    return {
      totalShowRewatches: Number(showTotals[0][0].total) || 0,
      totalMovieRewatches: Number(movieTotals[0][0].total) || 0,
      totalEpisodeRewatches: Number(episodeTotals[0][0].total) || 0,
      mostRewatchedShows: (showRows[0] as ShowRewatchRow[]).map(mapRowToRewatchedShow),
      mostRewatchedMovies: (movieRows[0] as MovieRewatchRow[]).map(mapRowToRewatchedMovie),
      mostRewatchedEpisodes: (episodeRows[0] as EpisodeRewatchRow[]).map(mapRowToRewatchedEpisode),
      topRewatchedShowsByEpisodes: mapRowsToRewatchedShowEpisodeSummaries(
        showEpisodeSummaryRows[0] as ShowEpisodeRewatchSummaryRow[],
        showEpisodeRows as EpisodeRewatchRow[],
      ),
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

    const [showTotals, movieTotals, showRows, movieRows, episodeTotals, episodeRows, showEpisodeSummaryRows] =
      await Promise.all([
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
        pool.execute<RewatchTotalRow[]>(
          `SELECT COUNT(*) AS total
         FROM episode_watch_history ewh
         JOIN profiles p ON p.profile_id = ewh.profile_id
         WHERE p.account_id = ? AND ewh.watch_number > 1`,
          [accountId],
        ),
        pool.execute<EpisodeRewatchWithProfileRow[]>(
          `SELECT e.id AS episode_id, e.show_id, sh.title AS show_title,
                e.season_number, e.episode_number, e.title AS episode_title,
                COUNT(*) - 1 AS rewatch_count, p.name AS profile_name
         FROM episode_watch_history ewh
         JOIN episodes e ON e.id = ewh.episode_id
         JOIN shows sh ON sh.id = e.show_id
         JOIN profiles p ON p.profile_id = ewh.profile_id
         WHERE p.account_id = ?
         GROUP BY e.id, e.show_id, sh.title, e.season_number, e.episode_number, e.title, p.name
         HAVING COUNT(*) > 1
         ORDER BY rewatch_count DESC
         LIMIT 10`,
          [accountId],
        ),
        pool.execute<ShowEpisodeRewatchSummaryWithProfileRow[]>(
          `SELECT e.show_id, sh.title AS show_title, p.name AS profile_name,
                COUNT(*) AS total_episodes_rewatched,
                SUM(sub.rewatch_count) AS total_rewatch_count
         FROM (
           SELECT ewh.episode_id, ewh.profile_id, COUNT(*) - 1 AS rewatch_count
           FROM episode_watch_history ewh
           JOIN profiles pr ON pr.profile_id = ewh.profile_id
           WHERE pr.account_id = ?
           GROUP BY ewh.episode_id, ewh.profile_id
           HAVING COUNT(*) > 1
         ) sub
         JOIN episodes e ON e.id = sub.episode_id
         JOIN shows sh ON sh.id = e.show_id
         JOIN profiles p ON p.profile_id = sub.profile_id
         GROUP BY e.show_id, sh.title, p.name
         ORDER BY total_rewatch_count DESC
         LIMIT 5`,
          [accountId],
        ),
      ]);

    const topShowIds = [
      ...new Set((showEpisodeSummaryRows[0] as ShowEpisodeRewatchSummaryWithProfileRow[]).map((row) => row.show_id)),
    ];
    const showEpisodeRows =
      topShowIds.length === 0
        ? []
        : (
            await pool.execute<EpisodeRewatchWithProfileRow[]>(
              `SELECT e.id AS episode_id, e.show_id, sh.title AS show_title,
                e.season_number, e.episode_number, e.title AS episode_title,
                COUNT(*) - 1 AS rewatch_count, p.name AS profile_name
         FROM episode_watch_history ewh
         JOIN episodes e ON e.id = ewh.episode_id
         JOIN shows sh ON sh.id = e.show_id
         JOIN profiles p ON p.profile_id = ewh.profile_id
         WHERE p.account_id = ? AND e.show_id IN (${topShowIds.map(() => '?').join(',')})
         GROUP BY e.id, e.show_id, sh.title, e.season_number, e.episode_number, e.title, p.name
         HAVING COUNT(*) > 1
         ORDER BY rewatch_count DESC`,
              [accountId, ...topShowIds],
            )
          )[0];

    return {
      totalShowRewatches: Number(showTotals[0][0].total) || 0,
      totalMovieRewatches: Number(movieTotals[0][0].total) || 0,
      totalEpisodeRewatches: Number(episodeTotals[0][0].total) || 0,
      mostRewatchedShows: (showRows[0] as ShowRewatchWithProfileRow[]).map(mapRowToRewatchedShowWithProfile),
      mostRewatchedMovies: (movieRows[0] as MovieRewatchWithProfileRow[]).map(mapRowToRewatchedMovieWithProfile),
      mostRewatchedEpisodes: (episodeRows[0] as EpisodeRewatchWithProfileRow[]).map(
        mapRowToRewatchedEpisodeWithProfile,
      ),
      topRewatchedShowsByEpisodes: mapRowsToRewatchedShowEpisodeSummariesWithProfile(
        showEpisodeSummaryRows[0] as ShowEpisodeRewatchSummaryWithProfileRow[],
        showEpisodeRows as EpisodeRewatchWithProfileRow[],
      ),
    };
  });
}
