import {
  addWatchlistItem as addWatchlistItemDb,
  getWatchlistForProfile,
  removeWatchlistItem as removeWatchlistItemDb,
  updateWatchlistPriorities as updateWatchlistPrioritiesDb,
} from '../db/watchlistDb';
import { errorService } from './errorService';
import { WatchlistContentType, WatchlistItem } from '@ajgifford/keepwatching-types';

export class WatchlistService {
  async getWatchlist(profileId: number): Promise<WatchlistItem[]> {
    try {
      return await getWatchlistForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getWatchlist(${profileId})`);
    }
  }

  async addItem(
    accountId: number,
    profileId: number,
    contentType: WatchlistContentType,
    contentId: number,
  ): Promise<WatchlistItem> {
    try {
      return await addWatchlistItemDb(accountId, profileId, contentType, contentId);
    } catch (error) {
      throw errorService.handleError(error, `addWatchlistItem(${profileId}, ${contentType}, ${contentId})`);
    }
  }

  async removeItem(itemId: number, profileId: number): Promise<void> {
    try {
      await removeWatchlistItemDb(itemId, profileId);
    } catch (error) {
      throw errorService.handleError(error, `removeWatchlistItem(${itemId}, ${profileId})`);
    }
  }

  async updatePriorities(profileId: number, priorities: Array<{ id: number; priority: number }>): Promise<void> {
    try {
      await updateWatchlistPrioritiesDb(profileId, priorities);
    } catch (error) {
      throw errorService.handleError(error, `updateWatchlistPriorities(${profileId})`);
    }
  }
}

export const watchlistService = new WatchlistService();
