import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as ratingsDb from '@db/ratingsDb';
import { DatabaseError, NoAffectedRowsError, NotFoundError } from '@middleware/errorMiddleware';
import { ResultSetHeader } from 'mysql2';

describe('ratingsDb Module', () => {
  let mockExecute: jest.Mock;

  const mockContentRatingRow = {
    id: 1,
    profile_id: 10,
    content_type: 'show',
    content_id: 42,
    content_title: 'Breaking Bad',
    poster_image: '/poster.jpg',
    rating: 5,
    note: 'Amazing!',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  };

  const expectedContentRating = {
    id: 1,
    profileId: 10,
    contentType: 'show',
    contentId: 42,
    contentTitle: 'Breaking Bad',
    posterImage: '/poster.jpg',
    rating: 5,
    note: 'Amazing!',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('upsertRating()', () => {
    it('should insert or update a rating and return the ContentRating', async () => {
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([[mockContentRatingRow]]);

      const result = await ratingsDb.upsertRating(10, 'show', 42, 5, 'Amazing!', 'Breaking Bad', '/poster.jpg');

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expectedContentRating);
    });

    it('should throw NotFoundError when rating is not found after upsert', async () => {
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([[]]); // empty SELECT

      await expect(
        ratingsDb.upsertRating(10, 'show', 42, 5, null, 'Breaking Bad', '/poster.jpg'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle null note and store it correctly', async () => {
      const rowWithNullNote = { ...mockContentRatingRow, note: null };
      const expectedWithNullNote = { ...expectedContentRating, note: null };

      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([[rowWithNullNote]]);

      const result = await ratingsDb.upsertRating(10, 'show', 42, 5, null, 'Breaking Bad', '/poster.jpg');

      expect(result).toEqual(expectedWithNullNote);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(
        ratingsDb.upsertRating(10, 'show', 42, 5, null, 'Breaking Bad', '/poster.jpg'),
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('getRatingsForProfile()', () => {
    it('should return mapped ContentRatings for the given profileId', async () => {
      mockExecute.mockResolvedValue([[mockContentRatingRow]]);

      const result = await ratingsDb.getRatingsForProfile(10);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('profile_id = ?'),
        [10],
      );
      expect(result).toEqual([expectedContentRating]);
    });

    it('should return empty array when profile has no ratings', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await ratingsDb.getRatingsForProfile(99);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(ratingsDb.getRatingsForProfile(10)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getAggregateRatingsForContent()', () => {
    it('should calculate average rating and distribution correctly', async () => {
      mockExecute.mockResolvedValue([
        [
          { rating: 5, cnt: 3 },
          { rating: 4, cnt: 2 },
        ],
      ]);

      const result = await ratingsDb.getAggregateRatingsForContent('show', 42);

      expect(result.contentType).toBe('show');
      expect(result.contentId).toBe(42);
      expect(result.ratingCount).toBe(5);
      expect(result.averageRating).toBe(4.6); // (5*3 + 4*2) / 5 = 23/5 = 4.6
      expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 3 });
    });

    it('should return zero averageRating and empty distribution when no ratings exist', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await ratingsDb.getAggregateRatingsForContent('movie', 10);

      expect(result.averageRating).toBe(0);
      expect(result.ratingCount).toBe(0);
      expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(ratingsDb.getAggregateRatingsForContent('show', 42)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getAllRatings()', () => {
    const mockAdminRatingRow = {
      id: 1,
      profile_id: 10,
      profile_name: 'Alice',
      account_id: 5,
      content_type: 'show',
      content_id: 42,
      content_title: 'Breaking Bad',
      rating: 5,
      note: 'Amazing!',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    };

    const expectedAdminRating = {
      id: 1,
      profileId: 10,
      profileName: 'Alice',
      accountId: 5,
      contentType: 'show',
      contentId: 42,
      contentTitle: 'Breaking Bad',
      rating: 5,
      note: 'Amazing!',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };

    it('should return all ratings with no filters applied', async () => {
      mockExecute.mockResolvedValue([[mockAdminRatingRow]]);

      const result = await ratingsDb.getAllRatings();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([expectedAdminRating]);
    });

    it('should apply contentType filter when provided', async () => {
      mockExecute.mockResolvedValue([[mockAdminRatingRow]]);

      await ratingsDb.getAllRatings({ contentType: 'show' });

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('content_type = ?');
      expect(params).toContain('show');
    });

    it('should apply profileId filter when provided', async () => {
      mockExecute.mockResolvedValue([[mockAdminRatingRow]]);

      await ratingsDb.getAllRatings({ profileId: 10 });

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('profile_id = ?');
      expect(params).toContain(10);
    });

    it('should return empty array when no ratings match filters', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await ratingsDb.getAllRatings({ contentType: 'movie' });

      expect(result).toEqual([]);
    });
  });

  describe('deleteRating()', () => {
    it('should delete a rating belonging to the given profile', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await ratingsDb.deleteRating(10, 1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM profile_content_ratings'),
        [1, 10],
      );
    });

    it('should throw NoAffectedRowsError when rating is not found or does not belong to profile', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(ratingsDb.deleteRating(10, 999)).rejects.toThrow(NoAffectedRowsError);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(ratingsDb.deleteRating(10, 1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('adminDeleteRating()', () => {
    it('should delete a rating by id regardless of profile', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await ratingsDb.adminDeleteRating(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM profile_content_ratings WHERE id = ?'),
        [1],
      );
    });

    it('should throw NoAffectedRowsError when rating is not found', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(ratingsDb.adminDeleteRating(999)).rejects.toThrow(NoAffectedRowsError);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(ratingsDb.adminDeleteRating(1)).rejects.toThrow(DatabaseError);
    });
  });
});
