import { SeasonReferenceRow } from '../../types/seasonTypes';
import { ShowSeasonStatusRow, WatchStatusRow } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import * as seasonsDb from '../seasonsDb';
import { WatchStatus, isWatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

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
export async function saveFavorite(profileId: number, showId: number, saveChildren: boolean): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await transactionHelper.executeInTransaction(async (connection) => {
      const query = 'INSERT IGNORE INTO show_watch_status (profile_id, show_id) VALUES (?,?)';
      await connection.execute<ResultSetHeader>(query, [profileId, showId]);

      if (saveChildren) {
        const seasonQuery = 'SELECT id FROM seasons WHERE show_id = ?';
        const [rows] = await connection.execute<SeasonReferenceRow[]>(seasonQuery, [showId]);
        const seasonIds = rows.map((row) => row.id);

        if (seasonIds.length > 0) {
          const seasonPlaceholders = seasonIds.map(() => '(?,?)').join(',');
          const seasonParams = seasonIds.flatMap((id) => [profileId, id]);
          const seasonBatchQuery = `INSERT IGNORE INTO season_watch_status (profile_id, season_id) VALUES ${seasonPlaceholders}`;
          await connection.execute(seasonBatchQuery, seasonParams);

          if (seasonIds.length > 0) {
            const seasonParamsStr = seasonIds.map(() => '?').join(',');
            const episodesBatchQuery = `INSERT IGNORE INTO episode_watch_status (profile_id, episode_id) SELECT ?, id FROM episodes WHERE season_id IN (${seasonParamsStr})`;
            await connection.execute(episodesBatchQuery, [profileId, ...seasonIds]);
          }
        }
      }
    });
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
 * @returns A promise that resolves when the show, seasons and episodes have been removed from favorites
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function removeFavorite(profileId: number, showId: number): Promise<void> {
  const transactionHelper = new TransactionHelper();

  try {
    await transactionHelper.executeInTransaction(async (connection) => {
      const seasonQuery = 'SELECT id FROM seasons WHERE show_id = ?';
      const [rows] = await connection.execute<SeasonReferenceRow[]>(seasonQuery, [showId]);
      const seasonIds = rows.map((row) => row.id);

      if (seasonIds.length > 0) {
        const seasonPlaceholders = seasonIds.map(() => '?').join(',');
        const episodeDeleteQuery = `DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (${seasonPlaceholders}))`;
        await connection.execute(episodeDeleteQuery, [profileId, ...seasonIds]);

        const seasonDeleteQuery = `DELETE FROM season_watch_status WHERE profile_id = ? AND season_id IN (${seasonPlaceholders})`;
        await connection.execute(seasonDeleteQuery, [profileId, ...seasonIds]);
      }

      const showDeleteQuery = 'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
      await connection.execute(showDeleteQuery, [profileId, showId]);
    });
  } catch (error) {
    handleDatabaseError(error, 'removing a show as a favorite');
  }
}

/**
 * Updates the watch status of a show for a specific profile
 *
 * This function marks a show as watched, watching, not watched, or up to date
 * for a specific user profile.
 *
 * @param profileId - ID of the profile to update the status for
 * @param showId - ID of the show to update
 * @param status - New watch status ('WATCHED', 'WATCHING', 'NOT_WATCHED', or 'UP_TO_DATE')
 * @returns `True` if the status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateWatchStatus(profileId: number, showId: number, status: WatchStatus): Promise<boolean> {
  try {
    const showQuery = 'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(showQuery, [status, profileId, showId]);

    // Return true if at least one row was affected (watch status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating the watch status of a show');
  }
}

/**
 * Updates the watch status of a show for a specific profile based on the status of its seasons.
 *
 * Show status logic:
 * - WATCHED: All seasons are WATCHED (no UP_TO_DATE seasons)
 * - UP_TO_DATE: All seasons are either WATCHED or UP_TO_DATE, with at least one UP_TO_DATE
 * - WATCHING: Some seasons are WATCHED/UP_TO_DATE and others are NOT_WATCHED, or any season is WATCHING
 * - NOT_WATCHED: All seasons are NOT_WATCHED
 *
 * @param profileId - ID of the profile to update the watch status for
 * @param showId - ID of the show to update
 * @returns A promise that resolves when the update is complete
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateWatchStatusBySeason(profileId: number, showId: number): Promise<void> {
  try {
    const pool = getDbPool();

    const seasonStatusQuery = `
      SELECT 
        COUNT(*) as total_seasons,
        SUM(CASE WHEN sws.status = 'UNAIRED' THEN 1 ELSE 0 END) as unaired_seasons,
        SUM(CASE WHEN sws.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_seasons,
        SUM(CASE WHEN sws.status = 'WATCHING' THEN 1 ELSE 0 END) as watching_seasons,
        SUM(CASE WHEN sws.status = 'NOT_WATCHED' THEN 1 ELSE 0 END) as not_watched_seasons,
        SUM(CASE WHEN sws.status = 'UP_TO_DATE' THEN 1 ELSE 0 END) as up_to_date_seasons
      FROM seasons s 
      JOIN season_watch_status sws ON s.id = sws.season_id 
      WHERE s.show_id = ? AND sws.profile_id = ?
    `;

    const [seasonStatusRows] = await pool.execute<ShowSeasonStatusRow[]>(seasonStatusQuery, [showId, profileId]);
    if (!seasonStatusRows.length) return;

    const seasonStatus = seasonStatusRows[0];
    if (seasonStatus.total_seasons === 0) {
      await pool.execute('UPDATE show_watch_status SET status = NOT_WATCHED WHERE profile_id = ? AND show_id = ?', [
        profileId,
        showId,
      ]);
      return;
    }

    let showStatus = WatchStatus.NOT_WATCHED;
    if (seasonStatus.watched_seasons === seasonStatus.total_seasons) {
      showStatus = WatchStatus.WATCHED;
    } else if (
      seasonStatus.watched_seasons + seasonStatus.up_to_date_seasons === seasonStatus.total_seasons &&
      seasonStatus.up_to_date_seasons > 0
    ) {
      showStatus = WatchStatus.UP_TO_DATE;
    } else if (
      seasonStatus.watching_seasons > 0 ||
      (seasonStatus.watched_seasons > 0 && seasonStatus.not_watched_seasons > 0)
    ) {
      showStatus = WatchStatus.WATCHING;
    }

    await pool.execute('UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?', [
      showStatus,
      profileId,
      showId,
    ]);
  } catch (error) {
    handleDatabaseError(error, 'updating the watch status of a show by the status of its seasons');
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
 * @param status - New watch status ('WATCHED', 'WATCHING', 'NOT_WATCHED', or 'UP_TO_DATE')
 * @returns `True` if the watch status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateAllWatchStatuses(profileId: number, showId: number, status: WatchStatus): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      //update show
      const showQuery = 'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?';
      const [showResult] = await connection.execute<ResultSetHeader>(showQuery, [status, profileId, showId]);
      if (showResult.affectedRows === 0) return false;

      //update seasons (for show)
      if (status == WatchStatus.UP_TO_DATE) {
        const currentDate = new Date().toISOString().split('T')[0];
        updateSeasonsForUpToDate(showId, profileId, currentDate, connection);
        return true;
      } else {
        const seasonsQuery =
          'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id IN (SELECT id FROM seasons WHERE show_id = ?)';
        const [seasonsResult] = await connection.execute<ResultSetHeader>(seasonsQuery, [status, profileId, showId]);
        if (seasonsResult.affectedRows === 0) return false;

        //update episodes (for seasons/show)
        const episodeStatus = determineEpisodeStatus(status);
        const episodesQuery =
          'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id = ?))';
        const [episodesResult] = await connection.execute<ResultSetHeader>(episodesQuery, [
          episodeStatus,
          profileId,
          showId,
        ]);

        return episodesResult.affectedRows > 0;
      }
    });
  } catch (error) {
    handleDatabaseError(error, 'updating the watch status of a show and its children (seasons and episodes)');
  }
}

async function updateSeasonsForUpToDate(
  showId: number,
  profileId: number,
  currentDate: string,
  connection: PoolConnection,
): Promise<void> {
  const completelyAiredIds = await getCompletelyAiredSeasons(showId, currentDate, connection);
  const partiallyAiredIds = await getPartiallyAiredSeasons(showId, currentDate, connection);
  const unairedIds = await getUnairedSeasons(showId, currentDate, connection);

  for (const seasonId of completelyAiredIds) {
    await seasonsDb.updateAllWatchStatuses(profileId, seasonId, WatchStatus.WATCHED);
  }

  for (const seasonId of partiallyAiredIds) {
    await seasonsDb.updateAllWatchStatuses(profileId, seasonId, WatchStatus.UP_TO_DATE);
  }

  for (const seasonId of unairedIds) {
    await seasonsDb.updateAllWatchStatuses(profileId, seasonId, WatchStatus.NOT_WATCHED);
  }
}

async function getCompletelyAiredSeasons(
  showId: number,
  currentDate: string,
  connection: PoolConnection,
): Promise<number[]> {
  const query = `
    SELECT s.id
    FROM seasons s
    LEFT JOIN episodes e ON s.id = e.season_id
    WHERE s.show_id = ?
    GROUP BY s.id
    HAVING 
      COUNT(e.id) > 0 
      AND COUNT(CASE WHEN e.air_date IS NULL OR e.air_date > ? THEN 1 END) = 0
  `;

  const [rows] = await connection.execute<SeasonReferenceRow[]>(query, [showId, currentDate]);
  return rows.map((row) => row.id);
}

async function getPartiallyAiredSeasons(
  showId: number,
  currentDate: string,
  connection: PoolConnection,
): Promise<number[]> {
  const query = `
    SELECT s.id
    FROM seasons s
    LEFT JOIN episodes e ON s.id = e.season_id
    WHERE s.show_id = ?
    GROUP BY s.id
    HAVING 
      COUNT(e.id) > 0
      AND COUNT(CASE WHEN e.air_date IS NOT NULL AND e.air_date <= ? THEN 1 END) > 0
      AND COUNT(CASE WHEN e.air_date IS NULL OR e.air_date > ? THEN 1 END) > 0
  `;

  const [rows] = await connection.execute<SeasonReferenceRow[]>(query, [showId, currentDate, currentDate]);
  return rows.map((row) => row.id);
}

async function getUnairedSeasons(showId: number, currentDate: string, connection: PoolConnection): Promise<number[]> {
  const query = `
    SELECT s.id
    FROM seasons s
    LEFT JOIN episodes e ON s.id = e.season_id
    WHERE s.show_id = ?
    GROUP BY s.id
    HAVING 
      COUNT(e.id) = 0 
      OR COUNT(CASE WHEN e.air_date IS NOT NULL AND e.air_date <= ? THEN 1 END) = 0
  `;

  const [rows] = await connection.execute<SeasonReferenceRow[]>(query, [showId, currentDate]);
  return rows.map((row) => row.id);
}

function determineEpisodeStatus(status: string) {
  if (status === WatchStatus.NOT_WATCHED) {
    return WatchStatus.NOT_WATCHED;
  }
  return WatchStatus.WATCHED;
}

/**
 * Gets the current watch status of a show for a profile
 *
 * @param profileId - ID of the profile to get the watch status for
 * @param showId - ID of the show to get the watch status for
 * @returns The watch status of the show or null if not found
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getWatchStatus(profileId: number, showId: number): Promise<WatchStatus | null> {
  try {
    const query = 'SELECT status FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
    const [rows] = await getDbPool().execute<WatchStatusRow[]>(query, [profileId, showId]);

    if (rows.length === 0) return null;

    const status = rows[0].status as WatchStatus;
    if (isWatchStatus(status)) {
      return status;
    } else {
      return WatchStatus.NOT_WATCHED;
    }
  } catch (error) {
    handleDatabaseError(error, 'getting the watch status of a show');
  }
}
