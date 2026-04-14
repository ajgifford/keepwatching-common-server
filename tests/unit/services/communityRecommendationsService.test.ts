import * as communityRecommendationsDb from '@db/communityRecommendationsDb';
import { CommunityRecommendationsService } from '@services/communityRecommendationsService';

jest.mock('@db/communityRecommendationsDb');

describe('communityRecommendationsService', () => {
  let service: CommunityRecommendationsService;

  const mockProfileRecommendation = {
    id: 1,
    profileId: 10,
    contentType: 'show' as const,
    contentId: 42,
    rating: 5,
    message: 'You must watch this!',
    createdAt: '2026-04-01T00:00:00.000Z',
  };

  const mockCommunityRecommendation = {
    id: 1,
    contentType: 'show' as const,
    contentId: 42,
    contentTitle: 'Breaking Bad',
    posterImage: '/poster.jpg',
    releaseDate: '2008-01-20',
    genres: 'Drama, Crime',
    rating: 5,
    message: 'You must watch this!',
    recommendationCount: 3,
    createdAt: '2026-04-01T00:00:00.000Z',
  };

  const mockMovieCommunityRecommendation = {
    ...mockCommunityRecommendation,
    id: 2,
    contentType: 'movie' as const,
    contentId: 99,
    contentTitle: 'Inception',
    recommendationCount: 1,
  };

  beforeEach(() => {
    service = new CommunityRecommendationsService();
    jest.clearAllMocks();
  });

  describe('addRecommendation', () => {
    it('should insert a recommendation and return ProfileRecommendation', async () => {
      (communityRecommendationsDb.addRecommendation as jest.Mock).mockResolvedValue(mockProfileRecommendation);

      const result = await service.addRecommendation(10, 'show', 42, 5, 'You must watch this!');

      expect(communityRecommendationsDb.addRecommendation).toHaveBeenCalledWith(10, 'show', 42, 5, 'You must watch this!');
      expect(result).toEqual(mockProfileRecommendation);
    });

    it('should propagate conflict errors on duplicate recommendation', async () => {
      (communityRecommendationsDb.addRecommendation as jest.Mock).mockRejectedValue(
        new Error('Already recommended'),
      );

      await expect(service.addRecommendation(10, 'show', 42, null, null)).rejects.toThrow();
    });
  });

  describe('removeRecommendation', () => {
    it('should call removeRecommendation with correct params', async () => {
      (communityRecommendationsDb.removeRecommendation as jest.Mock).mockResolvedValue(undefined);

      await service.removeRecommendation(10, 'show', 42);

      expect(communityRecommendationsDb.removeRecommendation).toHaveBeenCalledWith(10, 'show', 42);
    });

    it('should propagate errors on missing recommendation', async () => {
      (communityRecommendationsDb.removeRecommendation as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(service.removeRecommendation(10, 'show', 999)).rejects.toThrow();
    });
  });

  describe('getRecommendationsForProfile', () => {
    it('should return only records for the given profileId', async () => {
      (communityRecommendationsDb.getRecommendationsForProfile as jest.Mock).mockResolvedValue([
        mockProfileRecommendation,
      ]);

      const result = await service.getRecommendationsForProfile(10);

      expect(communityRecommendationsDb.getRecommendationsForProfile).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockProfileRecommendation]);
      expect(result[0].profileId).toBe(10);
    });

    it('should return empty array when profile has no recommendations', async () => {
      (communityRecommendationsDb.getRecommendationsForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getRecommendationsForProfile(99);
      expect(result).toEqual([]);
    });
  });

  describe('getRecommendationDetails', () => {
    it('should return recommendation details for a given content', async () => {
      const mockDetails = [
        {
          profileName: 'Alice',
          rating: 5,
          message: 'Amazing show!',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          profileName: 'Bob',
          rating: null,
          message: null,
          createdAt: '2026-04-02T00:00:00.000Z',
        },
      ];
      (communityRecommendationsDb.getRecommendationDetails as jest.Mock).mockResolvedValue(mockDetails);

      const result = await service.getRecommendationDetails('show', 42);

      expect(communityRecommendationsDb.getRecommendationDetails).toHaveBeenCalledWith('show', 42);
      expect(result).toEqual(mockDetails);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no recommendations exist for content', async () => {
      (communityRecommendationsDb.getRecommendationDetails as jest.Mock).mockResolvedValue([]);

      const result = await service.getRecommendationDetails('movie', 99);

      expect(communityRecommendationsDb.getRecommendationDetails).toHaveBeenCalledWith('movie', 99);
      expect(result).toEqual([]);
    });

    it('should propagate errors from the DB layer', async () => {
      (communityRecommendationsDb.getRecommendationDetails as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.getRecommendationDetails('show', 42)).rejects.toThrow();
    });
  });

  describe('getCommunityRecommendations', () => {
    it('should return aggregated anonymized results with no filter', async () => {
      const mockResults = [mockCommunityRecommendation, mockMovieCommunityRecommendation];
      (communityRecommendationsDb.getCommunityRecommendations as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.getCommunityRecommendations();

      expect(communityRecommendationsDb.getCommunityRecommendations).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(2);
    });

    it('should pass contentType=show to the DB and return only shows', async () => {
      (communityRecommendationsDb.getCommunityRecommendations as jest.Mock).mockResolvedValue([
        mockCommunityRecommendation,
      ]);

      const result = await service.getCommunityRecommendations('show');

      expect(communityRecommendationsDb.getCommunityRecommendations).toHaveBeenCalledWith('show');
      expect(result).toHaveLength(1);
      expect(result[0].contentType).toBe('show');
    });

    it('should pass contentType=movie to the DB and return only movies', async () => {
      (communityRecommendationsDb.getCommunityRecommendations as jest.Mock).mockResolvedValue([
        mockMovieCommunityRecommendation,
      ]);

      const result = await service.getCommunityRecommendations('movie');

      expect(communityRecommendationsDb.getCommunityRecommendations).toHaveBeenCalledWith('movie');
      expect(result[0].contentType).toBe('movie');
    });

    it('should not include profile attribution in returned data', async () => {
      (communityRecommendationsDb.getCommunityRecommendations as jest.Mock).mockResolvedValue([
        mockCommunityRecommendation,
      ]);

      const result = await service.getCommunityRecommendations();

      result.forEach((rec) => {
        expect(rec).not.toHaveProperty('profileId');
        expect(rec).not.toHaveProperty('profileName');
      });
    });
  });
});
