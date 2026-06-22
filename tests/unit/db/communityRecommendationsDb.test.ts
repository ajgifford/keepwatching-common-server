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

  describe('getAllRecommendationsWithAttribution()', () => {
    const mockAdminRow = {
      id: 1,
      profile_id: 10,
      profile_name: 'Alice',
      account_id: 5,
      content_type: 'show',
      content_id: 42,
      content_title: 'Breaking Bad',
      poster_image: '/poster.jpg',
      rating: 5,
      message: 'Must watch!',
      recommendation_count: 3,
      created_at: '2026-04-01T00:00:00.000Z',
    };

    const expectedAdminResult = {
      id: 1,
      profileId: 10,
      profileName: 'Alice',
      accountId: 5,
      contentType: 'show',
      contentId: 42,
      contentTitle: 'Breaking Bad',
      posterImage: '/poster.jpg',
      rating: 5,
      message: 'Must watch!',
      recommendationCount: 3,
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    it('should return all recommendations with attribution when no filters are provided', async () => {
      mockExecute.mockResolvedValue([[mockAdminRow]]);

      const result = await communityRecommendationsDb.getAllRecommendationsWithAttribution();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain('UNION ALL');
      expect(result).toEqual([expectedAdminResult]);
    });

    it('should filter by contentType show and run show-only query', async () => {
      mockExecute.mockResolvedValue([[mockAdminRow]]);

      const result = await communityRecommendationsDb.getAllRecommendationsWithAttribution({ contentType: 'show' });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql] = mockExecute.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(sql).toContain("content_type = 'show'");
      expect(result).toEqual([expectedAdminResult]);
    });

    it('should filter by contentType movie and run movie-only query', async () => {
      const movieRow = { ...mockAdminRow, content_type: 'movie', content_id: 99, content_title: 'Inception' };
      const expectedMovie = { ...expectedAdminResult, contentType: 'movie', contentId: 99, contentTitle: 'Inception' };
      mockExecute.mockResolvedValue([[movieRow]]);

      const result = await communityRecommendationsDb.getAllRecommendationsWithAttribution({ contentType: 'movie' });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql] = mockExecute.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(sql).toContain("content_type = 'movie'");
      expect(result).toEqual([expectedMovie]);
    });

    it('should wrap query in subquery when filtering by profileId', async () => {
      mockExecute.mockResolvedValue([[mockAdminRow]]);

      await communityRecommendationsDb.getAllRecommendationsWithAttribution({ profileId: 10 });

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT * FROM (');
      expect(sql).toContain('t.profile_id = ?');
      expect(params).toContain(10);
    });

    it('should wrap query in subquery when filtering by accountId', async () => {
      mockExecute.mockResolvedValue([[mockAdminRow]]);

      await communityRecommendationsDb.getAllRecommendationsWithAttribution({ accountId: 5 });

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT * FROM (');
      expect(sql).toContain('t.account_id = ?');
      expect(params).toContain(5);
    });

    it('should apply both profileId and accountId conditions in the subquery', async () => {
      mockExecute.mockResolvedValue([[mockAdminRow]]);

      await communityRecommendationsDb.getAllRecommendationsWithAttribution({ profileId: 10, accountId: 5 });

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('t.profile_id = ?');
      expect(sql).toContain('t.account_id = ?');
      expect(params).toEqual(expect.arrayContaining([10, 5]));
    });

    it('should return empty array when no recommendations exist', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await communityRecommendationsDb.getAllRecommendationsWithAttribution();

      expect(result).toEqual([]);
    });

    it('should correctly map recommendationCount as a number', async () => {
      const rowWithStringCount = { ...mockAdminRow, recommendation_count: '7' };
      mockExecute.mockResolvedValue([[rowWithStringCount]]);

      const result = await communityRecommendationsDb.getAllRecommendationsWithAttribution();

      expect(result[0].recommendationCount).toBe(7);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.getAllRecommendationsWithAttribution()).rejects.toThrow(DatabaseError);
    });
  });

  describe('getTopRecommendedContent()', () => {
    const mockTopRow = {
      id: 1,
      content_type: 'show',
      content_id: 42,
      tmdb_id: 1396,
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

    const expectedTop = {
      id: 1,
      contentType: 'show',
      contentId: 42,
      tmdbId: 1396,
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

    it('should return top content for both types with default limit when no filter provided', async () => {
      mockExecute.mockResolvedValue([[mockTopRow]]);

      const result = await communityRecommendationsDb.getTopRecommendedContent();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UNION ALL');
      expect(params).toEqual([10]);
      expect(result).toEqual([expectedTop]);
    });

    it('should run show-only query when contentType is show', async () => {
      mockExecute.mockResolvedValue([[mockTopRow]]);

      const result = await communityRecommendationsDb.getTopRecommendedContent('show');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(sql).toContain("content_type = 'show'");
      expect(params).toEqual([10]);
      expect(result[0].contentType).toBe('show');
    });

    it('should run movie-only query when contentType is movie', async () => {
      const movieRow = { ...mockTopRow, content_type: 'movie', content_id: 99 };
      mockExecute.mockResolvedValue([[movieRow]]);

      const result = await communityRecommendationsDb.getTopRecommendedContent('movie');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(sql).toContain("content_type = 'movie'");
      expect(params).toEqual([10]);
      expect(result[0].contentType).toBe('movie');
    });

    it('should respect a custom limit', async () => {
      mockExecute.mockResolvedValue([[mockTopRow]]);

      await communityRecommendationsDb.getTopRecommendedContent(undefined, 5);

      const [, params] = mockExecute.mock.calls[0];
      expect(params).toEqual([5]);
    });

    it('should return empty array when no top content exists', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await communityRecommendationsDb.getTopRecommendedContent();

      expect(result).toEqual([]);
    });

    it('should handle null averageRating in top content', async () => {
      const rowWithNullRating = { ...mockTopRow, average_rating: null, rating_count: 0 };
      mockExecute.mockResolvedValue([[rowWithNullRating]]);

      const result = await communityRecommendationsDb.getTopRecommendedContent();

      expect(result[0].averageRating).toBeNull();
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(communityRecommendationsDb.getTopRecommendedContent()).rejects.toThrow(DatabaseError);
    });
  });
});
