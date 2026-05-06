import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as communityRecommendationsDb from '@db/communityRecommendationsDb';
import { ConflictError, DatabaseError, NoAffectedRowsError } from '@middleware/errorMiddleware';
import { ResultSetHeader } from 'mysql2';

describe('communityRecommendationsDb Module', () => {
  let mockExecute: jest.Mock;

  const mockProfileRecommendationRow = {
    id: 1,
    profile_id: 10,
    content_type: 'show',
    content_id: 42,
    rating: 5,
    message: 'You must watch this!',
    created_at: '2026-04-01T00:00:00.000Z',
  };

  const expectedProfileRecommendation = {
    id: 1,
    profileId: 10,
    contentType: 'show',
    contentId: 42,
    rating: 5,
    message: 'You must watch this!',
    createdAt: '2026-04-01T00:00:00.000Z',
  };

  const mockCommunityRecommendationRow = {
    id: 1,
    content_type: 'show',
    content_id: 42,
    content_title: 'Breaking Bad',
    poster_image: '/poster.jpg',
    release_date: '2008-01-20',
    genres: 'Drama, Crime',
    average_rating: 4.5,
    rating_count: 3,
    message_count: 2,
    recommendation_count: 5,
    created_at: '2026-04-01T00:00:00.000Z',
  };

  const expectedCommunityRecommendation = {
    id: 1,
    contentType: 'show',
    contentId: 42,
    contentTitle: 'Breaking Bad',
    posterImage: '/poster.jpg',
    releaseDate: '2008-01-20',
    genres: 'Drama, Crime',
    averageRating: 4.5,
    ratingCount: 3,
    messageCount: 2,
    recommendationCount: 5,
    createdAt: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('addRecommendation()', () => {
    it('should insert and return a ProfileRecommendation when no duplicate exists', async () => {
      mockExecute
        .mockResolvedValueOnce([[]]) // SELECT existing: empty
        .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 } as ResultSetHeader]) // INSERT
        .mockResolvedValueOnce([[mockProfileRecommendationRow]]); // SELECT by insertId

      const result = await communityRecommendationsDb.addRecommendation(10, 'show', 42, 5, 'You must watch this!');

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(result).toEqual(expectedProfileRecommendation);
    });

    it('should throw ConflictError when profile has already recommended this content', async () => {
      mockExecute.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT finds existing record

      await expect(communityRecommendationsDb.addRecommendation(10, 'show', 42, 5, 'msg')).rejects.toThrow(
        ConflictError,
      );

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should store null rating and message when omitted', async () => {
      const rowWithNulls = { ...mockProfileRecommendationRow, rating: null, message: null };
      const expectedWithNulls = { ...expectedProfileRecommendation, rating: null, message: null };

      mockExecute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([[rowWithNulls]]);

      const result = await communityRecommendationsDb.addRecommendation(10, 'show', 42, null, null);

      expect(result).toEqual(expectedWithNulls);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.addRecommendation(10, 'show', 42, 5, 'msg')).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  describe('removeRecommendation()', () => {
    it('should delete the recommendation for the given profile and content', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await communityRecommendationsDb.removeRecommendation(10, 'show', 42);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM profile_recommendations'), [
        10,
        'show',
        42,
      ]);
    });

    it('should throw NoAffectedRowsError when recommendation does not exist', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(communityRecommendationsDb.removeRecommendation(10, 'show', 999)).rejects.toThrow(
        NoAffectedRowsError,
      );
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.removeRecommendation(10, 'show', 42)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getRecommendationsForProfile()', () => {
    it('should return mapped ProfileRecommendations for the given profileId', async () => {
      mockExecute.mockResolvedValue([[mockProfileRecommendationRow]]);

      const result = await communityRecommendationsDb.getRecommendationsForProfile(10);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('profile_id = ?'), [10]);
      expect(result).toEqual([expectedProfileRecommendation]);
    });

    it('should return empty array when profile has no recommendations', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await communityRecommendationsDb.getRecommendationsForProfile(99);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.getRecommendationsForProfile(10)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getRecommendationDetails()', () => {
    const mockDetailRow = {
      profile_name: 'Alice',
      rating: 5,
      message: 'Must watch!',
      created_at: '2026-04-01T00:00:00.000Z',
    };

    const expectedDetail = {
      profileName: 'Alice',
      rating: 5,
      message: 'Must watch!',
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    it('should return mapped RecommendationDetails for the given content', async () => {
      mockExecute.mockResolvedValue([[mockDetailRow]]);

      const result = await communityRecommendationsDb.getRecommendationDetails('show', 42);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('content_type = ?'), ['show', 42]);
      expect(result).toEqual([expectedDetail]);
    });

    it('should return details including null rating and message', async () => {
      const rowWithNulls = { ...mockDetailRow, rating: null, message: null };
      const expectedWithNulls = { ...expectedDetail, rating: null, message: null };

      mockExecute.mockResolvedValue([[rowWithNulls]]);

      const result = await communityRecommendationsDb.getRecommendationDetails('show', 42);

      expect(result).toEqual([expectedWithNulls]);
    });

    it('should return empty array when no recommendations exist for content', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await communityRecommendationsDb.getRecommendationDetails('movie', 99);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.getRecommendationDetails('show', 42)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getCommunityRecommendations()', () => {
    it('should return mapped CommunityRecommendations with no filter', async () => {
      mockExecute.mockResolvedValue([[mockCommunityRecommendationRow]]);

      const result = await communityRecommendationsDb.getCommunityRecommendations();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([expectedCommunityRecommendation]);
    });

    it('should pass show filter and return only show recommendations', async () => {
      mockExecute.mockResolvedValue([[mockCommunityRecommendationRow]]);

      const result = await communityRecommendationsDb.getCommunityRecommendations('show');

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain("content_type = 'show'");
      expect(result[0].contentType).toBe('show');
    });

    it('should pass movie filter and return only movie recommendations', async () => {
      const movieRow = { ...mockCommunityRecommendationRow, id: 2, content_type: 'movie', content_id: 99 };
      mockExecute.mockResolvedValue([[movieRow]]);

      const result = await communityRecommendationsDb.getCommunityRecommendations('movie');

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain("content_type = 'movie'");
      expect(result[0].contentType).toBe('movie');
    });

    it('should handle null averageRating correctly', async () => {
      const rowWithNullRating = { ...mockCommunityRecommendationRow, average_rating: null, rating_count: 0 };
      mockExecute.mockResolvedValue([[rowWithNullRating]]);

      const result = await communityRecommendationsDb.getCommunityRecommendations();

      expect(result[0].averageRating).toBeNull();
    });

    it('should return empty array when no recommendations exist', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await communityRecommendationsDb.getCommunityRecommendations();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.getCommunityRecommendations()).rejects.toThrow(DatabaseError);
    });
  });

  describe('adminDeleteRecommendation()', () => {
    it('should delete a recommendation by id', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await communityRecommendationsDb.adminDeleteRecommendation(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM profile_recommendations WHERE id = ?'),
        [1],
      );
    });

    it('should throw NoAffectedRowsError when recommendation is not found', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(communityRecommendationsDb.adminDeleteRecommendation(999)).rejects.toThrow(NoAffectedRowsError);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.adminDeleteRecommendation(1)).rejects.toThrow(DatabaseError);
    });
  });
});
