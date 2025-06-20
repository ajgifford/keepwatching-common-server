import { NotFoundError } from '../middleware/errorMiddleware';
import {
  StatusChange,
  StatusUpdateResult,
  WatchStatusEpisodeRow,
  WatchStatusExtendedEpisodeRow,
  WatchStatusExtendedSeasonRow,
  WatchStatusSeason,
  WatchStatusSeasonRow,
  WatchStatusShowRow,
  transformWatchStatusEpisode,
  transformWatchStatusExtendedEpisode,
  transformWatchStatusExtendedSeason,
  transformWatchStatusSeason,
  transformWatchStatusShow,
} from '../types/watchStatusTypes';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { WatchStatusManager } from '../utils/watchStatusManager';
import { UserWatchStatus, WatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Database service for managing watch statuses with the centralized status manager
 */
export class WatchStatusDbService {
  private statusManager: WatchStatusManager;
  private transactionHelper: TransactionHelper;

  constructor() {
    this.statusManager = WatchStatusManager.getInstance();
    this.transactionHelper = new TransactionHelper();
  }

  /**
   * Update episode watch status and propagate changes up the hierarchy
   */
  async updateEpisodeWatchStatus(
    profileId: number,
    episodeId: number,
    status: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    try {
      return await this.transactionHelper.executeInTransaction(async (connection) => {
        const changes: StatusChange[] = [];
        let totalAffectedRows = 0;

        // Get episode data with season and show info
        const episodeQuery = `
          SELECT 
            e.id, e.season_id, e.air_date,
            COALESCE(ews.status, 'NOT_WATCHED') as status,
            s.id as season_id, s.show_id, s.air_date as season_air_date,
            COALESCE(sws.status, 'NOT_WATCHED') as season_status,
            sh.id as show_id, sh.air_date as show_air_date, sh.in_production as show_in_production,
            COALESCE(shws.status, 'NOT_WATCHED') as show_status
          FROM episodes e
          JOIN seasons s ON e.season_id = s.id
          JOIN shows sh ON s.show_id = sh.id
          LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
          LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
          LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
          WHERE e.id = ?
        `;

        const [episodeRows] = await connection.execute<WatchStatusExtendedEpisodeRow[]>(episodeQuery, [
          profileId,
          profileId,
          profileId,
          episodeId,
        ]);

        if (episodeRows.length === 0) {
          throw new NotFoundError(`Episode ${episodeId} not found`);
        }

        const watchStatusExtendedEpisode = transformWatchStatusExtendedEpisode(episodeRows[0]);

        // Update episode status in database
        const updateEpisodeQuery = `
          INSERT INTO episode_watch_status (profile_id, episode_id, status) 
          VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP;
        `;

        const [episodeResult] = await connection.execute<ResultSetHeader>(updateEpisodeQuery, [
          profileId,
          episodeId,
          status,
        ]);

        totalAffectedRows += episodeResult.affectedRows;

        // Record episode status change
        if (watchStatusExtendedEpisode.watchStatus !== status) {
          changes.push({
            entityType: 'episode',
            entityId: episodeId,
            from: watchStatusExtendedEpisode.watchStatus,
            to: status,
            timestamp: new Date(),
            reason: `Episode marked as ${status}`,
          });
        }

        // Get all episodes for the season to calculate new season status
        const seasonEpisodesQuery = `
          SELECT 
            e.id, e.air_date, e.season_id,
            CASE 
              WHEN e.id = ? THEN ?
              ELSE COALESCE(ews.status, 'NOT_WATCHED')
            END as status
          FROM episodes e
          LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
          WHERE e.season_id = ?
          ORDER BY e.episode_number
        `;

        const [seasonEpisodes] = await connection.execute<WatchStatusEpisodeRow[]>(seasonEpisodesQuery, [
          episodeId,
          status,
          profileId,
          watchStatusExtendedEpisode.seasonId,
        ]);

        // Calculate new season status
        const season = {
          id: watchStatusExtendedEpisode.seasonId,
          airDate: watchStatusExtendedEpisode.seasonAirDate,
          showId: watchStatusExtendedEpisode.showId,
          watchStatus: watchStatusExtendedEpisode.seasonWatchStatus,
          episodes: seasonEpisodes.map(transformWatchStatusEpisode),
        };

        const newSeasonStatus = this.statusManager.calculateSeasonStatus(season);

        // If a season status hasn't changed then a show status would also not change, return
        if (watchStatusExtendedEpisode.seasonWatchStatus === newSeasonStatus) {
          return { success: true, changes, affectedRows: totalAffectedRows };
        }

        // Update season status if changed
        const updateSeasonQuery = `
            INSERT INTO season_watch_status (profile_id, season_id, status) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              updated_at = CURRENT_TIMESTAMP;
          `;

        const [seasonResult] = await connection.execute<ResultSetHeader>(updateSeasonQuery, [
          profileId,
          watchStatusExtendedEpisode.seasonId,
          newSeasonStatus,
        ]);

        totalAffectedRows += seasonResult.affectedRows;

        changes.push({
          entityType: 'season',
          entityId: watchStatusExtendedEpisode.seasonId,
          from: watchStatusExtendedEpisode.seasonWatchStatus,
          to: newSeasonStatus,
          timestamp: new Date(),
          reason: `Episode ${episodeId} status changed`,
        });

        // Get all seasons for the show to calculate new show status
        const showSeasonsQuery = `
          SELECT 
            s.id, s.release_date, s.show_id,
            CASE 
              WHEN s.id = ? THEN ?
              ELSE COALESCE(sws.status, 'NOT_WATCHED')
            END as status
          FROM seasons s
          LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
          WHERE s.show_id = ?
          ORDER BY s.season_number
        `;

        const [showSeasons] = await connection.execute<WatchStatusSeasonRow[]>(showSeasonsQuery, [
          watchStatusExtendedEpisode.seasonId,
          newSeasonStatus,
          profileId,
          watchStatusExtendedEpisode.showId,
        ]);

        // Calculate new show status
        const show = {
          id: watchStatusExtendedEpisode.showId,
          airDate: watchStatusExtendedEpisode.showAirDate,
          inProduction: watchStatusExtendedEpisode.showInProduction,
          watchStatus: watchStatusExtendedEpisode.showWatchStatus,
          seasons: showSeasons.map((s) => transformWatchStatusSeason(s, [])),
        };

        const newShowStatus = this.statusManager.calculateShowStatus(show);

        // Update show status if changed
        if (watchStatusExtendedEpisode.showWatchStatus !== newShowStatus) {
          const updateShowQuery = `
            INSERT INTO show_watch_status (profile_id, show_id, status) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              updated_at = CURRENT_TIMESTAMP;
          `;

          const [showResult] = await connection.execute<ResultSetHeader>(updateShowQuery, [
            profileId,
            watchStatusExtendedEpisode.showId,
            newShowStatus,
          ]);

          totalAffectedRows += showResult.affectedRows;

          changes.push({
            entityType: 'show',
            entityId: watchStatusExtendedEpisode.showId,
            from: watchStatusExtendedEpisode.showWatchStatus,
            to: newShowStatus,
            timestamp: new Date(),
            reason: `Season ${watchStatusExtendedEpisode.seasonId} status changed`,
          });
        }

        return { success: true, changes, affectedRows: totalAffectedRows };
      });
    } catch (error) {
      handleDatabaseError(error, 'updating episode watch status with propagation');
    }
  }

  /**
   * Update season watch status and propagate to episodes and show
   */
  async updateSeasonWatchStatus(
    profileId: number,
    seasonId: number,
    targetStatus: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    try {
      return await this.transactionHelper.executeInTransaction(async (connection) => {
        const changes: StatusChange[] = [];
        const now = new Date();
        let totalAffectedRows = 0;

        // Get season data
        const seasonQuery = `
          SELECT 
            s.id, s.show_id, s.release_date,
            COALESCE(sws.status, 'NOT_WATCHED') as status,
            sh.in_production as show_in_production, sh.release_date as show_air_date,
            COALESCE(shws.status, 'NOT_WATCHED') as show_status
          FROM seasons s
          JOIN shows sh ON s.show_id = sh.id
          LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
          LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
          WHERE s.id = ?
        `;

        const [seasonRows] = await connection.execute<WatchStatusExtendedSeasonRow[]>(seasonQuery, [
          profileId,
          profileId,
          seasonId,
        ]);

        if (seasonRows.length === 0) {
          throw new NotFoundError(`Season ${seasonId} not found`);
        }

        // Update episodes
        const episodeStatusQuery = `
        SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
        FROM episodes e
        LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
        WHERE e.season_id = ?
        `;

        const [originalEpisodeRows] = await connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
          profileId,
          seasonId,
        ]);

        const episodeUpdateQuery = `
          INSERT INTO episode_watch_status (profile_id, episode_id, status)
          SELECT 
            ?, 
            e.id, 
            CASE 
              WHEN e.air_date IS NULL OR DATE(e.air_date) <= ? THEN ?
              ELSE 'UNAIRED'
            END
          FROM episodes e
          WHERE e.season_id = ?
          ON DUPLICATE KEY UPDATE 
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP
        `;

        const [episodeResult] = await connection.execute<ResultSetHeader>(episodeUpdateQuery, [
          profileId,
          now,
          targetStatus,
          seasonId,
        ]);
        totalAffectedRows += episodeResult.affectedRows;

        const [updatedEpisodeRows] = await connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
          profileId,
          seasonId,
        ]);

        updatedEpisodeRows.forEach((ep) => {
          const originalEpisode = originalEpisodeRows.find((oe) => ep.id === oe.id);
          changes.push({
            entityType: 'episode',
            entityId: ep.id,
            from: originalEpisode?.status || WatchStatus.NOT_WATCHED,
            to: ep.status,
            timestamp: new Date(),
            reason: `Season ${seasonId} marked as ${targetStatus}`,
          });
        });

        const updatedEpisodes = updatedEpisodeRows.map(transformWatchStatusEpisode);
        const watchStatusSeason = transformWatchStatusExtendedSeason(seasonRows[0], updatedEpisodes);
        const newSeasonStatus = this.statusManager.calculateSeasonStatus(watchStatusSeason);

        // Update season status
        const updateSeasonQuery = `
          INSERT INTO season_watch_status (profile_id, season_id, status) 
          VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP;
        `;

        const [seasonResult] = await connection.execute<ResultSetHeader>(updateSeasonQuery, [
          profileId,
          seasonId,
          newSeasonStatus,
        ]);

        totalAffectedRows += seasonResult.affectedRows;

        // Record season status change
        if (watchStatusSeason.watchStatus !== newSeasonStatus) {
          changes.push({
            entityType: 'season',
            entityId: seasonId,
            from: watchStatusSeason.watchStatus,
            to: newSeasonStatus,
            timestamp: new Date(),
            reason: `Season manually set to ${targetStatus}`,
          });
        }

        // Update show status
        const showSeasonsQuery = `
          SELECT 
            s.id, s.release_date, s.show_id,
            CASE 
              WHEN s.id = ? THEN ?
              ELSE COALESCE(sws.status, 'NOT_WATCHED')
            END as status
          FROM seasons s
          LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
          WHERE s.show_id = ?
          ORDER BY s.season_number
        `;

        const [showSeasons] = await connection.execute<WatchStatusSeasonRow[]>(showSeasonsQuery, [
          seasonId,
          targetStatus,
          profileId,
          watchStatusSeason.showId,
        ]);

        const show = {
          id: watchStatusSeason.showId,
          airDate: watchStatusSeason.showAirDate,
          inProduction: watchStatusSeason.showInProduction,
          seasons: showSeasons.map((s) => transformWatchStatusSeason(s, [])),
          watchStatus: watchStatusSeason.showWatchStatus,
        };

        const newShowStatus = this.statusManager.calculateShowStatus(show);

        if (watchStatusSeason.showWatchStatus !== newShowStatus) {
          const updateShowQuery = `
            INSERT INTO show_watch_status (profile_id, show_id, status) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              updated_at = CURRENT_TIMESTAMP;
          `;

          const [showResult] = await connection.execute<ResultSetHeader>(updateShowQuery, [
            profileId,
            watchStatusSeason.showId,
            newShowStatus,
          ]);

          totalAffectedRows += showResult.affectedRows;

          changes.push({
            entityType: 'show',
            entityId: watchStatusSeason.showId,
            from: watchStatusSeason.showWatchStatus,
            to: newShowStatus,
            timestamp: new Date(),
            reason: `Season ${seasonId} status changed`,
          });
        }

        return { success: true, changes, affectedRows: totalAffectedRows };
      });
    } catch (error) {
      handleDatabaseError(error, 'updating season watch status with propagation');
    }
  }

  /**
   * Update show watch status and propagate to all seasons and episodes
   */
  async updateShowWatchStatus(profileId: number, showId: number, status: UserWatchStatus): Promise<StatusUpdateResult> {
    try {
      return await this.transactionHelper.executeInTransaction(async (connection) => {
        const changes: StatusChange[] = [];
        let totalAffectedRows = 0;
        const now = new Date();

        // Get current show status
        const showQuery = `
          SELECT 
            sh.id, sh.release_date, sh.in_production,
            COALESCE(shws.status, 'NOT_WATCHED') as status
          FROM shows sh
          LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
          WHERE sh.id = ?
        `;

        const [showRows] = await connection.execute<WatchStatusShowRow[]>(showQuery, [profileId, showId]);

        if (showRows.length === 0) {
          throw new NotFoundError(`Show ${showId} not found`);
        }

        //Update all episodes of the show
        const episodeInsertQuery = `
          INSERT INTO episode_watch_status (profile_id, episode_id, status)
          SELECT 
            ?,
            e.id,
            CASE
              WHEN e.air_date IS NULL OR DATE(e.air_date) <= ? THEN ?
              ELSE 'UNAIRED'
            END 
          FROM episodes e
          WHERE e.show_id = ?
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP;
          `;

        const [episodesResult] = await connection.execute<ResultSetHeader>(episodeInsertQuery, [
          profileId,
          now,
          status,
          showId,
        ]);

        totalAffectedRows += episodesResult.affectedRows;

        const episodeStatusQuery = `
          SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
          FROM episodes e
          LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
          WHERE e.season_id = ?
          `;

        const seasonStatusQuery = `
            SELECT s.id, s.release_date, s.show_id, COALESCE(sws.status, 'NOT_WATCHED') as status
            FROM seasons s
            LEFT JOIN season_watch_status sws on s.id = sws.season_id AND sws.profile_id = ?
            where s.show_id = ?
          `;
        const [seasonRows] = await connection.execute<WatchStatusSeasonRow[]>(seasonStatusQuery, []);
        const showSeasons: WatchStatusSeason[] = [];
        for (const seasonRow of seasonRows) {
          const [episodeRows] = await connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
            profileId,
            seasonRow.id,
          ]);

          const episodes = episodeRows.map(transformWatchStatusEpisode);
          const season = transformWatchStatusSeason(seasonRow, episodes);
          showSeasons.push(season);
          const newSeasonStatus = this.statusManager.calculateSeasonStatus(season);

          if (season.watchStatus === newSeasonStatus) {
            continue;
          }

          const updateSeasonQuery = `
            INSERT INTO season_watch_status (profile_id, season_id, status) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              updated_at = CURRENT_TIMESTAMP;
          `;

          const [seasonResult] = await connection.execute<ResultSetHeader>(updateSeasonQuery, [
            profileId,
            seasonRow.id,
            newSeasonStatus,
          ]);

          totalAffectedRows += seasonResult.affectedRows;

          changes.push({
            entityType: 'season',
            entityId: showId,
            from: season.watchStatus,
            to: newSeasonStatus,
            timestamp: new Date(),
            reason: `Show manually set to ${status}`,
          });
        }

        const watchStatusShow = transformWatchStatusShow(showRows[0], showSeasons);
        const newShowStatus = this.statusManager.calculateShowStatus(watchStatusShow);

        // Update show status
        if (watchStatusShow.watchStatus !== newShowStatus) {
          const updateShowQuery = `
          INSERT INTO show_watch_status (profile_id, show_id, status) 
          VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP;
        `;

          const [showResult] = await connection.execute<ResultSetHeader>(updateShowQuery, [
            profileId,
            showId,
            newShowStatus,
          ]);

          totalAffectedRows += showResult.affectedRows;

          // Record show status change
          changes.push({
            entityType: 'show',
            entityId: showId,
            from: watchStatusShow.watchStatus,
            to: newShowStatus,
            timestamp: new Date(),
            reason: `Show manually set to ${status}`,
          });
        }

        return { success: true, changes, affectedRows: totalAffectedRows };
      });
    } catch (error) {
      handleDatabaseError(error, 'updating show watch status with propagation');
    }
  }
}
