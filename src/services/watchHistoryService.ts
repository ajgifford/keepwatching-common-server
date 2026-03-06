import { BulkMarkedShowRow, WatchStatusDbService } from '../db/watchStatusDb';
import { BulkMarkedShow } from '@ajgifford/keepwatching-types';
import { errorService } from './errorService';
import { showService } from './showService';
import { watchStatusService } from './watchStatusService';
import { UpdateWatchStatusData } from '@ajgifford/keepwatching-types';

/**
 * Service for managing prior watch history and watch history cleanup
 */
export class WatchHistoryService {
  private dbService: WatchStatusDbService;

  constructor(dependencies?: { dbService?: WatchStatusDbService }) {
    this.dbService = dependencies?.dbService ?? new WatchStatusDbService();
  }

  /**
   * Mark all completed prior seasons of a show as previously watched.
   * Uses each episode's air date as watched_at so statistics remain accurate.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param upToSeasonNumber - Optional; mark only seasons up to and including this season number
   * @returns Updated show with seasons and next unwatched episodes
   */
  async markShowAsPriorWatched(
    accountId: number,
    profileId: number,
    showId: number,
    upToSeasonNumber?: number,
  ): Promise<UpdateWatchStatusData> {
    try {
      await watchStatusService.markSeasonsAsPriorWatched(accountId, profileId, showId, upToSeasonNumber);

      const showWithSeasons = await showService.getShowDetailsForProfile(accountId, profileId, showId);
      const nextUnwatchedEpisodes = await showService.getNextUnwatchedEpisodesForProfile(profileId);
      return { showWithSeasons, nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(
        error,
        `markShowAsPriorWatched(${accountId}, ${profileId}, ${showId}, ${upToSeasonNumber})`,
      );
    }
  }

  /**
   * Find shows where the profile has bulk-marked many episodes on the same day,
   * none of which are flagged as prior watches. Used by Review Watch History UI.
   *
   * @param profileId - ID of the profile
   * @returns Array of candidate shows for retroactive prior-watch flagging
   */
  async getBulkMarkedShows(profileId: number): Promise<BulkMarkedShow[]> {
    try {
      const rows: BulkMarkedShowRow[] = await this.dbService.detectBulkMarkedShows(profileId);
      return rows.map((row) => ({
        showId: row.showId,
        title: row.title,
        posterImage: row.posterImage,
        markDate: row.markDate,
        episodeCount: row.episodeCount,
      }));
    } catch (error) {
      throw errorService.handleError(error, `getBulkMarkedShows(${profileId})`);
    }
  }

  /**
   * Dismiss a bulk-marked show from the watch history review.
   * Sets is_prior_watch = TRUE and watched_at = updated_at (the bulk-mark date) so the
   * show no longer appears in detectBulkMarkedShows without altering the watch dates.
   *
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   */
  async dismissBulkMarkedShow(profileId: number, showId: number): Promise<void> {
    try {
      await this.dbService.dismissBulkMarkedShow(profileId, showId);
    } catch (error) {
      throw errorService.handleError(error, `dismissBulkMarkedShow(${profileId}, ${showId})`);
    }
  }

  /**
   * Retroactively flag watched episodes for a show as prior-watched.
   * Sets is_prior_watch = TRUE and watched_at = episode air date on matching records.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param seasonIds - Optional list of season IDs; if omitted all watched seasons are updated
   */
  async retroactivelyMarkShowAsPrior(
    accountId: number,
    profileId: number,
    showId: number,
    seasonIds?: number[],
  ): Promise<void> {
    try {
      await watchStatusService.retroactivelyMarkShowAsPrior(accountId, profileId, showId, seasonIds);
    } catch (error) {
      throw errorService.handleError(
        error,
        `retroactivelyMarkShowAsPrior(${accountId}, ${profileId}, ${showId})`,
      );
    }
  }
}

let instance: WatchHistoryService | null = null;

export function getWatchHistoryService(): WatchHistoryService {
  if (!instance) {
    instance = new WatchHistoryService();
  }
  return instance;
}

export function resetWatchHistoryService(): void {
  instance = null;
}

export const watchHistoryService = getWatchHistoryService();
