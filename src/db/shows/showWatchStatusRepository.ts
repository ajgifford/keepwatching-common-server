import { EpisodeReferenceRow } from '../../types/episodeTypes';
import { SeasonReferenceRow } from '../../types/seasonTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * Adds a show to a user's favorites/watchlist
 *
 * This function inserts a record in the show_watch_status table to associate
 * the show with a user profile, enabling tracking of watch status.
 *
 * @param profileId - ID of the profile to add this show to
 * @param showId - ID of the show to add
 * @param saveChildren - `true` if the children (seasons and episodes) should also be saved, `false` otherwise
 * @returns  A promise that resolves when the favorite has been added
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveFavorite(
  profileId: number,
  showId: number,
  saveChildren: boolean,
  status: WatchStatus = WatchStatus.NOT_WATCHED,
): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await DbMonitor.getInstance().executeWithTiming(
      'saveFavorite',
      async () => {
        await transactionHelper.executeInTransaction(async (connection) => {
          const query = 'INSERT IGNORE INTO show_watch_status (profile_id, show_id, status) VALUES (?,?,?)';
          await connection.execute<ResultSetHeader>(query, [profileId, showId, status]);

          if (saveChildren) {
            const seasonQuery = 'SELECT id, release_date FROM seasons WHERE show_id = ?';
            const [rows] = await connection.execute<SeasonReferenceRow[]>(seasonQuery, [showId]);

            const now = new Date();
            const seasonValues: [string, number, number][] = rows.map((row) => {
              const releaseDate = new Date(row.release_date);
              const status = releaseDate > now ? 'UNAIRED' : 'NOT_WATCHED';
              return [status, profileId, row.id];
            });

            if (seasonValues.length > 0) {
              const seasonPlaceholders = seasonValues.map(() => '(?,?,?)').join(',');
              const seasonParams = seasonValues.flat();
              const seasonBatchQuery = `INSERT IGNORE INTO season_watch_status (status, profile_id, season_id) VALUES ${seasonPlaceholders}`;
              await connection.execute(seasonBatchQuery, seasonParams);

              const seasonIds = rows.map((row) => row.id);
              const seasonParamsStr = seasonIds.map(() => '?').join(',');
              const episodeQuery = `SELECT id, air_date FROM episodes WHERE season_id IN (${seasonParamsStr})`;
              const [episodeRows] = await connection.execute<EpisodeReferenceRow[]>(episodeQuery, seasonIds);

              const episodeValues: [string, number, number][] = episodeRows.map((row) => {
                const airDate = new Date(row.air_date);
                const status = airDate > now ? 'UNAIRED' : 'NOT_WATCHED';
                return [status, profileId, row.id];
              });

              if (episodeValues.length > 0) {
                const episodePlaceholders = episodeValues.map(() => '(?,?,?)').join(',');
                const episodeParams = episodeValues.flat();
                const episodesBatchQuery = `INSERT IGNORE INTO episode_watch_status (status, profile_id, episode_id) VALUES ${episodePlaceholders}`;
                await connection.execute(episodesBatchQuery, episodeParams);
              }
            }
          }
        });
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'saving a show as a favorite');
  }
}

