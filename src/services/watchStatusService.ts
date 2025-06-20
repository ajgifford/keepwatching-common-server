import { WatchStatusDbService } from '../db/watchStatusDb';
import { DatabaseError } from '../middleware/errorMiddleware';
import { StatusChange, StatusUpdateResult } from '../types/watchStatusTypes';
import { errorService } from './errorService';
import { showService } from './showService';
import { UserWatchStatus } from '@ajgifford/keepwatching-types';

/**
 * Service for managing watch statuses for shows with centralized logic
 */
export class WatchStatusService {
  private dbService: WatchStatusDbService;

  constructor() {
    this.dbService = new WatchStatusDbService();
  }

  /**
   * Update episode watch status with automatic propagation
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

      const showChanges = result.changes.filter((c) => c.entityType === 'show');
      if (showChanges.length > 0) {
        showService.invalidateProfileCache(accountId, profileId);
      }

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
   * Update season watch status with episode propagation
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
   * Update show watch status with season/episode propagation
   */
  async updateShowWatchStatus(
    accountId: number,
    profileId: number,
    showId: number,
    status: UserWatchStatus,
  ): Promise<{
    success: boolean;
    changes: StatusChange[];
    message: string;
  }> {
    try {
      const result = await this.dbService.updateShowWatchStatus(profileId, showId, status);

      if (!result.success) {
        throw new DatabaseError('Failed to update show watch status', null);
      }

      showService.invalidateProfileCache(accountId, profileId);

      return {
        success: true,
        changes: result.changes,
        message: this.formatChangesMessage(result.changes),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateShowWatchStatus(${profileId}, ${showId}, ${status})`);
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
 * Singleton instance for global access
 */
export const watchStatusService = new WatchStatusService();
