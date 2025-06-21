import * as seasonsDb from '../db/seasonsDb';
import { appLogger } from '../logger/logger';
import { errorService } from './errorService';
import { watchStatusService } from './watchStatusService';
import {
  ProfileSeason,
  SimpleWatchStatus,
  UpdateSeasonRequest,
  UserWatchStatus,
  WatchStatus,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for handling season-related business logic
 */
export class SeasonsService {
  /**
   * Updates the watch status of a season
   *
   * @param accountId - ID of the account
   * @param profileId - ID of the profile to update the watch status for
   * @param seasonId - ID of the season to update
   * @param status - New watch status ('NOT_WATCHED' or 'WATCHED')
   * @throws {BadRequestError} If no season watch status was updated
   */
  public async updateSeasonWatchStatus(
    accountId: number,
    profileId: number,
    seasonId: number,
    status: UserWatchStatus,
  ): Promise<void> {
    try {
      const result = await watchStatusService.updateSeasonWatchStatus(accountId, profileId, seasonId, status);

      appLogger.info(`Season ${seasonId} update: ${result.message}`);
      appLogger.info(`Affected entities: ${result.changes.length}`);
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateSeasonWatchStatus(${accountId}, ${profileId}, ${seasonId}, ${status})`,
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
  public async getSeasonsForShow(profileId: number, showId: number): Promise<ProfileSeason[]> {
    try {
      return await seasonsDb.getSeasonsForShow(profileId, showId);
    } catch (error) {
      throw errorService.handleError(error, `getSeasonsForShow(${profileId}, ${showId})`);
    }
  }

  /**
   * Updates a season or creates a new one if it doesn't exist
   *
   * @param seasonData - Season data to update or create
   * @returns The updated or created season
   */
  public async updateSeason(seasonData: UpdateSeasonRequest): Promise<number> {
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
   * @param status - watch status of the season, defaults to NOT_WATCHED
   */
  public async addSeasonToFavorites(
    profileId: number,
    seasonId: number,
    status: SimpleWatchStatus = WatchStatus.NOT_WATCHED,
  ): Promise<void> {
    try {
      await seasonsDb.saveFavorite(profileId, seasonId, status);
    } catch (error) {
      throw errorService.handleError(error, `addSeasonToFavorites(${profileId}, ${seasonId})`);
    }
  }
}

export const seasonsService = new SeasonsService();
