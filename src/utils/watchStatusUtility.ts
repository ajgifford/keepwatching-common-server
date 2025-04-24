import { cliLogger } from '../logger/logger';
import { WatchStatus } from '../types/watchStatusTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { cli } from 'winston/lib/winston/config';

/**
 * Utility for working with watch statuses
 * Provides helper functions for managing watch status values
 */
export class WatchStatusUtility {
  /**
   * Converts a legacy watch status to the new format if needed
   *
   * @param status The status string to convert
   * @returns The properly formatted watch status
   */
  public static convertStatus(status: string): WatchStatus {
    if (Object.values(WatchStatus).includes(status as WatchStatus)) {
      return status as WatchStatus;
    }

    // Handle any legacy status values (though we shouldn't have any)
    switch (status) {
      case 'NOT_WATCHED':
        return WatchStatus.NOT_WATCHED;
      case 'WATCHING':
        return WatchStatus.WATCHING;
      case 'WATCHED':
        return WatchStatus.WATCHED;
      default:
        return WatchStatus.NOT_WATCHED;
    }
  }

  /**
   * Determines the appropriate watch status when a user has completed watching content
   * but new content is still being released
   *
   * @param isComplete Whether all existing episodes are complete
   * @param isInProduction Whether the show is still in production
   * @param hasUpcomingEpisodes Whether there are upcoming episodes
   * @returns The appropriate watch status
   */
  public static determineCompletionStatus(
    isComplete: boolean,
    isInProduction: boolean,
    hasUpcomingEpisodes: boolean,
  ): WatchStatus {
    if (!isComplete) {
      return WatchStatus.WATCHING;
    }

    // All content is complete, but show is still active
    if (isInProduction || hasUpcomingEpisodes) {
      return WatchStatus.UP_TO_DATE;
    }

    // Show is complete and not in production
    return WatchStatus.WATCHED;
  }

  /**
   * Updates all rows in the database that have WATCHED status to UP_TO_DATE
   * for shows that are still in production
   *
   * This is useful as a migration utility when implementing the new status
   *
   * @returns Number of rows updated in each table
   */
  public static async migrateWatchedToUpToDate(): Promise<{
    shows: number;
    seasons: number;
  }> {
    try {
      const pool = getDbPool();

      // Update show statuses
      const showQuery = `
        UPDATE show_watch_status sws
        JOIN shows s ON sws.show_id = s.id
        SET sws.status = '${WatchStatus.UP_TO_DATE}'
        WHERE sws.status = '${WatchStatus.WATCHED}'
        AND s.in_production = 1
      `;

      const [showResult] = await pool.execute<ResultSetHeader>(showQuery);

      // Update season statuses
      const seasonQuery = `
        UPDATE season_watch_status sws
        JOIN seasons s ON sws.season_id = s.id
        JOIN shows sh ON s.show_id = sh.id
        SET sws.status = '${WatchStatus.UP_TO_DATE}'
        WHERE sws.status = '${WatchStatus.WATCHED}'
        AND sh.in_production = 1
      `;

      const [seasonResult] = await pool.execute<ResultSetHeader>(seasonQuery);

      return {
        shows: showResult.affectedRows,
        seasons: seasonResult.affectedRows,
      };
    } catch (error) {
      handleDatabaseError(error, 'migrating WATCHED statuses to UP_TO_DATE');
    }
  }

  /**
   * Checks if a table has the UP_TO_DATE status in its ENUM
   *
   * @param tableName Name of the table to check
   * @param columnName Name of the column to check
   * @returns True if the table has the UP_TO_DATE status
   */
  public static async hasUpToDateStatus(tableName: string, columnName: string = 'status'): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = ?
        AND column_name = ?
        AND column_type LIKE "%'UP_TO_DATE'%"
        AND table_schema = DATABASE()
      `;

      const [result] = await getDbPool().execute<RowDataPacket[]>(query, [tableName, columnName]);
      return result[0]?.count > 0;
    } catch (error) {
      handleDatabaseError(error, `checking if ${tableName}.${columnName} has UP_TO_DATE status`);
    }
  }
}
