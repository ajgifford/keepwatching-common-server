import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { WatchHistoryRow } from '../types/watchHistoryTypes';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

interface SeasonShowRow extends RowDataPacket {
  show_id: number;
}

interface WatchHistoryCountRow extends RowDataPacket {
  total: number;
}

interface EpisodeWatchCountRow extends RowDataPacket {
  watch_count: number;
}

// ---------------------------------------------------------------------------
// History logging — all accept an active PoolConnection to participate in the
// caller's transaction, ensuring atomicity with the status table update.
// ---------------------------------------------------------------------------

/**
 * Log a single episode watch event to episode_watch_history.
 * watch_number is computed as MAX(existing) + 1, so the first watch gets 1,
 * the first rewatch gets 2, and so on.
 *
 * @param conn        Active transaction connection from the caller
 * @param profileId   Profile that watched the episode
 * @param episodeId   Episode that was watched
 * @param isPriorWatch  True when this is a prior-watch (air-date-aligned) event
 * @param watchedAt   Explicit timestamp (e.g. air date for prior watches); defaults to CURRENT_TIMESTAMP
 */
export async function logEpisodeWatched(
  conn: PoolConnection,
  profileId: number,
  episodeId: number,
  isPriorWatch: boolean = false,
  watchedAt?: string,
): Promise<void> {
  const query = `
    INSERT INTO episode_watch_history (profile_id, episode_id, watch_number, watched_at, is_prior_watch)
    SELECT ?, ?, COALESCE(MAX(watch_number), 0) + 1, COALESCE(?, CURRENT_TIMESTAMP), ?
    FROM episode_watch_history
    WHERE profile_id = ? AND episode_id = ?
  `;
  await conn.execute<ResultSetHeader>(query, [
    profileId,
    episodeId,
    watchedAt ?? null,
    isPriorWatch,
    profileId,
    episodeId,
  ]);
}

/**
 * Log watch events for multiple episodes in a single loop.
 * Used by season/show bulk-mark operations where a list of newly-watched
 * episode IDs is known after diffing pre/post status snapshots.
 *
 * @param conn        Active transaction connection from the caller
 * @param profileId   Profile that watched the episodes
 * @param episodeIds  IDs of episodes that transitioned to WATCHED in this operation
 * @param isPriorWatch  True when all episodes are being logged as prior watches
 */
export async function logEpisodesWatched(
  conn: PoolConnection,
  profileId: number,
  episodeIds: number[],
  isPriorWatch: boolean = false,
): Promise<void> {
  for (const episodeId of episodeIds) {
    await logEpisodeWatched(conn, profileId, episodeId, isPriorWatch);
  }
}

/**
 * Log a single movie watch event to movie_watch_history.
 */
export async function logMovieWatched(conn: PoolConnection, profileId: number, movieId: number): Promise<void> {
  const query = `
    INSERT INTO movie_watch_history (profile_id, movie_id, watch_number, watched_at)
    SELECT ?, ?, COALESCE(MAX(watch_number), 0) + 1, CURRENT_TIMESTAMP
    FROM movie_watch_history
    WHERE profile_id = ? AND movie_id = ?
  `;
  await conn.execute<ResultSetHeader>(query, [profileId, movieId, profileId, movieId]);
}

/**
 * Log a season completion event. Called when a season's calculated status
 * transitions to WATCHED or UP_TO_DATE during a propagation step.
 */
export async function logSeasonWatched(conn: PoolConnection, profileId: number, seasonId: number): Promise<void> {
  const query = `
    INSERT INTO season_watch_history (profile_id, season_id, watch_number, watched_at)
    SELECT ?, ?, COALESCE(MAX(watch_number), 0) + 1, CURRENT_TIMESTAMP
    FROM season_watch_history
    WHERE profile_id = ? AND season_id = ?
  `;
  await conn.execute<ResultSetHeader>(query, [profileId, seasonId, profileId, seasonId]);
}

/**
 * Log a show completion event. Called when a show's calculated status
 * transitions to WATCHED or UP_TO_DATE during a propagation step.
 */
export async function logShowWatched(conn: PoolConnection, profileId: number, showId: number): Promise<void> {
  const query = `
    INSERT INTO show_watch_history (profile_id, show_id, watch_number, watched_at)
    SELECT ?, ?, COALESCE(MAX(watch_number), 0) + 1, CURRENT_TIMESTAMP
    FROM show_watch_history
    WHERE profile_id = ? AND show_id = ?
  `;
  await conn.execute<ResultSetHeader>(query, [profileId, showId, profileId, showId]);
}

