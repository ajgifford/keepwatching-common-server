import {
  CommunityRecommendation,
  ProfileRecommendation,
  RatingContentType,
  RecommendationDetail,
} from '@ajgifford/keepwatching-types';
import * as communityRecommendationsDb from '../db/communityRecommendationsDb';
import { errorService } from './errorService';

export class CommunityRecommendationsService {
  async addRecommendation(
    profileId: number,
    contentType: RatingContentType,
    contentId: number,
    rating: number | null | undefined,
    message: string | null | undefined,
  ): Promise<ProfileRecommendation> {
    try {
      return await communityRecommendationsDb.addRecommendation(profileId, contentType, contentId, rating, message);
    } catch (error) {
      throw errorService.handleError(
        error,
        `addRecommendation(${profileId}, ${contentType}, ${contentId})`,
      );
    }
  }

  async removeRecommendation(
    profileId: number,
    contentType: RatingContentType,
    contentId: number,
  ): Promise<void> {
    try {
      await communityRecommendationsDb.removeRecommendation(profileId, contentType, contentId);
    } catch (error) {
      throw errorService.handleError(
        error,
        `removeRecommendation(${profileId}, ${contentType}, ${contentId})`,
      );
    }
  }

  async getRecommendationsForProfile(profileId: number): Promise<ProfileRecommendation[]> {
    try {
      return await communityRecommendationsDb.getRecommendationsForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `getRecommendationsForProfile(${profileId})`);
    }
  }

  async getCommunityRecommendations(contentType?: RatingContentType): Promise<CommunityRecommendation[]> {
    try {
      return await communityRecommendationsDb.getCommunityRecommendations(contentType);
    } catch (error) {
      throw errorService.handleError(error, `getCommunityRecommendations(${contentType})`);
    }
  }

  async getRecommendationDetails(contentType: RatingContentType, contentId: number): Promise<RecommendationDetail[]> {
    try {
      return await communityRecommendationsDb.getRecommendationDetails(contentType, contentId);
    } catch (error) {
      throw errorService.handleError(error, `getRecommendationDetails(${contentType}, ${contentId})`);
    }
  }
}

export const communityRecommendationsService = new CommunityRecommendationsService();

let communityRecommendationsServiceInstance: CommunityRecommendationsService | null = null;

export const createCommunityRecommendationsService = (): CommunityRecommendationsService => {
  communityRecommendationsServiceInstance = new CommunityRecommendationsService();
  return communityRecommendationsServiceInstance;
};

export const resetCommunityRecommendationsService = (): void => {
  communityRecommendationsServiceInstance = null;
};
