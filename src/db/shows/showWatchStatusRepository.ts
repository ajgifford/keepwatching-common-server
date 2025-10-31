import { SeasonReferenceRow } from '../../types/seasonTypes';
import { DbMonitor } from '../../utils/dbMonitoring';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';
import { EpisodeReferenceRow } from 'src/types/episodeTypes';

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
    await DbMonitor.getInstance().executeWithTiming('saveFavorite', async () => {
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
    await DbMonitor.getInstance().executeWithTiming('removeFavorite', async () => {
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
        }

        const showDeleteQuery = 'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?';
        await connection.execute(showDeleteQuery, [profileId, showId]);
      });
    });
  } catch (error) {
    handleDatabaseError(error, 'removing a show as a favorite');
  }
}