// ---------------------------------------------------------------------------
// Rewatch reset operations
// ---------------------------------------------------------------------------

/**
 * Reset all watched episodes and seasons for a show back to NOT_WATCHED for a
 * full rewatch, and increment show_watch_status.rewatch_count so the show
 * still appears in the Keep Watching query even with zero WATCHED episodes.
 *
 * Only WATCHED episodes are reset — UNAIRED and NOT_WATCHED rows are untouched.
 * watched_at is nulled out so the next mark sets a fresh timestamp.
 * The watch_history tables are NOT touched; history is preserved across rewatches.
 *
 * Note: show status recalculation after the reset is the caller's responsibility
 * (the service layer handles returning the updated show/episodes to the client).
 */
export async function resetShowForRewatch(conn: PoolConnection, profileId: number, showId: number): Promise<void> {
  // Reset all previously-WATCHED episodes in the show
  await conn.execute<ResultSetHeader>(
    `
    UPDATE episode_watch_status ews
    INNER JOIN episodes e ON ews.episode_id = e.id
    INNER JOIN seasons se ON e.season_id = se.id
    SET
      ews.status = 'NOT_WATCHED',
      ews.watched_at = NULL,
      ews.is_prior_watch = FALSE,
      ews.updated_at = CURRENT_TIMESTAMP
    WHERE ews.profile_id = ?
      AND se.show_id = ?
      AND ews.status = 'WATCHED'
  `,
    [profileId, showId],
  );

  // Reset all seasons in the show to NOT_WATCHED
  await conn.execute<ResultSetHeader>(
    `
    UPDATE season_watch_status sws
    INNER JOIN seasons se ON sws.season_id = se.id
    SET sws.status = 'NOT_WATCHED', sws.updated_at = CURRENT_TIMESTAMP
    WHERE sws.profile_id = ? AND se.show_id = ?
  `,
    [profileId, showId],
  );

  // Reset show to NOT_WATCHED and record the rewatch
  await conn.execute<ResultSetHeader>(
    `
    UPDATE show_watch_status
    SET
      status = 'NOT_WATCHED',
      rewatch_count = rewatch_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE profile_id = ? AND show_id = ?
  `,
    [profileId, showId],
  );
}

/**
 * Reset all watched episodes within a single season back to NOT_WATCHED for a
 * season-level rewatch. The season status is also reset to NOT_WATCHED.
 *
 * Show status recalculation is the caller's responsibility — since other seasons
 * may still have WATCHED episodes the show naturally becomes WATCHING, which the
 * service should verify and persist after calling this function.
 */
export async function resetSeasonForRewatch(conn: PoolConnection, profileId: number, seasonId: number): Promise<void> {
  // Reset all previously-WATCHED episodes in the season
  await conn.execute<ResultSetHeader>(
    `
    UPDATE episode_watch_status ews
    INNER JOIN episodes e ON ews.episode_id = e.id
    SET
      ews.status = 'NOT_WATCHED',
      ews.watched_at = NULL,
      ews.is_prior_watch = FALSE,
      ews.updated_at = CURRENT_TIMESTAMP
    WHERE ews.profile_id = ?
      AND e.season_id = ?
      AND ews.status = 'WATCHED'
  `,
    [profileId, seasonId],
  );

  // Reset the season itself to NOT_WATCHED
  await conn.execute<ResultSetHeader>(
    `
    UPDATE season_watch_status
    SET status = 'NOT_WATCHED', updated_at = CURRENT_TIMESTAMP
    WHERE profile_id = ? AND season_id = ?
  `,
    [profileId, seasonId],
  );
}

/**
 * Reset a single movie back to NOT_WATCHED for a rewatch and increment rewatch_count.
 * watched_at is nulled out so the next mark sets a fresh timestamp.
 */
export async function resetMovieForRewatch(conn: PoolConnection, profileId: number, movieId: number): Promise<void> {
  await conn.execute<ResultSetHeader>(
    `
    UPDATE movie_watch_status
    SET
      status = 'NOT_WATCHED',
      watched_at = NULL,
      rewatch_count = rewatch_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE profile_id = ? AND movie_id = ?
  `,
    [profileId, movieId],
  );
}

/**
 * Log a single episode rewatch event without changing its WATCHED status.
 * Delegates to logEpisodeWatched; watch_number auto-increments.
 */
