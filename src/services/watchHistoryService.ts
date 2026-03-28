import {
  getEpisodeWatchCount,
  getShowIdForSeason,
  getWatchHistoryForProfile,
  recalculateShowStatusAfterSeasonReset,
  recordEpisodeRewatch as recordEpisodeRewatchDb,
  resetMovieForRewatch,
  resetSeasonForRewatch,
  resetShowForRewatch,
} from '../db/watchHistoryDb';
import { BulkMarkedShowRow, WatchStatusDbService } from '../db/watchStatusDb';
import { transformWatchHistoryRow } from '../types/watchHistoryTypes';
import { TransactionHelper } from '../utils/transactionHelper';
import { BulkMarkedShow, ProfileMovie, UpdateWatchStatusData, WatchHistoryItem } from '@ajgifford/keepwatching-types';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { showService } from './showService';
import { watchStatusService } from './watchStatusService';

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
   * Mark a specific set of seasons as previously watched using each episode's air date.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show
   * @param seasonIds - Array of season IDs to mark as prior watched
   * @returns Updated show with seasons and next unwatched episodes
   */
  async markSeasonIdsAsPriorWatched(
    accountId: number,
    profileId: number,
    showId: number,
    seasonIds: number[],
  ): Promise<UpdateWatchStatusData> {
    try {
      await watchStatusService.markSeasonIdsAsPriorWatched(accountId, profileId, showId, seasonIds);

      const showWithSeasons = await showService.getShowDetailsForProfile(accountId, profileId, showId);
      const nextUnwatchedEpisodes = await showService.getNextUnwatchedEpisodesForProfile(profileId);
      return { showWithSeasons, nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(
        error,
        `markSeasonIdsAsPriorWatched(${accountId}, ${profileId}, ${showId}, [${seasonIds.join(', ')}])`,
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

  /**
   * Reset all episodes and seasons for a show to NOT_WATCHED so the user can
   * rewatch it from the beginning. Increments show_watch_status.rewatch_count
   * so the show continues to appear in Keep Watching with zero WATCHED episodes.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param showId - ID of the show to rewatch
   * @returns Updated show with seasons and next unwatched episodes
   */
  async startShowRewatch(accountId: number, profileId: number, showId: number): Promise<UpdateWatchStatusData> {
    const transactionHelper = new TransactionHelper();
    try {
      await transactionHelper.executeInTransaction(async (conn) => {
        await resetShowForRewatch(conn, profileId, showId);
      });

      await showService.invalidateAccountCache(accountId);

      const showWithSeasons = await showService.getShowDetailsForProfile(accountId, profileId, showId);
      const nextUnwatchedEpisodes = await showService.getNextUnwatchedEpisodesForProfile(profileId);
      return { showWithSeasons, nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(error, `startShowRewatch(${accountId}, ${profileId}, ${showId})`);
    }
  }

  /**
   * Reset all episodes in a single season to NOT_WATCHED so the user can
   * rewatch that season. The show status is recalculated based on remaining
   * season statuses (WATCHING if any season is still non-NOT_WATCHED, else NOT_WATCHED).
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param seasonId - ID of the season to rewatch
   * @returns Updated show with seasons and next unwatched episodes
   */
  async startSeasonRewatch(accountId: number, profileId: number, seasonId: number): Promise<UpdateWatchStatusData> {
    const transactionHelper = new TransactionHelper();
    try {
      let showId: number | null = null;

      await transactionHelper.executeInTransaction(async (conn) => {
        showId = await getShowIdForSeason(conn, seasonId);
        if (!showId) throw new Error(`Season ${seasonId} not found`);

        await resetSeasonForRewatch(conn, profileId, seasonId);
        await recalculateShowStatusAfterSeasonReset(conn, profileId, showId);
      });

      await showService.invalidateAccountCache(accountId);

      const showWithSeasons = await showService.getShowDetailsForProfile(accountId, profileId, showId!);
      const nextUnwatchedEpisodes = await showService.getNextUnwatchedEpisodesForProfile(profileId);
      return { showWithSeasons, nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(error, `startSeasonRewatch(${accountId}, ${profileId}, ${seasonId})`);
    }
  }

  /**
   * Reset a movie to NOT_WATCHED so the user can rewatch it.
   * Increments movie_watch_status.rewatch_count.
   *
   * @param accountId - ID of the account (unused but kept for consistency and future cache use)
   * @param profileId - ID of the profile
   * @param movieId - ID of the movie to rewatch
   * @returns Updated ProfileMovie reflecting the NOT_WATCHED state
   */
  async startMovieRewatch(accountId: number, profileId: number, movieId: number): Promise<ProfileMovie> {
    const transactionHelper = new TransactionHelper();
    try {
      await transactionHelper.executeInTransaction(async (conn) => {
        await resetMovieForRewatch(conn, profileId, movieId);
      });

      return await moviesService.getMovieDetailsForProfile(profileId, movieId);
    } catch (error) {
      throw errorService.handleError(error, `startMovieRewatch(${accountId}, ${profileId}, ${movieId})`);
    }
  }

  /**
   * Log a casual single-episode rewatch without changing its WATCHED status.
   * Inserts a new episode_watch_history row and returns the updated watch count.
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile
   * @param episodeId - ID of the episode being rewatched
   * @returns Updated episodeId, watchCount, and watchedAt timestamp
   */
  async recordEpisodeRewatch(
    accountId: number,
    profileId: number,
    episodeId: number,
  ): Promise<{ episodeId: number; watchCount: number; watchedAt: string }> {
    const transactionHelper = new TransactionHelper();
    try {
      await transactionHelper.executeInTransaction(async (conn) => {
        await recordEpisodeRewatchDb(conn, profileId, episodeId);
      });

      const watchCount = await getEpisodeWatchCount(profileId, episodeId);
      const watchedAt = new Date().toISOString();
      return { episodeId, watchCount, watchedAt };
    } catch (error) {
      throw errorService.handleError(error, `recordEpisodeRewatch(${accountId}, ${profileId}, ${episodeId})`);
    }
  }

  /**
   * Retrieve paginated watch history for a profile.
   *
   * @param profileId - ID of the profile
   * @param page - 1-based page number (default: 1)
   * @param pageSize - Items per page (default: 20)
   * @param contentType - Filter by 'episode', 'movie', or 'all' (default)
   * @param sortOrder - Sort direction on watchedAt: 'asc' or 'desc' (default)
   * @param dateFrom - ISO date string 'YYYY-MM-DD' — inclusive lower bound on watchedAt
   * @param dateTo - ISO date string 'YYYY-MM-DD' — inclusive upper bound on watchedAt (full day)
   * @param isPriorWatchOnly - When true, only return prior-watch episode entries
   * @param searchQuery - Filter episodes by show name, movies by title (partial match)
   * @param excludePriorWatch - When true, exclude prior-watch episode entries
   * @returns Paginated history items with total count
   */
  async getHistoryForProfile(
    profileId: number,
    page: number = 1,
    pageSize: number = 20,
    contentType: 'episode' | 'movie' | 'all' = 'all',
    sortOrder: 'asc' | 'desc' = 'desc',
    dateFrom?: string,
    dateTo?: string,
    isPriorWatchOnly: boolean = false,
    searchQuery?: string,
    excludePriorWatch: boolean = false,
  ): Promise<{ items: WatchHistoryItem[]; totalCount: number; page: number; pageSize: number }> {
    try {
      const { items, totalCount } = await getWatchHistoryForProfile(
        profileId,
        page,
        pageSize,
        contentType,
        sortOrder,
        dateFrom,
        dateTo,
        isPriorWatchOnly,
        searchQuery,
        excludePriorWatch,
      );
      return { items: items.map(transformWatchHistoryRow), totalCount, page, pageSize };
    } catch (error) {
      throw errorService.handleError(error, `getHistoryForProfile(${profileId}, ${page}, ${pageSize})`);
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
