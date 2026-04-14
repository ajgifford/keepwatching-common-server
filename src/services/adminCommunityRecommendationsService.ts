import {
  AdminRecommendationWithProfile,
  CommunityRecommendation,
  RatingContentType,
} from '@ajgifford/keepwatching-types';
import * as communityRecommendationsDb from '../db/communityRecommendationsDb';
import { errorService } from './errorService';

export class AdminCommunityRecommendationsService {
  async getAllRecommendationsWithAttribution(filters?: {
    contentType?: RatingContentType;
    profileId?: number;
    accountId?: number;
  }): Promise<AdminRecommendationWithProfile[]> {
    try {
      return await communityRecommendationsDb.getAllRecommendationsWithAttribution(filters);
    } catch (error) {
      throw errorService.handleError(
        error,
        `getAllRecommendationsWithAttribution(${JSON.stringify(filters)})`,
      );
    }
  }

  async getTopRecommendedContent(contentType?: RatingContentType, limit?: number): Promise<CommunityRecommendation[]> {
    try {
      return await communityRecommendationsDb.getTopRecommendedContent(contentType, limit);
    } catch (error) {
      throw errorService.handleError(error, `getTopRecommendedContent(${contentType}, ${limit})`);
    }
  }

  async adminDeleteRecommendation(id: number): Promise<void> {
    try {
      await communityRecommendationsDb.adminDeleteRecommendation(id);
    } catch (error) {
      throw errorService.handleError(error, `adminDeleteRecommendation(${id})`);
    }
  }
}

export const adminCommunityRecommendationsService = new AdminCommunityRecommendationsService();
