import * as episodesDb from '../db/episodesDb';
import { appLogger } from '../logger/logger';
import { errorService } from './errorService';
import { showService } from './showService';
import { watchStatusService } from './watchStatusService';
import {
  ProfileEpisode,
  RecentUpcomingEpisode,
  SimpleWatchStatus,
  UpdateEpisodeRequest,
  UpdateWatchStatusData,
  UserWatchStatus,
  WatchStatus,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for handling episode-related business logic
 */
export class EpisodesService {
  /**
   * Updates the watch status of an episode
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile to update the watch status for
   * @param episodeId - ID of the episode to update
   * @param status - New watch status ('WATCHED' or 'NOT_WATCHED')
   * @returns The updated show details (to which the episode belongs) and the next unwatched episodes
   * @throws {BadRequestError} If no episode watch status was updated
   */
  public async updateEpisodeWatchStatus(
    accountId: number,
    profileId: number,
    episodeId: number,
    status: UserWatchStatus,
  ): Promise<UpdateWatchStatusData> {
    try {
      const result = await watchStatusService.updateEpisodeWatchStatus(accountId, profileId, episodeId, status);

      appLogger.info(`Episode ${episodeId} update: ${result.message}`);
      appLogger.info(`Affected entities: ${result.changes.length}`);

      const showWithSeasons = await showService.getShowDetailsForProfileByChild(
        accountId,
        profileId,
        episodeId,
        'episodes',
      );
      const nextUnwatchedEpisodes = await showService.getNextUnwatchedEpisodesForProfile(profileId);
      return { showWithSeasons, nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateEpisodeWatchStatus(${accountId}, ${profileId}, ${episodeId}, ${status})`,
      );
    }
  }

  /**
   * Gets all episodes for a specific season and profile
   *
   * @param profileId - ID of the profile to get episodes for
   * @param seasonId - ID of the season to get episodes for
   * @returns Array of episodes for the season with watch status
   */
  public async getEpisodesForSeason(profileId: number, seasonId: number): Promise<ProfileEpisode[]> {
    try {
      return await episodesDb.getEpisodesForSeason(profileId, seasonId);
    } catch (error) {
      throw errorService.handleError(error, `getEpisodesForSeason(${profileId}, ${seasonId})`);
    }
  }

  /**
   * Gets upcoming episodes for a profile
   *
   * @param profileId - ID of the profile to get upcoming episodes for
   * @returns Array of upcoming episodes
   */
  public async getUpcomingEpisodesForProfile(profileId: number): Promise<RecentUpcomingEpisode[]> {
    try {
      return await episodesDb.getUpcomingEpisodesForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getUpcomingEpisodesForProfile(${profileId})`);
    }
  }

  /**
   * Gets recent episodes for a profile
   *
   * @param profileId - ID of the profile to get recent episodes for
   * @returns Array of recent episodes
   */
  public async getRecentEpisodesForProfile(profileId: number): Promise<RecentUpcomingEpisode[]> {
    try {
      return await episodesDb.getRecentEpisodesForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getRecentEpisodesForProfile(${profileId})`);
    }
  }

  /**
   * Updates an episode or creates a new one if it doesn't exist
   *
   * @param episodeData - Episode data to update or create
   * @returns The updated or created episode
   */
  public async updateEpisode(episodeData: UpdateEpisodeRequest): Promise<number> {
    try {
      return await episodesDb.updateEpisode(episodeData);
    } catch (error) {
      throw errorService.handleError(error, `updateEpisode(${JSON.stringify(episodeData)})`);
    }
  }

  /**
   * Adds an episode to a profile's favorites
   *
   * @param profileId - ID of the profile
   * @param episodeId - ID of the episode
   * @param status - watch status of the episode, defaults to NOT_WATCHED
   */
  public async addEpisodeToFavorites(
    profileId: number,
    episodeId: number,
    status: SimpleWatchStatus = WatchStatus.NOT_WATCHED,
  ): Promise<void> {
    try {
      await episodesDb.saveFavorite(profileId, episodeId, status);
    } catch (error) {
      throw errorService.handleError(error, `addEpisodeToFavorites(${profileId}, ${episodeId})`);
    }
  }
}

// Export a singleton instance for global use
export const episodesService = new EpisodesService();
