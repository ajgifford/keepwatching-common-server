import { setupDatabaseTest } from '../helpers/dbTestSetup';
import * as digestShowRepository from '@db/shows/digestShowRepository';

describe('digestShowRepository', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('getTrendingShows', () => {
    const mockTrendingShows = [
      {
        id: 1,
        title: 'Breaking Bad',
        tmdb_id: 1396,
      },
      {
        id: 2,
        title: 'Game of Thrones',
        tmdb_id: 1399,
      },
      {
        id: 3,
        title: 'The Office',
        tmdb_id: 2316,
      },
    ];

    it('should return trending shows with default limit', async () => {
      mockExecute.mockResolvedValue([mockTrendingShows]);

      const result = await digestShowRepository.getTrendingShows();

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT s.id, s.title, s.tmdb_id'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM shows s'));
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('JOIN show_watch_status sws ON s.id = sws.show_id'),
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE sws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
      );
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('GROUP BY s.id, s.title, s.tmdb_id'));
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY COUNT(sws.profile_id) DESC, s.user_rating DESC'),
      );
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 10'));

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 1,
        title: 'Breaking Bad',
        tmdbId: 1396,
      });
      expect(result[1]).toEqual({
        id: 2,
        title: 'Game of Thrones',
        tmdbId: 1399,
      });
      expect(result[2]).toEqual({
        id: 3,
        title: 'The Office',
        tmdbId: 2316,
      });
    });

    it('should return trending shows with custom limit', async () => {
      const limitedShows = mockTrendingShows.slice(0, 2);
      mockExecute.mockResolvedValue([limitedShows]);

      const result = await digestShowRepository.getTrendingShows(2);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 2'));
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Breaking Bad');
      expect(result[1].title).toBe('Game of Thrones');
    });

    it('should return empty array when no trending shows found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestShowRepository.getTrendingShows();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Connection timeout');
      mockExecute.mockRejectedValue(dbError);

      await expect(digestShowRepository.getTrendingShows()).rejects.toThrow(
        'Database error getting trending shows: Connection timeout',
      );
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should use correct SQL query structure for trending shows', async () => {
      mockExecute.mockResolvedValue([mockTrendingShows]);

      await digestShowRepository.getTrendingShows(5);

      const [query] = mockExecute.mock.calls[0];
      expect(query).toMatch(/SELECT s\.id, s\.title, s\.tmdb_id/);
      expect(query).toMatch(/FROM shows s/);
      expect(query).toMatch(/JOIN show_watch_status sws ON s\.id = sws\.show_id/);
      expect(query).toMatch(/WHERE sws\.created_at >= DATE_SUB\(NOW\(\), INTERVAL 30 DAY\)/);
      expect(query).toMatch(/GROUP BY s\.id, s\.title, s\.tmdb_id/);
      expect(query).toMatch(/ORDER BY COUNT\(sws\.profile_id\) DESC, s\.user_rating DESC/);
      expect(query).toMatch(/LIMIT 5/);
    });
  });

  describe('getNewlyAddedShows', () => {
    const mockNewShows = [
      {
        id: 10,
        title: 'House of the Dragon',
        tmdb_id: 94997,
      },
      {
        id: 11,
        title: 'The Bear',
        tmdb_id: 136315,
      },
      {
        id: 12,
        title: 'Wednesday',
        tmdb_id: 119051,
      },
    ];

    it('should return newly added shows with default limit', async () => {
      mockExecute.mockResolvedValue([mockNewShows]);

      const result = await digestShowRepository.getNewlyAddedShows();

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title, tmdb_id'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM shows'));
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
      );
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC, user_rating DESC'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 10'));

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 10,
        title: 'House of the Dragon',
        tmdbId: 94997,
      });
      expect(result[1]).toEqual({
        id: 11,
        title: 'The Bear',
        tmdbId: 136315,
      });
      expect(result[2]).toEqual({
        id: 12,
        title: 'Wednesday',
        tmdbId: 119051,
      });
    });

    it('should return newly added shows with custom limit', async () => {
      const limitedShows = mockNewShows.slice(0, 1);
      mockExecute.mockResolvedValue([limitedShows]);

      const result = await digestShowRepository.getNewlyAddedShows(1);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1'));
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('House of the Dragon');
    });

    it('should return empty array when no newly added shows found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestShowRepository.getNewlyAddedShows();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query execution failed');
      mockExecute.mockRejectedValue(dbError);

      await expect(digestShowRepository.getNewlyAddedShows()).rejects.toThrow(
        'Database error getting newly added shows: Query execution failed',
      );
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should use correct SQL query structure for newly added shows', async () => {
      mockExecute.mockResolvedValue([mockNewShows]);

      await digestShowRepository.getNewlyAddedShows(7);

      const [query] = mockExecute.mock.calls[0];
      expect(query).toMatch(/SELECT id, title, tmdb_id/);
      expect(query).toMatch(/FROM shows/);
      expect(query).toMatch(/WHERE created_at >= DATE_SUB\(NOW\(\), INTERVAL 30 DAY\)/);
      expect(query).toMatch(/ORDER BY created_at DESC, user_rating DESC/);
      expect(query).toMatch(/LIMIT 7/);
    });
  });

  describe('getTopRatedShows', () => {
    const mockTopRatedShows = [
      {
        id: 20,
        title: 'Breaking Bad',
        tmdb_id: 1396,
      },
      {
        id: 21,
        title: 'The Sopranos',
        tmdb_id: 1398,
      },
      {
        id: 22,
        title: 'The Wire',
        tmdb_id: 1408,
      },
    ];

    it('should return top rated shows with default limit', async () => {
      mockExecute.mockResolvedValue([mockTopRatedShows]);

      const result = await digestShowRepository.getTopRatedShows();

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title, tmdb_id'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM shows'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE user_rating >= 7.0'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY user_rating DESC, created_at DESC'));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 10'));

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 20,
        title: 'Breaking Bad',
        tmdbId: 1396,
      });
      expect(result[1]).toEqual({
        id: 21,
        title: 'The Sopranos',
        tmdbId: 1398,
      });
      expect(result[2]).toEqual({
        id: 22,
        title: 'The Wire',
        tmdbId: 1408,
      });
    });

    it('should return top rated shows with custom limit', async () => {
      const limitedShows = mockTopRatedShows.slice(0, 2);
      mockExecute.mockResolvedValue([limitedShows]);

      const result = await digestShowRepository.getTopRatedShows(2);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 2'));
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Breaking Bad');
      expect(result[1].title).toBe('The Sopranos');
    });

    it('should return empty array when no top rated shows found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestShowRepository.getTopRatedShows();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database unavailable');
      mockExecute.mockRejectedValue(dbError);

      await expect(digestShowRepository.getTopRatedShows()).rejects.toThrow(
        'Database error getting top rated shows: Database unavailable',
      );
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should use correct SQL query structure for top rated shows', async () => {
      mockExecute.mockResolvedValue([mockTopRatedShows]);

      await digestShowRepository.getTopRatedShows(15);

      const [query] = mockExecute.mock.calls[0];
      expect(query).toMatch(/SELECT id, title, tmdb_id/);
      expect(query).toMatch(/FROM shows/);
      expect(query).toMatch(/WHERE user_rating >= 7\.0/);
      expect(query).toMatch(/ORDER BY user_rating DESC, created_at DESC/);
      expect(query).toMatch(/LIMIT 15/);
    });
  });

  describe('Integration tests', () => {
    it('should handle multiple function calls with different results', async () => {
      const trendingShows = [{ id: 1, title: 'Trending Show', tmdb_id: 1001 }];
      const newShows = [{ id: 2, title: 'New Show', tmdb_id: 1002 }];
      const topRatedShows = [{ id: 3, title: 'Top Rated Show', tmdb_id: 1003 }];

      mockExecute
        .mockResolvedValueOnce([trendingShows])
        .mockResolvedValueOnce([newShows])
        .mockResolvedValueOnce([topRatedShows]);

      const [trending, newlyAdded, topRated] = await Promise.all([
        digestShowRepository.getTrendingShows(1),
        digestShowRepository.getNewlyAddedShows(1),
        digestShowRepository.getTopRatedShows(1),
      ]);

      expect(trending).toHaveLength(1);
      expect(trending[0].title).toBe('Trending Show');
      expect(newlyAdded).toHaveLength(1);
      expect(newlyAdded[0].title).toBe('New Show');
      expect(topRated).toHaveLength(1);
      expect(topRated[0].title).toBe('Top Rated Show');
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should handle edge cases with zero limit', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await digestShowRepository.getTrendingShows(0);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 0'));
      expect(result).toHaveLength(0);
    });

    it('should handle large limit values', async () => {
      const largeLimit = 1000;
      mockExecute.mockResolvedValue([[]]);

      await digestShowRepository.getNewlyAddedShows(largeLimit);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${largeLimit}`));
    });
  });

  describe('Error boundary tests', () => {
    it('should handle null/undefined database responses gracefully', async () => {
      mockExecute.mockResolvedValue([null]);

      await expect(digestShowRepository.getTrendingShows()).rejects.toThrow();
    });

    it('should handle malformed database responses', async () => {
      mockExecute.mockResolvedValue(['invalid response']);

      await expect(digestShowRepository.getNewlyAddedShows()).rejects.toThrow();
    });

    it('should handle database connection timeouts', async () => {
      const timeoutError = new Error('Connection timeout after 30s');
      mockExecute.mockRejectedValue(timeoutError);

      await expect(digestShowRepository.getTopRatedShows()).rejects.toThrow(
        'Database error getting top rated shows: Connection timeout after 30s',
      );
    });

    it('should handle SQL syntax errors gracefully', async () => {
      const sqlError = new Error('SQL syntax error near LIMIT');
      mockExecute.mockRejectedValue(sqlError);

      await expect(digestShowRepository.getTrendingShows()).rejects.toThrow(
        'Database error getting trending shows: SQL syntax error near LIMIT',
      );
    });
  });
});
