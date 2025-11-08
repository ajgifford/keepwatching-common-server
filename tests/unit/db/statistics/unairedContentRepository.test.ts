import { getUnairedContentStats } from '@db/statistics/unairedContentRepository';
import { getDbPool } from '@utils/db';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbMonitorInstance = {
  executeWithTiming: vi.fn((name: string, fn: () => any) => fn()),
};

// Mock dependencies
vi.mock('@utils/db', () => ({
  getDbPool: vi.fn(),
}));

vi.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: vi.fn(() => mockDbMonitorInstance),
  },
}));

describe('statisticsDb', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // Create mock pool
    mockPool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    // Set up getDbPool to return mock pool
    (getDbPool as Mock).mockReturnValue(mockPool);

    // Reset DbMonitor mock
    mockDbMonitorInstance.executeWithTiming.mockClear();
    mockDbMonitorInstance.executeWithTiming.mockImplementation((name: string, fn: () => any) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUnairedContentStats', () => {
    it('should return empty object when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getUnairedContentStats(123);

      const expectedResult = {
        unairedShowCount: 0,
        unairedSeasonCount: 0,
        unairedEpisodeCount: 0,
        unairedMovieCount: 0,
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should return unaired counts when the profile has data', async () => {
      mockConnection.query.mockResolvedValueOnce([
        [{ unaired_show_count: 2, unaired_season_count: 5, unaired_episode_count: 25, unaired_movie_count: 3 }],
      ]);

      const result = await getUnairedContentStats(123);

      const expectedResult = {
        unairedShowCount: 2,
        unairedSeasonCount: 5,
        unairedEpisodeCount: 25,
        unairedMovieCount: 3,
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should use DbMonitor for timing', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(123);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getUnairedContentStats',
        expect.any(Function),
      );
    });

    it('should release connection even if query fails', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(getUnairedContentStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profile ID to query four times', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(456);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [456, 456, 456, 456]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should query for unaired shows with episodes after NOW()', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain('e.air_date > NOW()');
      expect(queryCall).toContain('show_watch_status');
    });

    it('should query for unaired seasons with release_date after NOW()', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain('se.release_date > NOW()');
      expect(queryCall).toContain('seasons');
    });

    it('should query for unaired episodes with air_date after NOW()', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain('episodes');
      expect(queryCall).toContain('e.air_date > NOW()');
    });

    it('should query for unaired movies with release_date after NOW()', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getUnairedContentStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain('movie_watch_status');
      expect(queryCall).toContain('m.release_date > NOW()');
    });

    it('should return zero counts for all fields when rows are empty', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getUnairedContentStats(999);

      expect(result.unairedShowCount).toBe(0);
      expect(result.unairedSeasonCount).toBe(0);
      expect(result.unairedEpisodeCount).toBe(0);
      expect(result.unairedMovieCount).toBe(0);
    });

    it('should handle partial data correctly', async () => {
      mockConnection.query.mockResolvedValueOnce([
        [{ unaired_show_count: 0, unaired_season_count: 0, unaired_episode_count: 10, unaired_movie_count: 0 }],
      ]);

      const result = await getUnairedContentStats(123);

      expect(result).toEqual({
        unairedShowCount: 0,
        unairedSeasonCount: 0,
        unairedEpisodeCount: 10,
        unairedMovieCount: 0,
      });
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });
});
