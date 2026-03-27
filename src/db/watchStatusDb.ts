import { logEpisodeWatched, logEpisodesWatched, logSeasonWatched, logShowWatched } from './watchHistoryDb';
import { NotFoundError } from '../middleware/errorMiddleware';
import { QueryExecutionMetadata } from '../types/statsStore';
import {
  StatusChange,
  StatusUpdateResult,
  WatchStatusEpisodeRow,
  WatchStatusExtendedEpisode,
  WatchStatusExtendedEpisodeRow,
  WatchStatusExtendedSeasonRow,
  WatchStatusSeason,
  WatchStatusSeasonRow,
  WatchStatusShow,
  WatchStatusShowRow,
  transformWatchStatusEpisode,
  transformWatchStatusExtendedEpisode,
  transformWatchStatusExtendedSeason,
  transformWatchStatusSeason,
  transformWatchStatusShow,
} from '../types/watchStatusTypes';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { WatchStatusManager } from '../utils/watchStatusManager';
import { UserWatchStatus, WatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { getDbPool } from '../utils/db';

export interface BulkMarkedShowRow extends RowDataPacket {
  showId: number;
  title: string;
  posterImage: string;
  markDate: string;
  episodeCount: number;
}

type EntityType = 'episode' | 'season' | 'show';

interface StatusUpdateContext {
  changes: StatusChange[];
  totalAffectedRows: number;
  connection: PoolConnection;
  profileId: number;
  timestamp: Date;
}

interface EntityUpdateParams {
  table: string;
  entityColumn: string;
  entityId: number;
  status: WatchStatus;
}

/**
 * Database service for managing watch statuses with the centralized status manager
 */
export class WatchStatusDbService {
  private statusManager: WatchStatusManager;
  private transactionHelper: TransactionHelper;

  constructor(
    statusManager: WatchStatusManager = WatchStatusManager.getInstance(),
    transactionHelper: TransactionHelper = new TransactionHelper(),
  ) {
    this.statusManager = statusManager;
    this.transactionHelper = transactionHelper;
  }

  /**
   * Generic method to execute status update operations within a transaction
   */
  private async executeStatusUpdate<T>(
    operationName: string,
    operation: (context: StatusUpdateContext) => Promise<T>,
    metadata?: QueryExecutionMetadata,
  ): Promise<T> {
    try {
      return await DbMonitor.getInstance().executeWithTiming(
        operationName,
        async () => {
          return await this.transactionHelper.executeInTransaction(async (connection) => {
            const context: StatusUpdateContext = {
              changes: [],
              totalAffectedRows: 0,
              connection,
              profileId: 0, // Will be set by the operation
              timestamp: new Date(),
            };

            return await operation(context);
          });
        },
        1000,
        metadata,
      );
    } catch (error) {
      handleDatabaseError(error, operationName);
    }
  }

  /**
   * Generic method to update entity status using INSERT...ON DUPLICATE KEY UPDATE pattern
   */
  private async updateEntityStatus(context: StatusUpdateContext, params: EntityUpdateParams): Promise<void> {
    const query = `
      INSERT INTO ${params.table} (profile_id, ${params.entityColumn}, status) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP;
    `;

    const [result] = await context.connection.execute<ResultSetHeader>(query, [
      context.profileId,
      params.entityId,
      params.status,
    ]);

    context.totalAffectedRows += result.affectedRows;
  }

  /**
   * Generic method to record status changes
   */
  private recordStatusChange(
    context: StatusUpdateContext,
    entityType: EntityType,
    entityId: number,
    fromStatus: WatchStatus,
    toStatus: WatchStatus,
    reason: string,
  ): void {
    if (fromStatus !== toStatus) {
      context.changes.push({
        entityType,
        entityId,
        from: fromStatus,
        to: toStatus,
        timestamp: context.timestamp,
        reason,
      });
    }
  }

  /**
   * Common method to create successful status update result
   */
  private createSuccessResult(context: StatusUpdateContext): StatusUpdateResult {
    return {
      success: true,
      changes: context.changes,
      affectedRows: context.totalAffectedRows,
    };
  }

  /**
   * Update episode watch status and propagate changes up the hierarchy
   */
  async updateEpisodeWatchStatus(
    profileId: number,
    episodeId: number,
    status: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'updating episode watch status with propagation',
      async (context) => {
        context.profileId = profileId;

        // Get episode data with season and show info
        const episodeQuery = `
        SELECT 
          e.id, e.season_id, e.air_date,
          COALESCE(ews.status, 'NOT_WATCHED') as status,
          s.id as season_id, s.show_id, s.release_date as season_air_date,
          COALESCE(sws.status, 'NOT_WATCHED') as season_status,
          sh.id as show_id, sh.release_date as show_air_date, sh.in_production as show_in_production,
          COALESCE(shws.status, 'NOT_WATCHED') as show_status
        FROM episodes e
        JOIN seasons s ON e.season_id = s.id
        JOIN shows sh ON s.show_id = sh.id
        LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
        LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
        LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
        WHERE e.id = ?
      `;

        const [episodeRows] = await context.connection.execute<WatchStatusExtendedEpisodeRow[]>(episodeQuery, [
          profileId,
          profileId,
          profileId,
          episodeId,
        ]);

        if (episodeRows.length === 0) {
          throw new NotFoundError(`Episode ${episodeId} not found`);
        }

        const watchStatusExtendedEpisode = transformWatchStatusExtendedEpisode(episodeRows[0]);

        // Update episode status, setting watched_at to now when marking watched,
        // clearing it when unmarking, and preserving existing dates (e.g. prior-watch).
        const episodeStatusQuery = `
          INSERT INTO episode_watch_status (profile_id, episode_id, status, watched_at)
          VALUES (?, ?, ?, IF(? = 'WATCHED', CURRENT_TIMESTAMP, NULL))
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            watched_at = IF(VALUES(status) = 'WATCHED', COALESCE(watched_at, CURRENT_TIMESTAMP), NULL),
            updated_at = CURRENT_TIMESTAMP
        `;
        const [epResult] = await context.connection.execute<ResultSetHeader>(episodeStatusQuery, [
          profileId,
          episodeId,
          status,
          status,
        ]);
        context.totalAffectedRows += epResult.affectedRows;

        this.recordStatusChange(
          context,
          'episode',
          episodeId,
          watchStatusExtendedEpisode.watchStatus,
          status,
          `Episode manually set to ${status}`,
        );

        // Log to watch history when marking as watched
        if (status === 'WATCHED') {
          await logEpisodeWatched(context.connection, profileId, episodeId);
        }

        // Propagate to season and show
        await this.updateSeasonEpisodes(context, watchStatusExtendedEpisode);
        await this.propagateStatusToParents(context, watchStatusExtendedEpisode);
        return this.createSuccessResult(context);
      },
      { content: { id: episodeId, type: 'episode' } },
    );
  }

  /**
   * Helper method to ensure all episodes of a given season that have aired are marked correctly
   */
  private async updateSeasonEpisodes(context: StatusUpdateContext, episode: WatchStatusExtendedEpisode) {
    // Update all episodes in the season
    const episodeUpdateQuery = `
        INSERT INTO episode_watch_status (profile_id, episode_id, status)
        SELECT ?, e.id, 'NOT_WATCHED'
        FROM episodes e
        LEFT JOIN episode_watch_status ews
          ON e.id = ews.episode_id AND ews.profile_id = ?
        WHERE e.season_id = ?
          AND DATE(e.air_date) <= ?
          AND (ews.status = 'UNAIRED' OR ews.episode_id IS NULL)
        ON DUPLICATE KEY UPDATE
          status = 'NOT_WATCHED',
          updated_at = CURRENT_TIMESTAMP;
      `;

    const [episodesResult] = await context.connection.execute<ResultSetHeader>(episodeUpdateQuery, [
      context.profileId,
      context.profileId,
      episode.seasonId,
      context.timestamp,
    ]);
    context.totalAffectedRows += episodesResult.affectedRows;
  }

  /**
   * Helper method to propagate status changes to parent entities (season and show)
   */
  private async propagateStatusToParents(
    context: StatusUpdateContext,
    episode: WatchStatusExtendedEpisode,
  ): Promise<void> {
    // Get all episodes in the season to calculate new season status
    const seasonEpisodesQuery = `
      SELECT e.id, e.air_date, COALESCE(ews.status, 'NOT_WATCHED') as status
      FROM episodes e
      LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
      WHERE e.season_id = ?
    `;

    const [seasonEpisodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(seasonEpisodesQuery, [
      context.profileId,
      episode.seasonId,
    ]);

    const seasonEpisodes = seasonEpisodeRows.map(transformWatchStatusEpisode);
    const seasonWithEpisodes = {
      id: episode.seasonId,
      airDate: episode.seasonAirDate,
      showId: episode.showId,
      episodes: seasonEpisodes,
      watchStatus: episode.seasonWatchStatus,
    };

    const newSeasonStatus = this.statusManager.calculateSeasonStatus(seasonWithEpisodes);

    // Update season status if changed
    if (episode.seasonWatchStatus !== newSeasonStatus) {
      await this.updateEntityStatus(context, {
        table: 'season_watch_status',
        entityColumn: 'season_id',
        entityId: episode.seasonId,
        status: newSeasonStatus,
      });

      this.recordStatusChange(
        context,
        'season',
        episode.seasonId,
        episode.seasonWatchStatus,
        newSeasonStatus,
        `Episode ${episode.id} status changed`,
      );
    }

    // Get all seasons in the show to calculate new show status
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

    const [showSeasonRows] = await context.connection.execute<WatchStatusSeasonRow[]>(showSeasonsQuery, [
      episode.seasonId,
      newSeasonStatus,
      context.profileId,
      episode.showId,
    ]);

    const showSeasons = showSeasonRows.map((s) => transformWatchStatusSeason(s, []));
    const showWithSeasons = {
      id: episode.showId,
      airDate: episode.showAirDate,
      inProduction: episode.showInProduction,
      seasons: showSeasons,
      watchStatus: episode.showWatchStatus,
    };

    const newShowStatus = this.statusManager.calculateShowStatus(showWithSeasons);

    // Update show status if changed
    if (episode.showWatchStatus !== newShowStatus) {
      await this.updateEntityStatus(context, {
        table: 'show_watch_status',
        entityColumn: 'show_id',
        entityId: episode.showId,
        status: newShowStatus,
      });

      this.recordStatusChange(
        context,
        'show',
        episode.showId,
        episode.showWatchStatus,
        newShowStatus,
        `Season ${episode.seasonId} status changed`,
      );
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
    return this.executeStatusUpdate(
      'updating season watch status with propagation',
      async (context) => {
        context.profileId = profileId;

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

        const [seasonRows] = await context.connection.execute<WatchStatusExtendedSeasonRow[]>(seasonQuery, [
          profileId,
          profileId,
          seasonId,
        ]);

        if (seasonRows.length === 0) {
          throw new NotFoundError(`Season ${seasonId} not found`);
        }

        await this.updateSeasonAndEpisodes(context, seasonRows[0], seasonId, targetStatus);
        await this.updateParentShowStatus(context, seasonRows[0], seasonId, targetStatus);
        return this.createSuccessResult(context);
      },
      { content: { id: seasonId, type: 'season' } },
    );
  }

  /**
   * Helper method to update season and its episodes
   */
  private async updateSeasonAndEpisodes(
    context: StatusUpdateContext,
    seasonRow: WatchStatusExtendedSeasonRow,
    seasonId: number,
    targetStatus: UserWatchStatus,
  ): Promise<void> {
    // Get original episode statuses
    const episodeStatusQuery = `
      SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
      FROM episodes e
      LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
      WHERE e.season_id = ?
    `;

    const [originalEpisodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
      context.profileId,
      seasonId,
    ]);

    // Update all episodes in the season
    const episodeUpdateQuery = `
      INSERT INTO episode_watch_status (profile_id, episode_id, status, watched_at)
      SELECT
        ?,
        e.id,
        CASE
          WHEN e.air_date IS NULL OR DATE(e.air_date) <= ? THEN ?
          ELSE 'UNAIRED'
        END,
        IF(e.air_date IS NULL OR DATE(e.air_date) <= ? AND ? = 'WATCHED', CURRENT_TIMESTAMP, NULL)
      FROM episodes e
      WHERE e.season_id = ?
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        watched_at = IF(VALUES(status) = 'WATCHED', COALESCE(watched_at, CURRENT_TIMESTAMP), NULL),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [episodeResult] = await context.connection.execute<ResultSetHeader>(episodeUpdateQuery, [
      context.profileId,
      context.timestamp,
      targetStatus,
      context.timestamp,
      targetStatus,
      seasonId,
    ]);
    context.totalAffectedRows += episodeResult.affectedRows;

    // Get updated episode statuses and record changes
    const [updatedEpisodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
      context.profileId,
      seasonId,
    ]);

    updatedEpisodeRows.forEach((ep) => {
      const originalEpisode = originalEpisodeRows.find((oe) => ep.id === oe.id);
      this.recordStatusChange(
        context,
        'episode',
        ep.id,
        originalEpisode?.status || WatchStatus.NOT_WATCHED,
        ep.status,
        `Season ${seasonId} marked as ${targetStatus}`,
      );
    });

    // Log newly-WATCHED episodes to history (diff pre/post snapshots)
    const newlyWatchedIds = updatedEpisodeRows
      .filter((ep) => {
        const original = originalEpisodeRows.find((oe) => oe.id === ep.id);
        return ep.status === 'WATCHED' && original?.status !== 'WATCHED';
      })
      .map((ep) => ep.id);
    if (newlyWatchedIds.length > 0) {
      await logEpisodesWatched(context.connection, context.profileId, newlyWatchedIds);
    }

    // Calculate and update season status
    const updatedEpisodes = updatedEpisodeRows.map(transformWatchStatusEpisode);
    const watchStatusSeason = transformWatchStatusExtendedSeason(seasonRow, updatedEpisodes);
    const newSeasonStatus = this.statusManager.calculateSeasonStatus(watchStatusSeason);

    await this.updateEntityStatus(context, {
      table: 'season_watch_status',
      entityColumn: 'season_id',
      entityId: seasonId,
      status: newSeasonStatus,
    });

    this.recordStatusChange(
      context,
      'season',
      seasonId,
      watchStatusSeason.watchStatus,
      newSeasonStatus,
      `Season manually set to ${targetStatus}`,
    );

    // Log season completion to history
    if (newSeasonStatus === 'WATCHED' && watchStatusSeason.watchStatus !== 'WATCHED') {
      await logSeasonWatched(context.connection, context.profileId, seasonId);
    }
  }

  /**
   * Helper method to update parent show status after season changes
   */
  private async updateParentShowStatus(
    context: StatusUpdateContext,
    seasonRow: WatchStatusExtendedSeasonRow,
    seasonId: number,
    targetStatus: UserWatchStatus,
  ): Promise<void> {
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

    const [showSeasons] = await context.connection.execute<WatchStatusSeasonRow[]>(showSeasonsQuery, [
      seasonId,
      targetStatus,
      context.profileId,
      seasonRow.show_id,
    ]);

    const show = {
      id: seasonRow.show_id,
      airDate: new Date(seasonRow.show_air_date),
      inProduction: seasonRow.show_in_production === 1,
      seasons: showSeasons.map((s) => transformWatchStatusSeason(s, [])),
      watchStatus: seasonRow.show_status,
    };

    const newShowStatus = this.statusManager.calculateShowStatus(show);

    if (seasonRow.show_status !== newShowStatus) {
      await this.updateEntityStatus(context, {
        table: 'show_watch_status',
        entityColumn: 'show_id',
        entityId: seasonRow.show_id,
        status: newShowStatus,
      });

      this.recordStatusChange(
        context,
        'show',
        seasonRow.show_id,
        seasonRow.show_status,
        newShowStatus,
        `Season ${seasonId} status changed`,
      );
    }
  }

  /**
   * Update show watch status and propagate to all seasons and episodes
   */
  async updateShowWatchStatus(profileId: number, showId: number, status: UserWatchStatus): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'updating show watch status with propagation',
      async (context) => {
        context.profileId = profileId;

        // Get current show status
        const showQuery = `
        SELECT 
          sh.id, sh.release_date, sh.in_production,
          COALESCE(shws.status, 'NOT_WATCHED') as status
        FROM shows sh
        LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
        WHERE sh.id = ?
      `;

        const [showRows] = await context.connection.execute<WatchStatusShowRow[]>(showQuery, [profileId, showId]);

        if (showRows.length === 0) {
          throw new NotFoundError(`Show ${showId} not found`);
        }

        await this.updateShowAndAllChildren(context, showRows[0], showId, status);
        return this.createSuccessResult(context);
      },
      { content: { id: showId, type: 'show' } },
    );
  }

  /**
   * Helper method to update show and all its children (seasons and episodes)
   */
  private async updateShowAndAllChildren(
    context: StatusUpdateContext,
    showRow: WatchStatusShowRow,
    showId: number,
    status: UserWatchStatus,
  ): Promise<void> {
    // Snapshot which episodes are already WATCHED before the bulk update
    const [preUpdateRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(
      `SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
       FROM episodes e
       JOIN seasons s ON e.season_id = s.id
       LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
       WHERE s.show_id = ?`,
      [context.profileId, showId],
    );
    const preWatchedIds = new Set(preUpdateRows.filter((r) => r.status === 'WATCHED').map((r) => r.id));

    // Update all episodes in the show
    const episodeUpdateQuery = `
      INSERT INTO episode_watch_status (profile_id, episode_id, status, watched_at)
      SELECT
        ?,
        e.id,
        CASE
          WHEN e.air_date IS NULL OR DATE(e.air_date) <= ? THEN ?
          ELSE 'UNAIRED'
        END,
        IF(e.air_date IS NULL OR DATE(e.air_date) <= ? AND ? = 'WATCHED', CURRENT_TIMESTAMP, NULL)
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE s.show_id = ?
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        watched_at = IF(VALUES(status) = 'WATCHED', COALESCE(watched_at, CURRENT_TIMESTAMP), NULL),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [episodeResult] = await context.connection.execute<ResultSetHeader>(episodeUpdateQuery, [
      context.profileId,
      context.timestamp,
      status,
      context.timestamp,
      status,
      showId,
    ]);
    context.totalAffectedRows += episodeResult.affectedRows;

    // Get all seasons and calculate their individual statuses
    const seasonsQuery = `
      SELECT s.id, s.release_date, s.show_id, COALESCE(sws.status, 'NOT_WATCHED') as status
      FROM seasons s
      LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
      WHERE s.show_id = ?
      ORDER BY s.season_number
    `;

    const [seasonRows] = await context.connection.execute<WatchStatusSeasonRow[]>(seasonsQuery, [
      context.profileId,
      showId,
    ]);

    const episodeStatusQuery = `
      SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
      FROM episodes e
      LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
      WHERE e.season_id = ?
    `;

    // Update each season individually based on its episodes
    for (const seasonRow of seasonRows) {
      // Get all episodes for this season with their updated statuses
      const [episodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
        context.profileId,
        seasonRow.id,
      ]);

      const episodes = episodeRows.map(transformWatchStatusEpisode);
      const season = transformWatchStatusSeason(seasonRow, episodes);
      const calculatedSeasonStatus = this.statusManager.calculateSeasonStatus(season);

      if (season.watchStatus !== calculatedSeasonStatus) {
        // Update the season status
        await this.updateEntityStatus(context, {
          table: 'season_watch_status',
          entityColumn: 'season_id',
          entityId: seasonRow.id,
          status: calculatedSeasonStatus,
        });

        this.recordStatusChange(
          context,
          'season',
          seasonRow.id,
          seasonRow.status,
          calculatedSeasonStatus,
          `Show manually set to ${status}`,
        );
      }
    }

    // Re-query to get the actual current season statuses after updates
    const [updatedSeasonRows] = await context.connection.execute<WatchStatusSeasonRow[]>(seasonsQuery, [
      context.profileId,
      showId,
    ]);

    const seasonsWithCurrentStatus = updatedSeasonRows.map((row) => transformWatchStatusSeason(row, []));

    const showWithUpdatedSeasons: WatchStatusShow = {
      id: showId,
      airDate: new Date(showRow.release_date),
      inProduction: showRow.in_production === 1,
      seasons: seasonsWithCurrentStatus,
      watchStatus: showRow.status,
    };

    const calculatedShowStatus = this.statusManager.calculateShowStatus(showWithUpdatedSeasons);

    // Log newly-WATCHED episodes to history (diff pre-snapshot vs current state)
    const [postUpdateEpisodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(
      `SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
       FROM episodes e
       JOIN seasons s ON e.season_id = s.id
       LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
       WHERE s.show_id = ?`,
      [context.profileId, showId],
    );
    const newlyWatchedIds = postUpdateEpisodeRows
      .filter((ep) => ep.status === 'WATCHED' && !preWatchedIds.has(ep.id))
      .map((ep) => ep.id);
    if (newlyWatchedIds.length > 0) {
      await logEpisodesWatched(context.connection, context.profileId, newlyWatchedIds);
    }

    // Log season completions to history
    for (const updatedSeason of updatedSeasonRows) {
      const originalSeason = seasonRows.find((s) => s.id === updatedSeason.id);
      if (updatedSeason.status === 'WATCHED' && originalSeason?.status !== 'WATCHED') {
        await logSeasonWatched(context.connection, context.profileId, updatedSeason.id);
      }
    }

    // Only update the show status if it has changed
    if (showRow.status !== calculatedShowStatus) {
      await this.updateEntityStatus(context, {
        table: 'show_watch_status',
        entityColumn: 'show_id',
        entityId: showId,
        status: calculatedShowStatus,
      });

      this.recordStatusChange(
        context,
        'show',
        showId,
        showRow.status,
        calculatedShowStatus,
        `Show manually set to ${status}`,
      );

      // Log show completion to history
      if (calculatedShowStatus === 'WATCHED' || calculatedShowStatus === 'UP_TO_DATE') {
        await logShowWatched(context.connection, context.profileId, showId);
      }
    }
  }

  /**
   * Check for content updates and update movie watch status if necessary
   * Transitions UNAIRED movies to NOT_WATCHED once their release date has passed
   */
  async checkAndUpdateMovieWatchStatus(profileId: number, movieId: number): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'checking and updating movie watch status',
      async (context) => {
        context.profileId = profileId;

        // Update any previously UNAIRED movies to NOT_WATCHED if they've been released
        const movieUpdateQuery = `
        INSERT INTO movie_watch_status (profile_id, movie_id, status)
        SELECT ?, m.id, 'NOT_WATCHED'
        FROM movies m
        LEFT JOIN movie_watch_status mws
          ON m.id = mws.movie_id AND mws.profile_id = ?
        WHERE m.id = ?
          AND DATE(m.release_date) <= ?
          AND (mws.status = 'UNAIRED' OR mws.movie_id IS NULL)
        ON DUPLICATE KEY UPDATE
          status = 'NOT_WATCHED',
          updated_at = CURRENT_TIMESTAMP;
      `;

        const [result] = await context.connection.execute<ResultSetHeader>(movieUpdateQuery, [
          profileId,
          profileId,
          movieId,
          context.timestamp,
        ]);

        context.totalAffectedRows += result.affectedRows;

        // Record change if status was updated
        if (result.affectedRows > 0) {
          this.recordStatusChange(
            context,
            'episode', // Using 'episode' as entity type since there's no 'movie' type defined
            movieId,
            WatchStatus.UNAIRED,
            WatchStatus.NOT_WATCHED,
            'Movie release date passed',
          );
        }

        return this.createSuccessResult(context);
      },
      { content: { id: movieId, type: 'movie' } },
    );
  }

  /**
   * Check for content updates and update show, season and episode watch statuses as necessary
   */
  async checkAndUpdateShowWatchStatus(profileId: number, showId: number): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'checking and updating show watch status',
      async (context) => {
        context.profileId = profileId;

        // Get current show status
        const showQuery = `
        SELECT 
          sh.id, sh.release_date, sh.in_production,
          COALESCE(shws.status, 'NOT_WATCHED') as status
        FROM shows sh
        LEFT JOIN show_watch_status shws ON sh.id = shws.show_id AND shws.profile_id = ?
        WHERE sh.id = ?
      `;

        const [showRows] = await context.connection.execute<WatchStatusShowRow[]>(showQuery, [profileId, showId]);

        if (showRows.length === 0) {
          throw new NotFoundError(`Show ${showId} not found`);
        }

        // Update any previously UNAIRED episodes to NOT_WATCHED if they've aired
        const episodeUpdateQuery = `
        INSERT INTO episode_watch_status (profile_id, episode_id, status)
        SELECT ?, e.id, 'NOT_WATCHED'
        FROM episodes e
        LEFT JOIN episode_watch_status ews
          ON e.id = ews.episode_id AND ews.profile_id = ?
        WHERE e.show_id = ?
          AND DATE(e.air_date) <= ?
          AND (ews.status = 'UNAIRED' OR ews.episode_id IS NULL)
        ON DUPLICATE KEY UPDATE
          status = 'NOT_WATCHED',
          updated_at = CURRENT_TIMESTAMP;
      `;

        const [episodesResult] = await context.connection.execute<ResultSetHeader>(episodeUpdateQuery, [
          profileId,
          profileId,
          showId,
          context.timestamp,
        ]);

        context.totalAffectedRows += episodesResult.affectedRows;

        // Get all seasons for the show and recalculate their statuses
        const seasonStatusQuery = `
        SELECT s.id, s.release_date, s.show_id, COALESCE(sws.status, 'NOT_WATCHED') as status
        FROM seasons s
        LEFT JOIN season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
        WHERE s.show_id = ?
      `;

        const [seasonRows] = await context.connection.execute<WatchStatusSeasonRow[]>(seasonStatusQuery, [
          profileId,
          showId,
        ]);

        const episodeStatusQuery = `
        SELECT e.id, e.air_date, e.season_id, COALESCE(ews.status, 'NOT_WATCHED') as status
        FROM episodes e
        LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
        WHERE e.season_id = ?
      `;

        const showSeasons: WatchStatusSeason[] = [];

        // Process each season to check if its status needs updating
        for (const seasonRow of seasonRows) {
          const [episodeRows] = await context.connection.execute<WatchStatusEpisodeRow[]>(episodeStatusQuery, [
            profileId,
            seasonRow.id,
          ]);

          const episodes = episodeRows.map(transformWatchStatusEpisode);
          const season = transformWatchStatusSeason(seasonRow, episodes);
          showSeasons.push(season);

          const newSeasonStatus = this.statusManager.calculateSeasonStatus(season);

          // Update season status if it has changed
          if (season.watchStatus !== newSeasonStatus) {
            await this.updateEntityStatus(context, {
              table: 'season_watch_status',
              entityColumn: 'season_id',
              entityId: seasonRow.id,
              status: newSeasonStatus,
            });

            this.recordStatusChange(
              context,
              'season',
              seasonRow.id,
              season.watchStatus,
              newSeasonStatus,
              'Content updates detected',
            );
          }
        }

        // Calculate and update show status if needed
        const watchStatusShow = transformWatchStatusShow(showRows[0], showSeasons);
        const newShowStatus = this.statusManager.calculateShowStatus(watchStatusShow);

        if (watchStatusShow.watchStatus !== newShowStatus) {
          await this.updateEntityStatus(context, {
            table: 'show_watch_status',
            entityColumn: 'show_id',
            entityId: showId,
            status: newShowStatus,
          });

          this.recordStatusChange(
            context,
            'show',
            showId,
            watchStatusShow.watchStatus,
            newShowStatus,
            'Content updates detected',
          );
        }

        return this.createSuccessResult(context);
      },
      { content: { id: showId, type: 'show' } },
    );
  }

  /**
   * Mark a set of episodes as prior-watched using each episode's air date as watched_at.
   * Sets is_prior_watch = TRUE and watched_at = episode air date for all provided episodes.
   * Season and show status cascade is NOT performed here — callers must trigger that separately.
   *
   * @param profileId - ID of the profile
   * @param episodeAirDateMap - Map of episode ID → air date string (YYYY-MM-DD)
   */
  async markEpisodesAsPriorWatched(
    profileId: number,
    episodeAirDateMap: Map<number, string>,
  ): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'marking episodes as prior watched',
      async (context) => {
        context.profileId = profileId;

        for (const [episodeId, airDate] of episodeAirDateMap) {
          const query = `
            INSERT INTO episode_watch_status (profile_id, episode_id, status, watched_at, is_prior_watch)
            VALUES (?, ?, 'WATCHED', ?, TRUE)
            ON DUPLICATE KEY UPDATE
              status = 'WATCHED',
              watched_at = VALUES(watched_at),
              is_prior_watch = TRUE,
              updated_at = CURRENT_TIMESTAMP
          `;
          const [result] = await context.connection.execute<ResultSetHeader>(query, [
            profileId,
            episodeId,
            airDate,
          ]);
          context.totalAffectedRows += result.affectedRows;

          // Log to history with the air date as the watch timestamp
          await logEpisodeWatched(context.connection, profileId, episodeId, true, airDate);
        }

        return this.createSuccessResult(context);
      },
      { content: { id: profileId, type: 'episode' } },
    );
  }

  /**
   * Find shows where the profile has 10 or more episodes marked watched on the same date,
   * none of which are flagged as prior watches. These are candidates for retroactive flagging.
   *
   * @param profileId - ID of the profile to check
   * @returns Array of rows with show info and bulk-mark details
   */
  async detectBulkMarkedShows(profileId: number): Promise<BulkMarkedShowRow[]> {
    return await DbMonitor.getInstance().executeWithTiming('detectBulkMarkedShows', async () => {
      const [rows] = await getDbPool().execute<BulkMarkedShowRow[]>(
        `
        SELECT showId, title, posterImage, markDate, episodeCount
        FROM (
          SELECT
            sh.id AS showId,
            sh.title,
            sh.poster_image AS posterImage,
            DATE(ews.updated_at) AS markDate,
            COUNT(*) AS episodeCount,
            ROW_NUMBER() OVER (PARTITION BY sh.id ORDER BY COUNT(*) DESC, DATE(ews.updated_at) DESC) AS rn
          FROM episode_watch_status ews
          JOIN episodes e ON e.id = ews.episode_id
          JOIN seasons se ON se.id = e.season_id
          JOIN shows sh ON sh.id = se.show_id
          WHERE ews.profile_id = ?
            AND ews.status = 'WATCHED'
            AND ews.is_prior_watch = FALSE
          GROUP BY sh.id, sh.title, sh.poster_image, DATE(ews.updated_at)
          HAVING COUNT(*) >= 10
        ) ranked
        WHERE rn = 1
        ORDER BY episodeCount DESC
        `,
        [profileId],
      );
      return rows;
    });
  }

  /**
   * Retroactively mark all watched episodes for a given show (optionally limited to specific
   * seasons) as prior-watched, using each episode's air date as watched_at.
   *
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param seasonIds - Optional list of season IDs to limit the operation
   */
  async retroactivelyMarkShowAsPrior(
    profileId: number,
    showId: number,
    seasonIds?: number[],
  ): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'retroactively marking show as prior watched',
      async (context) => {
        context.profileId = profileId;

        const seasonFilter = seasonIds && seasonIds.length > 0
          ? `AND se.id IN (${seasonIds.map(() => '?').join(',')})`
          : '';

        const params: (number | string)[] = [profileId, showId];
        if (seasonIds && seasonIds.length > 0) {
          params.push(...seasonIds);
        }

        const query = `
          UPDATE episode_watch_status ews
          JOIN episodes e ON e.id = ews.episode_id
          JOIN seasons se ON se.id = e.season_id
          SET
            ews.is_prior_watch = TRUE,
            ews.watched_at = CASE
              WHEN e.air_date IS NOT NULL THEN e.air_date
              ELSE ews.watched_at
            END,
            ews.updated_at = CURRENT_TIMESTAMP
          WHERE ews.profile_id = ?
            AND se.show_id = ?
            AND ews.status = 'WATCHED'
            AND ews.is_prior_watch = FALSE
            AND (e.air_date IS NULL OR e.air_date < DATE(ews.created_at))
            ${seasonFilter}
        `;

        const [result] = await context.connection.execute<ResultSetHeader>(query, params);
        context.totalAffectedRows += result.affectedRows;

        return this.createSuccessResult(context);
      },
      { content: { id: showId, type: 'show' } },
    );
  }

  /**
   * Dismiss a bulk-marked show from the watch history review by marking all watched episodes
   * as prior-watched, using each episode's existing updated_at as the watched_at date.
   * This removes the show from detectBulkMarkedShows without changing the watch dates.
   *
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   */
  async dismissBulkMarkedShow(profileId: number, showId: number): Promise<StatusUpdateResult> {
    return this.executeStatusUpdate(
      'dismissing bulk marked show from review',
      async (context) => {
        context.profileId = profileId;

        const query = `
          UPDATE episode_watch_status ews
          JOIN episodes e ON e.id = ews.episode_id
          JOIN seasons se ON se.id = e.season_id
          SET
            ews.is_prior_watch = TRUE,
            ews.watched_at = ews.updated_at
          WHERE ews.profile_id = ?
            AND se.show_id = ?
            AND ews.status = 'WATCHED'
            AND ews.is_prior_watch = FALSE
        `;

        const [result] = await context.connection.execute<ResultSetHeader>(query, [profileId, showId]);
        context.totalAffectedRows += result.affectedRows;

        return this.createSuccessResult(context);
      },
      { content: { id: showId, type: 'show' } },
    );
  }

  /**
   * Fetch a map of episode ID → air date for all aired episodes in a show,
   * optionally limited to seasons with seasonNumber <= upToSeasonNumber.
   * Only episodes where air_date is in the past (already aired) are included.
   *
   * @param profileId - ID of the profile (used to determine existing records, not filtered)
   * @param showId - ID of the show
   * @param upToSeasonNumber - Optional season number ceiling
   */
  async getEpisodeAirDatesForShow(
    profileId: number,
    showId: number,
    upToSeasonNumber?: number,
  ): Promise<Map<number, string>> {
    const seasonFilter = upToSeasonNumber !== undefined
      ? `AND se.season_number <= ?`
      : '';

    const params: (number | string)[] = [showId];
    if (upToSeasonNumber !== undefined) {
      params.push(upToSeasonNumber);
    }

    const query = `
      SELECT e.id AS episodeId, e.air_date AS airDate
      FROM episodes e
      JOIN seasons se ON se.id = e.season_id
      WHERE se.show_id = ?
        AND e.air_date IS NOT NULL
        AND DATE(e.air_date) <= CURDATE()
        ${seasonFilter}
    `;

    const [rows] = await getDbPool().execute<Array<{ episodeId: number; airDate: string } & RowDataPacket>>(
      query,
      params,
    );

    const map = new Map<number, string>();
    rows.forEach((row) => {
      map.set(row.episodeId, row.airDate);
    });
    return map;
  }
}