/**
 * Removes a show from a user's favorites
 * This function uses a transaction to ensure that both the show and all its seasons and episodes
 * are removed from the user's favorites consistently
 *
 * @param profileId - ID of the profile to remove the show from favorites
 * @param showId - ID of the show to remove
 * @param removeHistory - `true` to also delete the profile's watch history for this show (a
 *   deliberate, user-authorized exception to history normally being append-only); `false`
 *   (default) preserves history for stats even though the favorite/status rows are gone
 * @returns A promise that resolves when the show, seasons and episodes have been removed from favorites
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function removeFavorite(profileId: number, showId: number, removeHistory: boolean = false): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await DbMonitor.getInstance().executeWithTiming(
      'removeFavorite',
      async () => {
        await transactionHelper.executeInTransaction(async (connection) => {
          const seasonQuery = 'SELECT id, release_date FROM seasons WHERE show_id = ?';
          const [rows] = await connection.execute<SeasonReferenceRow[]>(seasonQuery, [showId]);
          const seasonIds = rows.map((row) => row.id);

          if (seasonIds.length > 0) {
            const seasonPlaceholders = seasonIds.map(() => '?').join(',');
            const episodeDeleteQuery = `DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (${seasonPlaceholders}))`;
            await connection.execute(episodeDeleteQuery, [profileId, ...seasonIds]);

            const seasonDeleteQuery = `DELETE FROM season_watch_status WHERE profile_id = ? AND season_id IN (${seasonPlaceholders})`;
            await connection.execute(seasonDeleteQuery, [profileId, ...seasonIds]);

            if (removeHistory) {
              const episodeHistoryDeleteQuery = `DELETE FROM episode_watch_history WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (${seasonPlaceholders}))`;
              await connection.execute(episodeHistoryDeleteQuery, [profileId, ...seasonIds]);

              const seasonHistoryDeleteQuery = `DELETE FROM season_watch_history WHERE profile_id = ? AND season_id IN (${seasonPlaceholders})`;
              await connection.execute(seasonHistoryDeleteQuery, [profileId, ...seasonIds]);
            }
          }

          const showDeleteQuery = 'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
          await connection.execute(showDeleteQuery, [profileId, showId]);

          if (removeHistory) {
            const showHistoryDeleteQuery = 'DELETE FROM show_watch_history WHERE profile_id = ? AND show_id = ?';
            await connection.execute(showHistoryDeleteQuery, [profileId, showId]);
          }
        });
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'removing a show as a favorite');
  }
}

/**
 * Checks whether a profile has any surviving watch history for a show (i.e. episode watch
 * history rows left over from a previous favorite/unfavorite cycle where history was kept).
 *
 * @param profileId - ID of the profile
 * @param showId - ID of the show
 * @returns `true` if at least one episode_watch_history row exists for this profile and show
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function hasWatchHistory(profileId: number, showId: number): Promise<boolean> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'hasWatchHistory',
      async () => {
        const query = `
          SELECT EXISTS(
            SELECT 1
            FROM episode_watch_history ewh
            JOIN episodes e ON e.id = ewh.episode_id
            JOIN seasons se ON se.id = e.season_id
            WHERE ewh.profile_id = ? AND se.show_id = ?
          ) AS hasHistory
        `;
        const [rows] = await getDbPool().execute<(RowDataPacket & { hasHistory: number })[]>(query, [
          profileId,
          showId,
        ]);
        return Boolean(rows[0]?.hasHistory);
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'checking for existing show watch history');
  }
}

/**
 * Rebuilds episode_watch_status rows for a show from surviving episode_watch_history rows,
 * using each episode's most recent watch (highest watch_number). Episodes with no surviving
 * history are left as-is (already seeded NOT_WATCHED/UNAIRED by saveFavorite's child-seeding).
 * Season and show status are NOT recalculated here — callers must call
 * `WatchStatusDbService.checkAndUpdateShowWatchStatus` afterward to recompute those aggregates.
 *
 * @param profileId - ID of the profile
 * @param showId - ID of the show
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function rebuildStatusFromHistory(profileId: number, showId: number): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await DbMonitor.getInstance().executeWithTiming(
      'rebuildStatusFromHistory',
      async () => {
        await transactionHelper.executeInTransaction(async (connection) => {
          const query = `
            INSERT INTO episode_watch_status (profile_id, episode_id, status, watched_at, is_prior_watch)
            SELECT profile_id, episode_id, 'WATCHED', watched_at, is_prior_watch
            FROM (
              SELECT
                ewh.profile_id,
                ewh.episode_id,
                ewh.watched_at,
                ewh.is_prior_watch,
                ROW_NUMBER() OVER (PARTITION BY ewh.episode_id ORDER BY ewh.watch_number DESC) AS rn
              FROM episode_watch_history ewh
              JOIN episodes e ON e.id = ewh.episode_id
              JOIN seasons se ON se.id = e.season_id
              WHERE ewh.profile_id = ? AND se.show_id = ?
            ) latest
            WHERE rn = 1
            ON DUPLICATE KEY UPDATE
              status = 'WATCHED',
              watched_at = VALUES(watched_at),
              is_prior_watch = VALUES(is_prior_watch),
              updated_at = CURRENT_TIMESTAMP
          `;
          await connection.execute<ResultSetHeader>(query, [profileId, showId]);
        });
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'rebuilding show watch status from history');
  }
}

/**
 * Restores `show_watch_status.rewatch_count` for a show from its most recent surviving
 * `show_watch_history` row (highest watch_number), on re-favorite. Deliberately narrower than
 * {@link rebuildStatusFromHistory} — it restores only `rewatch_count`, not `status`/`watched_at`,
 * since those are already correctly rebuilt by `rebuildStatusFromHistory` plus the subsequent
 * show status recalculation.
 *
 * @param profileId - ID of the profile
 * @param showId - ID of the show
 * @returns `true` if a status row was updated, `false` if no surviving show-level history exists
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function rebuildShowRewatchCountFromHistory(profileId: number, showId: number): Promise<boolean> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'rebuildShowRewatchCountFromHistory',
      async () => {
        const query = `
          UPDATE show_watch_status shws
          JOIN (
            SELECT watch_number FROM show_watch_history
            WHERE profile_id = ? AND show_id = ?
            ORDER BY watch_number DESC LIMIT 1
          ) latest ON TRUE
          SET shws.rewatch_count = GREATEST(latest.watch_number - 1, 0), shws.updated_at = CURRENT_TIMESTAMP
          WHERE shws.profile_id = ? AND shws.show_id = ?
        `;
        const [result] = await getDbPool().execute<ResultSetHeader>(query, [profileId, showId, profileId, showId]);
        return result.affectedRows > 0;
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'rebuilding show rewatch count from history');
  }
}
