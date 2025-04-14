import { DatabaseError } from '../../middleware/errorMiddleware';
import { getDbPool } from '../../utils/db';
import { TransactionHelper } from '../../utils/transactionHelper';
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
export async function saveFavorite(profileId: string, showId: number, saveChildren: boolean): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await transactionHelper.executeInTransaction(async (connection) => {
      const query = 'INSERT IGNORE INTO show_watch_status (profile_id, show_id) VALUES (?,?)';
      await connection.execute<ResultSetHeader>(query, [Number(profileId), showId]);

      if (saveChildren) {
        const seasonQuery = 'SELECT id FROM seasons WHERE show_id = ?';
        const [rows] = await connection.execute<RowDataPacket[]>(seasonQuery, [showId]);
        const seasonIds = rows.map((row) => row.id);

        if (seasonIds.length > 0) {
          const seasonPlaceholders = seasonIds.map(() => '(?,?)').join(',');
          const seasonParams = seasonIds.flatMap((id) => [Number(profileId), id]);
          const seasonBatchQuery = `INSERT IGNORE INTO season_watch_status (profile_id, season_id) VALUES ${seasonPlaceholders}`;
          await connection.execute(seasonBatchQuery, seasonParams);

          if (seasonIds.length > 0) {
            const seasonParamsStr = seasonIds.map(() => '?').join(',');
            const episodesBatchQuery = `INSERT IGNORE INTO episode_watch_status (profile_id, episode_id) SELECT ?, id FROM episodes WHERE season_id IN (${seasonParamsStr})`;
            await connection.execute(episodesBatchQuery, [Number(profileId), ...seasonIds]);
          }
        }
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error saving a show as a favorite';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Removes a show from a user's favorites
 * This function uses a transaction to ensure that both the show and all its seasons and episodes
 * are removed from the user's favorites consistently
 *
 * @param profileId - ID of the profile to remove the show from favorites
 * @param showId - ID of the show to remove
 * @returns A promise that resolves when the show, seasons and episodes have been removed from favorites
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function removeFavorite(profileId: string, showId: number): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await transactionHelper.executeInTransaction(async (connection) => {
      const seasonQuery = 'SELECT id FROM seasons WHERE show_id = ?';
      const [rows] = await connection.execute<RowDataPacket[]>(seasonQuery, [showId]);
      const seasonIds = rows.map((row) => row.id);

      if (seasonIds.length > 0) {
        const seasonPlaceholders = seasonIds.map(() => '?').join(',');
        const episodeDeleteQuery = `DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (${seasonPlaceholders}))`;
        await connection.execute(episodeDeleteQuery, [Number(profileId), ...seasonIds]);

        const seasonDeleteQuery = `DELETE FROM season_watch_status WHERE profile_id = ? AND season_id IN (${seasonPlaceholders})`;
        await connection.execute(seasonDeleteQuery, [Number(profileId), ...seasonIds]);
      }

      const showDeleteQuery = 'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
      await connection.execute(showDeleteQuery, [profileId, showId]);
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error removing a show as a favorite';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a show for a specific profile
 *
 * This function marks a show as watched, watching, or not watched
 * for a specific user profile.
 *
 * @param profileId - ID of the profile to update the status for
 * @param showId - ID of the show to update
 * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
 * @returns `True` if the status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateWatchStatus(profileId: string, showId: number, status: string): Promise<boolean> {
  try {
    const showQuery = 'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(showQuery, [status, profileId, showId]);

    // Return true if at least one row was affected (watch status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error updating a show watch status';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a show for a specific profile based on the status of its seasons.
 * This function examines all seasons associated with the show and determines the appropriate
 * show status based on season statuses.
 *
 * - If all seasons have the same status, the show gets that status
 * - If seasons have mixed statuses, the shows is marked as "WATCHING"
 * - If no seasons exist or no watch status information is available, the show is marked as "NOT_WATCHED"
 *
 * @param profileId - ID of the profile to update the watch status for
 * @param showId - ID of the show to update
 * @returns A promise that resolves when the update is complete
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateWatchStatusBySeason(profileId: string, showId: number): Promise<void> {
  try {
    const pool = getDbPool();

    const seasonWatchStatusQuery = `SELECT CASE WHEN COUNT(DISTINCT status) = 1 THEN MAX(status) WHEN COUNT(*) = 0 THEN 'NOT_WATCHED' ELSE 'WATCHING' END AS show_status FROM seasons s JOIN season_watch_status sws ON s.id = sws.season_id WHERE s.show_id = ? AND sws.profile_id = ?`;
    const [statusResult] = await pool.execute<RowDataPacket[]>(seasonWatchStatusQuery, [showId, profileId]);

    if (!statusResult.length) return;

    const showStatusUpdateStmt = 'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?';
    const showStatus = statusResult[0].show_status;
    await pool.execute(showStatusUpdateStmt, [showStatus, profileId, showId]);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error updating a show watch status using seasons';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a show and its seasons and episodes for a specific profile
 *
 * This function uses a transaction to ensure that the show, all its seasons, and all their episodes
 * are updated consistently to the same watch status.
 *
 * @param profileId - ID of the profile to update the watch status for
 * @param showId - ID of the show to update
 * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
 * @returns `True` if the watch status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateAllWatchStatuses(profileId: string, showId: number, status: string): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      //update show
      const showQuery = 'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?';
      const [showResult] = await connection.execute<ResultSetHeader>(showQuery, [status, profileId, showId]);
      if (showResult.affectedRows === 0) return false;

      //update seasons (for show)
      const seasonsQuery =
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id IN (SELECT id FROM seasons WHERE show_id = ?)';
      const [seasonsResult] = await connection.execute<ResultSetHeader>(seasonsQuery, [status, profileId, showId]);
      if (seasonsResult.affectedRows === 0) return false;

      //update episodes (for seasons/show)
      const episodesQuery =
        'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id = ?))';
      const [episodesResult] = await connection.execute<ResultSetHeader>(episodesQuery, [status, profileId, showId]);

      return episodesResult.affectedRows > 0;
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown database error updating all watch statuses of a show (including seasons and episodes)';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Gets the current watch status of a show for a profile
 *
 * @param profileId - ID of the profile to get the watch status for
 * @param showId - ID of the show to get the watch status for
 * @returns The watch status of the show or null if not found
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getWatchStatus(profileId: string, showId: number): Promise<string | null> {
  try {
    const query = 'SELECT status FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [profileId, showId]);

    if (rows.length === 0) return null;

    return rows[0].status;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting the watch status for a show';
    throw new DatabaseError(errorMessage, error);
  }
}
