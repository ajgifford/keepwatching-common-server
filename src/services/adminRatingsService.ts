import * as ratingsDb from '../db/ratingsDb';
import { errorService } from './errorService';
import { AdminContentRatingSummary, AdminRatingWithProfile, RatingContentType } from '@ajgifford/keepwatching-types';

export class AdminRatingsService {
  async getAggregateRatingsForContent(
    contentType: RatingContentType,
    contentId: number,
  ): Promise<AdminContentRatingSummary> {
    try {
      return await ratingsDb.getAggregateRatingsForContent(contentType, contentId);
    } catch (error) {
      throw errorService.handleError(error, `getAggregateRatingsForContent(${contentType}, ${contentId})`);
    }
  }

  async getAllRatings(filters?: {
    contentType?: RatingContentType;
    profileId?: number;
    accountId?: number;
  }): Promise<AdminRatingWithProfile[]> {
    try {
      return await ratingsDb.getAllRatings(filters);
    } catch (error) {
      throw errorService.handleError(error, `getAllRatings(${JSON.stringify(filters)})`);
    }
  }

  async adminDeleteRating(ratingId: number): Promise<void> {
    try {
      await ratingsDb.adminDeleteRating(ratingId);
    } catch (error) {
      throw errorService.handleError(error, `adminDeleteRating(${ratingId})`);
    }
  }
}

export const adminRatingsService = new AdminRatingsService();
