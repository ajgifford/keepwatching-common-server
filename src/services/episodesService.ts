import * as episodesDb from '../db/episodesDb';
import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import { showService } from './showService';

/**
 * Service class for handling episode-related business logic
 */
export class EpisodesService {
  /**
   * Updates the watch status of an episode
   *
   * @param profileId - ID of the profile to update the watch status for
   * @param episodeId - ID of the episode to update
   * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
   * @returns Object containing next unwatched episodes after the update
   * @throws {BadRequestError} If no episode watch status was updated
   */
  public async updateEpisodeWatchStatus(profileId: string, episodeId: number, status: string) {
    try {
      const success = await episodesDb.updateWatchStatus(profileId, episodeId, status);
      if (!success) {
        throw new BadRequestError('No episode watch status was updated');
      }

      // Invalidate cache for the profile to ensure fresh data
      showService.invalidateProfileCache(profileId);

      // Get fresh data for next unwatched episodes
      const nextUnwatchedEpisodes = await showsDb.getNextUnwatchedEpisodesForProfile(profileId);
      return { nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(error, `updateEpisodeWatchStatus(${profileId}, ${episodeId}, ${status})`);
    }
  }

  /**
   * Updates the watch status of a next episode and updates related season and show statuses
   *
   * @param profileId - ID of the profile to update the watch status for
   * @param showId - ID of the show the episode belongs to
   * @param seasonId - ID of the season the episode belongs to
   * @param episodeId - ID of the episode to update
   * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
   * @returns Object containing next unwatched episodes after the update
   * @throws {BadRequestError} If no episode watch status was updated
   */
  public async updateNextEpisodeWatchStatus(
    profileId: string,
    showId: number,
    seasonId: number,
    episodeId: number,
    status: string,
  ) {
    try {
      const success = await episodesDb.updateWatchStatus(profileId, episodeId, status);
      if (!success) {
        throw new BadRequestError('No next episode watch status was updated');
      }

      // Update related season and show statuses based on episode change
      await seasonsDb.updateWatchStatusByEpisode(profileId, seasonId);
      await showsDb.updateWatchStatusBySeason(profileId, showId);

      // Invalidate cache for the profile to ensure fresh data
      showService.invalidateProfileCache(profileId);

      // Get fresh data for next unwatched episodes
      const nextUnwatchedEpisodes = await showsDb.getNextUnwatchedEpisodesForProfile(profileId);
      return { nextUnwatchedEpisodes };
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateNextEpisodeWatchStatus(${profileId}, ${showId}, ${seasonId}, ${episodeId}, ${status})`,
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
  public async getEpisodesForSeason(profileId: string, seasonId: number) {
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
  public async getUpcomingEpisodesForProfile(profileId: string) {
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
  public async getRecentEpisodesForProfile(profileId: string) {
    try {
      return await episodesDb.getRecentEpisodesForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getRecentEpisodesForProfile(${profileId})`);
    }
  }
}

// Export a singleton instance for global use
export const episodesService = new EpisodesService();
