import * as ratingsDb from '@db/ratingsDb';
import { RatingsService } from '@services/ratingsService';

jest.mock('@db/ratingsDb');

describe('ratingsService', () => {
  let service: RatingsService;

  const mockRating = {
    id: 1,
    profileId: 10,
    contentType: 'show' as const,
    contentId: 42,
    contentTitle: 'Breaking Bad',
    posterImage: '/poster.jpg',
    rating: 5,
    note: 'Amazing!',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(() => {
    service = new RatingsService();
    jest.clearAllMocks();
  });

  describe('upsertRating', () => {
    it('should call ratingsDb.upsertRating with correct params and return ContentRating', async () => {
      (ratingsDb.upsertRating as jest.Mock).mockResolvedValue(mockRating);

      const result = await service.upsertRating(10, 'show', 42, 5, 'Amazing!', 'Breaking Bad', '/poster.jpg');

      expect(ratingsDb.upsertRating).toHaveBeenCalledWith(10, 'show', 42, 5, 'Amazing!', 'Breaking Bad', '/poster.jpg');
      expect(result).toEqual(mockRating);
    });

    it('should propagate errors from the DB layer', async () => {
      const error = new Error('DB error');
      (ratingsDb.upsertRating as jest.Mock).mockRejectedValue(error);

      await expect(service.upsertRating(10, 'show', 42, 5, null, 'Breaking Bad', '/poster.jpg')).rejects.toThrow();
    });
  });

  describe('getRatingsForProfile', () => {
    it('should return array of ContentRatings for the given profileId', async () => {
      (ratingsDb.getRatingsForProfile as jest.Mock).mockResolvedValue([mockRating]);

      const result = await service.getRatingsForProfile(10);

      expect(ratingsDb.getRatingsForProfile).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockRating]);
    });

    it('should return empty array when no ratings exist', async () => {
      (ratingsDb.getRatingsForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getRatingsForProfile(99);

      expect(result).toEqual([]);
    });

    it('should propagate errors from the DB layer', async () => {
      (ratingsDb.getRatingsForProfile as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.getRatingsForProfile(10)).rejects.toThrow();
    });
  });

  describe('deleteRating', () => {
    it('should call ratingsDb.deleteRating with correct profileId and ratingId', async () => {
      (ratingsDb.deleteRating as jest.Mock).mockResolvedValue(undefined);

      await service.deleteRating(10, 1);

      expect(ratingsDb.deleteRating).toHaveBeenCalledWith(10, 1);
    });

    it('should propagate errors when rating is not found', async () => {
      (ratingsDb.deleteRating as jest.Mock).mockRejectedValue(new Error('Rating not found'));

      await expect(service.deleteRating(10, 999)).rejects.toThrow();
    });
  });
});
