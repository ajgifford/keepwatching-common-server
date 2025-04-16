import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import { showService } from './showService';

/**
 * Service class for handling season-related business logic
 */
export class SeasonsService {
  /**
   * Updates the watch status of a season
   *
   * @param profileId - ID of the profile to update the watch status for
   * @param seasonId - ID of the season to update
   * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
   * @param recursive - Whether to update all episodes as well
   * @returns Success state of the update operation
   * @throws {BadRequestError} If no season watch status was updated
   */
  public async updateSeasonWatchStatus(
    profileId: string,
    seasonId: number,
    status: string,
    recursive: boolean = false,
  ) {
    try {
      const success = recursive
        ? await seasonsDb.updateAllWatchStatuses(profileId, seasonId, status)
        : await seasonsDb.updateWatchStatus(profileId, seasonId, status);

      if (!success) {
        throw new BadRequestError('No season watch status was updated');
      }

      const showId = await seasonsDb.getShowIdForSeason(seasonId);
      if (showId) {
        await showsDb.updateWatchStatusBySeason(profileId, showId);

        showService.invalidateProfileCache(profileId);
      }

      return success;
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateSeasonWatchStatus(${profileId}, ${seasonId}, ${status}, ${recursive})`,
      );
    }
  }

  /**
   * Gets all seasons for a specific show and profile with their episodes
   *
   * @param profileId - ID of the profile to get seasons for
   * @param showId - ID of the show to get seasons for
   * @returns Array of seasons with watch status and their episodes
   */
  public async getSeasonsForShow(profileId: string, showId: string) {
    try {
      return await seasonsDb.getSeasonsForShow(profileId, showId);
    } catch (error) {
      throw errorService.handleError(error, `getSeasonsForShow(${profileId}, ${showId})`);
    }
  }

  /**
   * Updates the watch status of a season when new episodes are added
   * If a season was previously marked as WATCHED, update to WATCHING since there's new content
   *
   * @param profileId ID of the profile
   * @param seasonId ID of the season in the database
   */
  public async updateSeasonWatchStatusForNewEpisodes(profileId: string, seasonId: number): Promise<void> {
    try {
      const seasonWatchStatus = await seasonsDb.getWatchStatus(profileId, seasonId);

      if (seasonWatchStatus === 'WATCHED') {
        await seasonsDb.updateWatchStatus(profileId, seasonId, 'WATCHING');

        const seasonShowId = await seasonsDb.getShowIdForSeason(seasonId);
        if (seasonShowId) {
          const showWatchStatus = await showsDb.getWatchStatus(profileId, seasonShowId);
          if (showWatchStatus === 'WATCHED') {
            await showsDb.updateWatchStatus(profileId, seasonShowId, 'WATCHING');
          }
        }
      }
    } catch (error) {
      throw errorService.handleError(error, `updateSeasonWatchStatusForNewEpisodes(${profileId}, ${seasonId})`);
    }
  }
}

export const seasonsService = new SeasonsService();
