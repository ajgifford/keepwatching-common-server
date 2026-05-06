import { AdminContentRatingSummary, AdminRatingWithProfile, RatingContentType } from '@ajgifford/keepwatching-types';
import * as ratingsDb from '@db/ratingsDb';
import { AdminRatingsService } from '@services/adminRatingsService';
import { errorService } from '@services/errorService';

jest.mock('@db/ratingsDb');
jest.mock('@services/errorService');

describe('AdminRatingsService', () => {
  let adminRatingsService: AdminRatingsService;

  const mockContentType: RatingContentType = 'show';
  const mockContentId = 42;

  const mockAggregateSummary: AdminContentRatingSummary = {
    contentType: mockContentType,
    contentId: mockContentId,
    averageRating: 4.2,
    ratingCount: 10,
    distribution: { 1: 0, 2: 1, 3: 2, 4: 4, 5: 3 },
  };

  const mockRatings: AdminRatingWithProfile[] = [
    {
      id: 1,
      profileId: 101,
      profileName: 'Alice',
      accountId: 201,
      contentType: 'show',
      contentId: 10,
      contentTitle: 'Breaking Bad',
      rating: 5,
      note: 'Masterpiece',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 2,
      profileId: 102,
      profileName: 'Bob',
      accountId: 202,
      contentType: 'movie',
      contentId: 20,
      contentTitle: 'Inception',
      rating: 4,
      note: 'Great film',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    adminRatingsService = new AdminRatingsService();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getAggregateRatingsForContent', () => {
    it('should return aggregate ratings for the given content', async () => {
      (ratingsDb.getAggregateRatingsForContent as jest.Mock).mockResolvedValue(mockAggregateSummary);

      const result = await adminRatingsService.getAggregateRatingsForContent(mockContentType, mockContentId);

      expect(result).toEqual(mockAggregateSummary);
      expect(ratingsDb.getAggregateRatingsForContent).toHaveBeenCalledWith(mockContentType, mockContentId);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('DB connection failed');
      (ratingsDb.getAggregateRatingsForContent as jest.Mock).mockRejectedValue(dbError);

      await expect(adminRatingsService.getAggregateRatingsForContent(mockContentType, mockContentId)).rejects.toThrow(
        dbError,
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getAggregateRatingsForContent(${mockContentType}, ${mockContentId})`,
      );
    });
  });

  describe('getAllRatings', () => {
    it('should return all ratings with no filters', async () => {
      (ratingsDb.getAllRatings as jest.Mock).mockResolvedValue(mockRatings);

      const result = await adminRatingsService.getAllRatings();

      expect(result).toEqual(mockRatings);
      expect(ratingsDb.getAllRatings).toHaveBeenCalledWith(undefined);
    });

    it('should pass contentType filter to db', async () => {
      const filtered = mockRatings.filter((r) => r.contentType === 'show');
      (ratingsDb.getAllRatings as jest.Mock).mockResolvedValue(filtered);

      const result = await adminRatingsService.getAllRatings({ contentType: 'show' });

      expect(result).toEqual(filtered);
      expect(ratingsDb.getAllRatings).toHaveBeenCalledWith({ contentType: 'show' });
    });

    it('should pass profileId filter to db', async () => {
      const filtered = [mockRatings[0]];
      (ratingsDb.getAllRatings as jest.Mock).mockResolvedValue(filtered);

      const result = await adminRatingsService.getAllRatings({ profileId: 101 });

      expect(result).toEqual(filtered);
      expect(ratingsDb.getAllRatings).toHaveBeenCalledWith({ profileId: 101 });
    });

    it('should pass accountId filter to db', async () => {
      const filtered = [mockRatings[0]];
      (ratingsDb.getAllRatings as jest.Mock).mockResolvedValue(filtered);

      const result = await adminRatingsService.getAllRatings({ accountId: 201 });

      expect(result).toEqual(filtered);
      expect(ratingsDb.getAllRatings).toHaveBeenCalledWith({ accountId: 201 });
    });

    it('should pass combined filters to db', async () => {
      (ratingsDb.getAllRatings as jest.Mock).mockResolvedValue([mockRatings[0]]);

      const filters = { contentType: 'show' as RatingContentType, accountId: 201 };
      const result = await adminRatingsService.getAllRatings(filters);

      expect(result).toEqual([mockRatings[0]]);
      expect(ratingsDb.getAllRatings).toHaveBeenCalledWith(filters);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('Query failed');
      (ratingsDb.getAllRatings as jest.Mock).mockRejectedValue(dbError);

      const filters = { contentType: 'show' as RatingContentType };
      await expect(adminRatingsService.getAllRatings(filters)).rejects.toThrow(dbError);

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `getAllRatings(${JSON.stringify(filters)})`);
    });
  });

  describe('adminDeleteRating', () => {
    it('should delete a rating by id', async () => {
      (ratingsDb.adminDeleteRating as jest.Mock).mockResolvedValue(undefined);

      await adminRatingsService.adminDeleteRating(1);

      expect(ratingsDb.adminDeleteRating).toHaveBeenCalledWith(1);
    });

    it('should handle errors and rethrow via errorService', async () => {
      const dbError = new Error('Delete failed');
      (ratingsDb.adminDeleteRating as jest.Mock).mockRejectedValue(dbError);

      await expect(adminRatingsService.adminDeleteRating(1)).rejects.toThrow(dbError);

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'adminDeleteRating(1)');
    });
  });
});
