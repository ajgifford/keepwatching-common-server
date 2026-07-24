import {
  getEpisodeWatchDetail,
  getMovieWatchDetail,
  getSeasonWatchDetail,
  getShowWatchDetail,
  updateEpisodeWatchHistoryDate,
  updateEpisodeWatchStatusDate,
  updateMovieWatchHistoryDate,
  updateMovieWatchStatusDate,
  updateSeasonWatchHistoryDate,
  updateShowWatchHistoryDate,
} from '../db/adminWatchHistoryDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import { AdminWatchHistoryContentType, AdminWatchHistoryDetailResponse } from '@ajgifford/keepwatching-types';

/**
 * Service backing the admin watch-history date/time editor. Reads and corrects
 * `watched_at` values for a profile's episode/movie/season/show watch record.
 *
 * Scope: this service only corrects historical timestamps. It never changes
 * `status`, `rewatch_count`, or triggers status cascade/recalculation, and it
 * never renumbers `watchNumber` (which reflects log order, not chronological
 * order).
 */
export class AdminWatchHistoryService {
  private assertNotFuture(watchedAt: string): void {
    if (new Date(watchedAt).getTime() > Date.now()) {
      throw new BadRequestError('watchedAt cannot be in the future');
    }
  }

  /**
   * Get the current watch-status row and full watch-history log for a profile's
   * episode, movie, season, or show.
   *
   * @param contentType - Content granularity to look up
   * @param profileId - ID of the profile
   * @param contentId - ID of the episode/movie/season/show
   */
  async getWatchHistoryDetail(
    contentType: AdminWatchHistoryContentType,
    profileId: number,
    contentId: number,
  ): Promise<AdminWatchHistoryDetailResponse> {
    try {
      switch (contentType) {
        case 'episode':
          return await getEpisodeWatchDetail(profileId, contentId);
        case 'movie':
          return await getMovieWatchDetail(profileId, contentId);
        case 'season':
          return await getSeasonWatchDetail(profileId, contentId);
        case 'show':
          return await getShowWatchDetail(profileId, contentId);
      }
    } catch (error) {
      throw errorService.handleError(error, `getWatchHistoryDetail(${contentType}, ${profileId}, ${contentId})`);
    }
  }

  /**
   * Correct the watched date/time of a single watch-history log row.
   *
   * @param contentType - Content granularity the history row belongs to
   * @param historyId - ID of the watch-history row to update
   * @param watchedAt - ISO datetime to set; rejected if in the future
   */
  async updateWatchHistoryEntryDate(
    contentType: AdminWatchHistoryContentType,
    historyId: number,
    watchedAt: string,
  ): Promise<void> {
    try {
      this.assertNotFuture(watchedAt);

      switch (contentType) {
        case 'episode':
          return await updateEpisodeWatchHistoryDate(historyId, watchedAt);
        case 'movie':
          return await updateMovieWatchHistoryDate(historyId, watchedAt);
        case 'season':
          return await updateSeasonWatchHistoryDate(historyId, watchedAt);
        case 'show':
          return await updateShowWatchHistoryDate(historyId, watchedAt);
      }
    } catch (error) {
      throw errorService.handleError(error, `updateWatchHistoryEntryDate(${contentType}, ${historyId}, ${watchedAt})`);
    }
  }

  /**
   * Correct the status-level watched date/time. Only episodes and movies carry
   * a status-level `watchedAt` — seasons and shows derive their status from
   * propagation and have no date of their own to correct.
   *
   * @param contentType - Must be 'episode' or 'movie'
   * @param profileId - ID of the profile
   * @param contentId - ID of the episode or movie
   * @param watchedAt - ISO datetime to set; rejected if in the future
   */
  async updateWatchStatusDate(
    contentType: AdminWatchHistoryContentType,
    profileId: number,
    contentId: number,
    watchedAt: string,
  ): Promise<void> {
    try {
      this.assertNotFuture(watchedAt);

      if (contentType === 'episode') {
        return await updateEpisodeWatchStatusDate(profileId, contentId, watchedAt);
      }
      if (contentType === 'movie') {
        return await updateMovieWatchStatusDate(profileId, contentId, watchedAt);
      }

      throw new BadRequestError(
        `Content type '${contentType}' has no status-level watched date to update; only its history entries can be corrected`,
      );
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateWatchStatusDate(${contentType}, ${profileId}, ${contentId}, ${watchedAt})`,
      );
    }
  }
}

let instance: AdminWatchHistoryService | null = null;

export function getAdminWatchHistoryService(): AdminWatchHistoryService {
  if (!instance) {
    instance = new AdminWatchHistoryService();
  }
  return instance;
}

export function resetAdminWatchHistoryService(): void {
  instance = null;
}

export const adminWatchHistoryService = getAdminWatchHistoryService();