export async function recordEpisodeRewatch(conn: PoolConnection, profileId: number, episodeId: number): Promise<void> {
  await logEpisodeWatched(conn, profileId, episodeId, false);
}

/**
 * Look up the show that owns a given season.
 * Called inside a season-rewatch transaction to resolve the showId for status updates.
 */
export async function getShowIdForSeason(conn: PoolConnection, seasonId: number): Promise<number | null> {
  const [rows] = await conn.execute<SeasonShowRow[]>(`SELECT show_id FROM seasons WHERE id = ?`, [seasonId]);
  return rows[0]?.show_id ?? null;
}

/**
 * Recalculate and persist a show's status after a season-level rewatch reset.
 * If any season remains non-NOT_WATCHED the show becomes WATCHING; otherwise NOT_WATCHED.
 */
export async function recalculateShowStatusAfterSeasonReset(
  conn: PoolConnection,
  profileId: number,
  showId: number,
): Promise<void> {
  await conn.execute<ResultSetHeader>(
    `
    UPDATE show_watch_status sws
    SET sws.status = CASE
      WHEN EXISTS (
        SELECT 1 FROM season_watch_status sws2
        INNER JOIN seasons s ON sws2.season_id = s.id
        WHERE sws2.profile_id = ? AND s.show_id = ?
          AND sws2.status != 'NOT_WATCHED'
      ) THEN 'WATCHING'
      ELSE 'NOT_WATCHED'
    END,
    sws.updated_at = CURRENT_TIMESTAMP
    WHERE sws.profile_id = ? AND sws.show_id = ?
  `,
    [profileId, showId, profileId, showId],
  );
}

// ---------------------------------------------------------------------------
// Read operations (use pool directly — no transaction needed)
// ---------------------------------------------------------------------------

/**
 * Retrieve paginated watch history for a profile, combining episode and movie
 * watch events ordered by watchedAt.
 *
 * @param profileId         Profile to fetch history for
 * @param page              1-based page number
 * @param pageSize          Number of items per page
 * @param contentType       'episode', 'movie', or 'all' (default)
 * @param sortOrder         'asc' or 'desc' (default) — sort direction on watchedAt
 * @param dateFrom          ISO date string 'YYYY-MM-DD' — inclusive lower bound on watchedAt
 * @param dateTo            ISO date string 'YYYY-MM-DD' — inclusive upper bound on watchedAt (full day)
 * @param isPriorWatchOnly  When true, only return prior-watch episode entries (movies are always excluded)
 * @param searchQuery       Filter episodes by show name, movies by title (partial match)
 */
