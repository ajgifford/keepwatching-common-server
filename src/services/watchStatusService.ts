import { WatchStatusDbService } from '../db/watchStatusDb';
import { DatabaseError } from '../middleware/errorMiddleware';
import { StatusChange, StatusUpdateResult } from '../types/watchStatusTypes';
import { checkAndRecordAchievements } from './achievementDetectionService';
import { errorService } from './errorService';
import { showService } from './showService';
import { UserWatchStatus } from '@ajgifford/keepwatching-types';

/**
 * Service for managing watch statuses for shows with centralized logic
 */
export class WatchStatusService {
  private dbService: WatchStatusDbService;
  private checkAchievements: (profileId: number, accountId: number) => Promise<number>;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: {
    dbService?: WatchStatusDbService;
    checkAchievements?: (profileId: number, accountId: number) => Promise<number>;
  }) {
    this.dbService = dependencies?.dbService ?? new WatchStatusDbService();
    this.checkAchievements = dependencies?.checkAchievements ?? checkAndRecordAchievements;
  }

  /**
   * Update the watch status of an episode based off of the provided status. Will then propagate to the parent season and show.  This method is intended to be called when there is an action taken by an end-user.
   * @param accountId ID of the account
   * @param profileId ID of the profile
   * @param episodeId ID of the episode
   * @param status the target watch status for the show, either 'WATCHED' or 'NOT_WATCHED'
   * @returns Object indicating if the status was updated and the new status
   */
  async updateEpisodeWatchStatus(
    accountId: number,
    profileId: number,
    episodeId: number,
    status: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.updateEpisodeWatchStatus(profileId, episodeId, status);

      if (!result.success) {
        throw new DatabaseError('Failed to update episode watch status', null);
      }

      showService.invalidateProfileCache(accountId, profileId);

      // Check for new achievements (non-blocking)
      this.checkAchievements(profileId, accountId).catch((err) => {
        console.error('Error checking achievements after episode watch status update:', err);
      });

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: this.formatChangesMessage(result.changes),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateEpisodeWatchStatus(${profileId}, ${episodeId}, ${status})`);
    }
  }

  /**
   * Update the watch status of a season based off of the provided status. Will then propagate to the children episodes and parent show. This method is intended to be called when there is an action taken by an end-user.
   * @param accountId ID of the account
   * @param profileId ID of the profile
   * @param seasonId ID of the season
   * @param status the target watch status for the show, either 'WATCHED' or 'NOT_WATCHED'
   * @returns Object indicating if the status was updated and the new status
   */
  async updateSeasonWatchStatus(
    accountId: number,
    profileId: number,
    seasonId: number,
    status: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.updateSeasonWatchStatus(profileId, seasonId, status);

      if (!result.success) {
        throw new DatabaseError('Failed to update season watch status', null);
      }

      const showChanges = result.changes.filter((c) => c.entityType === 'show');
      if (showChanges.length > 0) {
        showService.invalidateProfileCache(accountId, profileId);
      }

      // Check for new achievements (non-blocking)
      this.checkAchievements(profileId, accountId).catch((err) => {
        console.error('Error checking achievements after season watch status update:', err);
      });

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: this.formatChangesMessage(result.changes),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateSeasonWatchStatus(${profileId}, ${seasonId}, ${status})`);
    }
  }

  /**
   * Update the watch status of a show based off of the provided status. Will then propagate to the children seasons and episodes. This method is intended to be called when there is an action taken by an end-user.
   *
   * @param accountId ID of the account
   * @param profileId ID of the profile
   * @param showId ID of the show
   * @param status the target watch status for the show, either 'WATCHED' or 'NOT_WATCHED'
   * @returns Object indicating if the status was updated and the new status
   */
  async updateShowWatchStatus(
    accountId: number,
    profileId: number,
    showId: number,
    status: UserWatchStatus,
  ): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.updateShowWatchStatus(profileId, showId, status);

      if (!result.success) {
        throw new DatabaseError('Failed to update show watch status', null);
      }

      showService.invalidateProfileCache(accountId, profileId);

      // Check for new achievements (non-blocking)
      this.checkAchievements(profileId, accountId).catch((err) => {
        console.error('Error checking achievements after show watch status update:', err);
      });

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: this.formatChangesMessage(result.changes),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateShowWatchStatus(${profileId}, ${showId}, ${status})`);
    }
  }

  /**
   * Mark all episodes in the completed seasons of a show as prior-watched.
   * Uses each episode's air date as watched_at. Season status is recalculated after.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param upToSeasonNumber - Optional; if provided, only seasons with seasonNumber <= this value are marked
   */
  async markSeasonsAsPriorWatched(
    accountId: number,
    profileId: number,
    showId: number,
    upToSeasonNumber?: number,
  ): Promise<StatusUpdateResult> {
    try {
      // Fetch the episodes for the show, filtered by season if needed
      const episodeAirDateMap = await this.dbService.getEpisodeAirDatesForShow(
        profileId,
        showId,
        upToSeasonNumber,
      );

      if (episodeAirDateMap.size === 0) {
        return { success: true, changes: [], affectedRows: 0, message: 'No episodes to mark' };
      }

      const result = await this.dbService.markEpisodesAsPriorWatched(profileId, episodeAirDateMap);

      if (!result.success) {
        throw new DatabaseError('Failed to mark episodes as prior watched', null);
      }

      showService.invalidateProfileCache(accountId, profileId);

      this.checkAchievements(profileId, accountId).catch((err) => {
        console.error('Error checking achievements after prior watch marking:', err);
      });

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: `Marked ${result.affectedRows} episodes as previously watched`,
      };
    } catch (error) {
      throw errorService.handleError(
        error,
        `markSeasonsAsPriorWatched(${profileId}, ${showId}, ${upToSeasonNumber})`,
      );
    }
  }

  /**
   * Retroactively flag watched episodes for a show as prior-watched.
   * Used by the Review Watch History feature for existing data cleanup.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param seasonIds - Optional list of season IDs to limit the operation
   */
  async retroactivelyMarkShowAsPrior(
    accountId: number,
    profileId: number,
    showId: number,
    seasonIds?: number[],
  ): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.retroactivelyMarkShowAsPrior(profileId, showId, seasonIds);

      if (!result.success) {
        throw new DatabaseError('Failed to retroactively mark show as prior watched', null);
      }

      showService.invalidateProfileCache(accountId, profileId);

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: `Retroactively marked ${result.affectedRows} episodes as previously watched`,
      };
    } catch (error) {
      throw errorService.handleError(
        error,
        `retroactivelyMarkShowAsPrior(${profileId}, ${showId})`,
      );
    }
  }

  /**
   * Checks whether a show's status should be updated to reflect that new content is available
   *
   * @param accountId ID of the account
   * @param profileId ID of the profile
   * @param showId ID of the show
   * @returns Object indicating if the status was updated and the new status
   */
  public async checkAndUpdateShowStatus(
    accountId: number,
    profileId: number,
    showId: number,
  ): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.checkAndUpdateShowWatchStatus(profileId, showId);

      if (!result.success) {
        throw new DatabaseError('Failed to recalculate and update show watch status', null);
      }

      if (result.affectedRows <= 0) {
        return {
          success: true,
          changes: result.changes,
          affectedRows: result.affectedRows,
          message: 'Show status is already correct',
        };
      }

      showService.invalidateProfileCache(accountId, profileId);

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: this.formatChangesMessage(result.changes),
      };
    } catch (error) {
      throw errorService.handleError(error, `checkAndUpdateShowStatus(${profileId}, ${showId})`);
    }
  }

  /**
   * Checks whether any movies' status should be updated from UNAIRED to NOT_WATCHED
   * This is called when movies are retrieved for a profile
   *
   * @param profileId ID of the profile
   * @param movieId ID of the movie to check
   * @returns Object indicating if the status was updated
   */
  public async checkAndUpdateMovieStatus(profileId: number, movieId: number): Promise<StatusUpdateResult> {
    try {
      const result = await this.dbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      if (!result.success) {
        throw new DatabaseError('Failed to check and update movie watch status', null);
      }

      return {
        success: true,
        changes: result.changes,
        affectedRows: result.affectedRows,
        message: result.affectedRows > 0 ? this.formatChangesMessage(result.changes) : 'Movie status is current',
      };
    } catch (error) {
      throw errorService.handleError(error, `checkAndUpdateMovieStatus(${profileId}, ${movieId})`);
    }
  }

  private formatChangesMessage(changes: StatusChange[]): string {
    if (changes.length === 0) {
      return 'No status changes occurred';
    }

    const changesByType = changes.reduce(
      (acc, change) => {
        acc[change.entityType] = (acc[change.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const parts = Object.entries(changesByType).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`);

    return `Updated status for ${parts.join(', ')}`;
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createWatchStatusService(dependencies?: {
  dbService?: WatchStatusDbService;
  checkAchievements?: (profileId: number, accountId: number) => Promise<number>;
}): WatchStatusService {
  return new WatchStatusService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: WatchStatusService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getWatchStatusService(): WatchStatusService {
  if (!instance) {
    instance = createWatchStatusService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetWatchStatusService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { watchStatusService }` continues to work
 */
export const watchStatusService = getWatchStatusService();
