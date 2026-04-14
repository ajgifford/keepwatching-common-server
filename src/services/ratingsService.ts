import { ContentRating, RatingContentType } from '@ajgifford/keepwatching-types';
import * as ratingsDb from '../db/ratingsDb';
import { errorService } from './errorService';

export class RatingsService {
  async upsertRating(
    profileId: number,
    contentType: RatingContentType,
    contentId: number,
    rating: number,
    note: string | null | undefined,
    contentTitle: string,
    posterImage: string,
  ): Promise<ContentRating> {
    try {
      return await ratingsDb.upsertRating(profileId, contentType, contentId, rating, note, contentTitle, posterImage);
    } catch (error) {
      throw errorService.handleError(error, `upsertRating(${profileId}, ${contentType}, ${contentId})`);
    }
  }

  async getRatingsForProfile(profileId: number): Promise<ContentRating[]> {
    try {
      return await ratingsDb.getRatingsForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getRatingsForProfile(${profileId})`);
    }
  }

  async deleteRating(profileId: number, ratingId: number): Promise<void> {
    try {
      await ratingsDb.deleteRating(profileId, ratingId);
    } catch (error) {
      throw errorService.handleError(error, `deleteRating(${profileId}, ${ratingId})`);
    }
  }
}

let ratingsServiceInstance: RatingsService | null = null;

export const ratingsService = new RatingsService();

export const createRatingsService = (): RatingsService => {
  ratingsServiceInstance = new RatingsService();
  return ratingsServiceInstance;
};

export const resetRatingsService = (): void => {
  ratingsServiceInstance = null;
};