export async function getWatchHistoryForProfile(
  profileId: number,
  page: number,
  pageSize: number,
  contentType: 'episode' | 'movie' | 'all' = 'all',
  sortOrder: 'asc' | 'desc' = 'desc',
  dateFrom?: string,
  dateTo?: string,
  isPriorWatchOnly: boolean = false,
  searchQuery?: string,
): Promise<{ items: WatchHistoryRow[]; totalCount: number }> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getWatchHistoryForProfile', async () => {
      const pool = getDbPool();
      const pageNum = Math.max(1, Math.floor(Number(page)));
      const pageSizeNum = Math.max(1, Math.min(100, Math.floor(Number(pageSize))));
      const offset = (pageNum - 1) * pageSizeNum;

      // Validate sort order against a whitelist before interpolating into SQL
      const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Build per-branch filter clauses and their bind params
      const episodeFilters: string[] = [];
      const episodeFilterParams: (string | number)[] = [];
      const movieFilters: string[] = [];
      const movieFilterParams: (string | number)[] = [];

      if (dateFrom) {
        episodeFilters.push('AND ewh.watched_at >= ?');
        episodeFilterParams.push(dateFrom);
        movieFilters.push('AND mwh.watched_at >= ?');
        movieFilterParams.push(dateFrom);
      }
      if (dateTo) {
        // Include the full day of dateTo by comparing against start of the next day
        episodeFilters.push('AND ewh.watched_at < DATE_ADD(?, INTERVAL 1 DAY)');
        episodeFilterParams.push(dateTo);
        movieFilters.push('AND mwh.watched_at < DATE_ADD(?, INTERVAL 1 DAY)');
        movieFilterParams.push(dateTo);
      }
      if (isPriorWatchOnly) {
        episodeFilters.push('AND ewh.is_prior_watch = TRUE');
        // Movies are never prior-watches; exclude them entirely when this filter is active
        movieFilters.push('AND 1 = 0');
      }
      if (searchQuery) {
        episodeFilters.push('AND sh.title LIKE ?');
        episodeFilterParams.push(`%${searchQuery}%`);
        movieFilters.push('AND m.title LIKE ?');
        movieFilterParams.push(`%${searchQuery}%`);
      }

      const episodeExtraClauses = episodeFilters.join('\n        ');
      const movieExtraClauses = movieFilters.join('\n        ');

      const episodePart = `
        SELECT
          ewh.id          AS historyId,
          'episode'       AS contentType,
          e.id            AS contentId,
          e.title         AS title,
          sh.title        AS parentTitle,
          e.season_number AS seasonNumber,
          e.episode_number AS episodeNumber,
          sh.poster_image AS posterImage,
          ewh.watched_at  AS watchedAt,
          ewh.watch_number AS watchNumber,
          ewh.is_prior_watch AS isPriorWatch,
          e.runtime       AS runtime
        FROM episode_watch_history ewh
        JOIN episodes e ON ewh.episode_id = e.id
        JOIN seasons se ON e.season_id = se.id
        JOIN shows sh ON se.show_id = sh.id
        WHERE ewh.profile_id = ?
        ${episodeExtraClauses}
      `;

      const moviePart = `
        SELECT
          mwh.id          AS historyId,
          'movie'         AS contentType,
          m.id            AS contentId,
          m.title         AS title,
          NULL            AS parentTitle,
          NULL            AS seasonNumber,
          NULL            AS episodeNumber,
          m.poster_image  AS posterImage,
          mwh.watched_at  AS watchedAt,
          mwh.watch_number AS watchNumber,
          FALSE           AS isPriorWatch,
          m.runtime       AS runtime
        FROM movie_watch_history mwh
        JOIN movies m ON mwh.movie_id = m.id
        WHERE mwh.profile_id = ?
        ${movieExtraClauses}
      `;

      let dataQuery: string;
      let countQuery: string;
      let dataParams: (string | number)[];
      let countParams: (string | number)[];

      if (contentType === 'episode') {
        dataQuery = `${episodePart} ORDER BY watchedAt ${safeOrder} LIMIT ${pageSizeNum} OFFSET ${offset}`;
        countQuery = `SELECT COUNT(*) AS total FROM (${episodePart}) sub`;
        dataParams = [profileId, ...episodeFilterParams];
        countParams = [profileId, ...episodeFilterParams];
      } else if (contentType === 'movie') {
        dataQuery = `${moviePart} ORDER BY watchedAt ${safeOrder} LIMIT ${pageSizeNum} OFFSET ${offset}`;
        countQuery = `SELECT COUNT(*) AS total FROM (${moviePart}) sub`;
        dataParams = [profileId, ...movieFilterParams];
        countParams = [profileId, ...movieFilterParams];
      } else {
        const unionPart = `(${episodePart}) UNION ALL (${moviePart})`;
        dataQuery = `SELECT * FROM (${unionPart}) combined ORDER BY watchedAt ${safeOrder} LIMIT ${pageSizeNum} OFFSET ${offset}`;
        countQuery = `SELECT COUNT(*) AS total FROM (${unionPart}) combined`;
        dataParams = [profileId, ...episodeFilterParams, profileId, ...movieFilterParams];
        countParams = [profileId, ...episodeFilterParams, profileId, ...movieFilterParams];
      }

      const [[countRow], [items]] = await Promise.all([
        pool.execute<WatchHistoryCountRow[]>(countQuery, countParams),
        pool.execute<WatchHistoryRow[]>(dataQuery, dataParams),
      ]);

      return {
        items,
        totalCount: countRow[0]?.total ?? 0,
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'getting watch history for profile');
  }
}

/**
 * Return the total number of times a specific episode has been watched by a profile.
 * Returns 0 if the episode has never been watched.
 */
export async function getEpisodeWatchCount(profileId: number, episodeId: number): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getEpisodeWatchCount', async () => {
      const [rows] = await getDbPool().execute<EpisodeWatchCountRow[]>(
        `SELECT COUNT(*) AS watch_count FROM episode_watch_history WHERE profile_id = ? AND episode_id = ?`,
        [profileId, episodeId],
      );
      return rows[0]?.watch_count ?? 0;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting episode watch count');
  }
}
