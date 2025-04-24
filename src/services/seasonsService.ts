import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { WatchStatus } from '../types/watchStatusTypes';
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
   * @param status - New watch status ('NOT_WATCHED', 'WATCHING', 'WATCHED', or 'UP_TO_DATE')
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
      // Validate status is a valid watch status
      if (!Object.values(WatchStatus).includes(status as WatchStatus)) {
        throw new BadRequestError(`Invalid watch status: ${status}`);
      }

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
   * If a season was previously marked as WATCHED, update to UP_TO_DATE since there's new content
   * that's consistent with what the user has already seen
   *
   * @param profileId ID of the profile
   * @param seasonId ID of the season in the database
   */
  public async updateSeasonWatchStatusForNewEpisodes(profileId: string, seasonId: number): Promise<void> {
    try {
      const seasonWatchStatus = await seasonsDb.getWatchStatus(profileId, seasonId);

      if (seasonWatchStatus === WatchStatus.WATCHED) {
        await seasonsDb.updateWatchStatus(profileId, seasonId, WatchStatus.UP_TO_DATE);

        const seasonShowId = await seasonsDb.getShowIdForSeason(seasonId);
        if (seasonShowId) {
          const showWatchStatus = await showsDb.getWatchStatus(profileId, seasonShowId);
          if (showWatchStatus === WatchStatus.WATCHED) {
            await showsDb.updateWatchStatus(profileId, seasonShowId, WatchStatus.UP_TO_DATE);
          }
        }
      }
    } catch (error) {
      throw errorService.handleError(error, `updateSeasonWatchStatusForNewEpisodes(${profileId}, ${seasonId})`);
    }
  }

  /**
   * Updates a season or creates a new one if it doesn't exist
   *
   * @param seasonData - Season data to update or create
   * @returns The updated or created season
   */
  public async updateSeason(seasonData: any) {
    try {
      return await seasonsDb.updateSeason(seasonData);
    } catch (error) {
      throw errorService.handleError(error, `updateSeason(${JSON.stringify(seasonData)})`);
    }
  }

  /**
   * Adds a season to a profile's favorites
   *
   * @param profileId - ID of the profile
   * @param seasonId - ID of the season
   */
  public async addSeasonToFavorites(profileId: number, seasonId: number) {
    try {
      await seasonsDb.saveFavorite(profileId, seasonId);
    } catch (error) {
      throw errorService.handleError(error, `addSeasonToFavorites(${profileId}, ${seasonId})`);
    }
  }
}

export const seasonsService = new SeasonsService();
