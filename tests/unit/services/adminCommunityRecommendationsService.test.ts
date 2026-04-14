import {
  AdminRecommendationWithProfile,
  CommunityRecommendation,
  RatingContentType,
} from '@ajgifford/keepwatching-types';
import * as communityRecommendationsDb from '@db/communityRecommendationsDb';
import { AdminCommunityRecommendationsService } from '@services/adminCommunityRecommendationsService';
import { errorService } from '@services/errorService';

jest.mock('@db/communityRecommendationsDb');
jest.mock('@services/errorService');

describe('AdminCommunityRecommendationsService', () => {
  let adminCommunityRecommendationsService: AdminCommunityRecommendationsService;

  const mockRecommendationsWithAttribution: AdminRecommendationWithProfile[] = [
    {
      id: 1,
      profileId: 101,
      profileName: 'Alice',
      accountId: 201,
      contentType: 'show',
      contentId: 10,
      contentTitle: 'Breaking Bad',
      posterImage: '/breaking-bad.jpg',
      rating: 5,
      message: 'You have to watch this!',
      recommendationCount: 42,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      profileId: 102,
      profileName: 'Bob',
      accountId: 202,
      contentType: 'movie',
      contentId: 20,
      contentTitle: 'Inception',
      posterImage: '/inception.jpg',
      rating: null,
      message: 'Mind-bending film',
      recommendationCount: 15,
      createdAt: '2024-02-01T00:00:00.000Z',
    },
  ];

  const mockTopRecommendations: CommunityRecommendation[] = [
    {
      id: 10,
      contentType: 'show',
      contentId: 10,
      contentTitle: 'Breaking Bad',
      posterImage: '/breaking-bad.jpg',
      releaseDate: '2008-01-20',
      genres: 'Drama, Crime',
      averageRating: 4.8,
      ratingCount: 100,
      messageCount: 50,
      recommendationCount: 200,
      createdAt: '2024-01-01T00:00:00.000Z',
      tmdbId: 1,
    },
    {
      id: 20,
      contentType: 'movie',
      contentId: 20,
      contentTitle: 'Inception',
      posterImage: '/inception.jpg',
      releaseDate: '2010-07-16',
      genres: 'Sci-Fi, Thriller',
      averageRating: 4.5,
      ratingCount: 80,
      messageCount: 30,
      recommendationCount: 150,
      createdAt: '2024-02-01T00:00:00.000Z',
      tmdbId: 2,
    },
  ];

  beforeEach(() => {
    adminCommunityRecommendationsService = new AdminCommunityRecommendationsService();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getAllRecommendationsWithAttribution', () => {
    it('should return all recommendations with no filters', async () => {
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockResolvedValue(
        mockRecommendationsWithAttribution,
      );

      const result = await adminCommunityRecommendationsService.getAllRecommendationsWithAttribution();

      expect(result).toEqual(mockRecommendationsWithAttribution);
      expect(communityRecommendationsDb.getAllRecommendationsWithAttribution).toHaveBeenCalledWith(undefined);
    });

    it('should pass contentType filter to db', async () => {
      const filtered = mockRecommendationsWithAttribution.filter((r) => r.contentType === 'show');
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockResolvedValue(filtered);

      const result = await adminCommunityRecommendationsService.getAllRecommendationsWithAttribution({
        contentType: 'show',
      });

      expect(result).toEqual(filtered);
      expect(communityRecommendationsDb.getAllRecommendationsWithAttribution).toHaveBeenCalledWith({
        contentType: 'show',
      });
    });

    it('should pass profileId filter to db', async () => {
      const filtered = [mockRecommendationsWithAttribution[0]];
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockResolvedValue(filtered);

      const result = await adminCommunityRecommendationsService.getAllRecommendationsWithAttribution({
        profileId: 101,
      });

      expect(result).toEqual(filtered);
      expect(communityRecommendationsDb.getAllRecommendationsWithAttribution).toHaveBeenCalledWith({ profileId: 101 });
    });

    it('should pass accountId filter to db', async () => {
      const filtered = [mockRecommendationsWithAttribution[0]];
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockResolvedValue(filtered);

      const result = await adminCommunityRecommendationsService.getAllRecommendationsWithAttribution({
        accountId: 201,
      });

      expect(result).toEqual(filtered);
      expect(communityRecommendationsDb.getAllRecommendationsWithAttribution).toHaveBeenCalledWith({ accountId: 201 });
    });

    it('should pass combined filters to db', async () => {
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockResolvedValue([
        mockRecommendationsWithAttribution[0],
      ]);

      const filters = { contentType: 'show' as RatingContentType, accountId: 201 };
      const result = await adminCommunityRecommendationsService.getAllRecommendationsWithAttribution(filters);

      expect(result).toEqual([mockRecommendationsWithAttribution[0]]);
      expect(communityRecommendationsDb.getAllRecommendationsWithAttribution).toHaveBeenCalledWith(filters);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('Query failed');
      (communityRecommendationsDb.getAllRecommendationsWithAttribution as jest.Mock).mockRejectedValue(dbError);

      const filters = { contentType: 'show' as RatingContentType };
      await expect(adminCommunityRecommendationsService.getAllRecommendationsWithAttribution(filters)).rejects.toThrow(
        dbError,
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getAllRecommendationsWithAttribution(${JSON.stringify(filters)})`,
      );
    });
  });

  describe('getTopRecommendedContent', () => {
    it('should return top recommended content with no args', async () => {
      (communityRecommendationsDb.getTopRecommendedContent as jest.Mock).mockResolvedValue(mockTopRecommendations);

      const result = await adminCommunityRecommendationsService.getTopRecommendedContent();

      expect(result).toEqual(mockTopRecommendations);
      expect(communityRecommendationsDb.getTopRecommendedContent).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should pass contentType to db', async () => {
      const filtered = mockTopRecommendations.filter((r) => r.contentType === 'show');
      (communityRecommendationsDb.getTopRecommendedContent as jest.Mock).mockResolvedValue(filtered);

      const result = await adminCommunityRecommendationsService.getTopRecommendedContent('show');

      expect(result).toEqual(filtered);
      expect(communityRecommendationsDb.getTopRecommendedContent).toHaveBeenCalledWith('show', undefined);
    });

    it('should pass contentType and limit to db', async () => {
      const limited = [mockTopRecommendations[0]];
      (communityRecommendationsDb.getTopRecommendedContent as jest.Mock).mockResolvedValue(limited);

      const result = await adminCommunityRecommendationsService.getTopRecommendedContent('show', 1);

      expect(result).toEqual(limited);
      expect(communityRecommendationsDb.getTopRecommendedContent).toHaveBeenCalledWith('show', 1);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('DB error');
      (communityRecommendationsDb.getTopRecommendedContent as jest.Mock).mockRejectedValue(dbError);

      await expect(adminCommunityRecommendationsService.getTopRecommendedContent('movie', 10)).rejects.toThrow(dbError);

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getTopRecommendedContent(movie, 10)');
    });
  });

  describe('adminDeleteRecommendation', () => {
    it('should delete a recommendation by id', async () => {
      (communityRecommendationsDb.adminDeleteRecommendation as jest.Mock).mockResolvedValue(undefined);

      await adminCommunityRecommendationsService.adminDeleteRecommendation(1);

      expect(communityRecommendationsDb.adminDeleteRecommendation).toHaveBeenCalledWith(1);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('Delete failed');
      (communityRecommendationsDb.adminDeleteRecommendation as jest.Mock).mockRejectedValue(dbError);

      await expect(adminCommunityRecommendationsService.adminDeleteRecommendation(1)).rejects.toThrow(dbError);

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'adminDeleteRecommendation(1)');
    });
  });
});
