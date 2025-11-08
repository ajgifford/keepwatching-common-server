import { getSeasonalViewingStats } from '@db/statistics/seasonalRepository';
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

  describe('getSeasonalViewingStats', () => {
    it('should return empty object when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getSeasonalViewingStats(123);

      const expectedResult = {
        viewingByMonth: {},
        viewingBySeason: {
          spring: 0,
          summer: 0,
          fall: 0,
          winter: 0,
        },
        peakViewingMonth: 'N/A',
        slowestViewingMonth: 'N/A',
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should return seasonal viewing data when the profile has data for all months', async () => {
      const monthRows = [
        { month: 1, month_name: 'January', episode_count: 13 },
        { month: 2, month_name: 'February', episode_count: 35 },
        { month: 3, month_name: 'March', episode_count: 19 },
        { month: 4, month_name: 'April', episode_count: 39 },
        { month: 5, month_name: 'May', episode_count: 19 },
        { month: 6, month_name: 'June', episode_count: 39 },
        { month: 7, month_name: 'July', episode_count: 13 },
        { month: 8, month_name: 'August', episode_count: 36 },
        { month: 9, month_name: 'September', episode_count: 15 },
        { month: 10, month_name: 'October', episode_count: 28 },
        { month: 11, month_name: 'November', episode_count: 31 },
        { month: 12, month_name: 'December', episode_count: 19 },
      ];
      mockConnection.query.mockResolvedValueOnce([monthRows]);

      const result = await getSeasonalViewingStats(123);

      const expectedResult = {
        viewingByMonth: {
          January: 13,
          February: 35,
          March: 19,
          April: 39,
          May: 19,
          June: 39,
          July: 13,
          August: 36,
          September: 15,
          October: 28,
          November: 31,
          December: 19,
        },
        viewingBySeason: {
          spring: 77,
          summer: 88,
          fall: 74,
          winter: 67,
        },
        peakViewingMonth: 'April',
        slowestViewingMonth: 'January',
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle partial data (only some months have viewing)', async () => {
      const partialData = [
        { month: 1, month_name: 'January', episode_count: 10 },
        { month: 4, month_name: 'April', episode_count: 25 },
        { month: 7, month_name: 'July', episode_count: 15 },
      ];
      mockConnection.query.mockResolvedValueOnce([partialData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingByMonth).toEqual({
        January: 10,
        April: 25,
        July: 15,
      });
      expect(result.viewingBySeason).toEqual({
        spring: 25, // April
        summer: 15, // July
        fall: 0,
        winter: 10, // January
      });
      expect(result.peakViewingMonth).toBe('April');
      expect(result.slowestViewingMonth).toBe('January');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly aggregate spring months (March, April, May)', async () => {
      const springData = [
        { month: 3, month_name: 'March', episode_count: 20 },
        { month: 4, month_name: 'April', episode_count: 30 },
        { month: 5, month_name: 'May', episode_count: 25 },
      ];
      mockConnection.query.mockResolvedValueOnce([springData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(75);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(0);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly aggregate summer months (June, July, August)', async () => {
      const summerData = [
        { month: 6, month_name: 'June', episode_count: 15 },
        { month: 7, month_name: 'July', episode_count: 20 },
        { month: 8, month_name: 'August', episode_count: 18 },
      ];
      mockConnection.query.mockResolvedValueOnce([summerData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(53);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(0);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly aggregate fall months (September, October, November)', async () => {
      const fallData = [
        { month: 9, month_name: 'September', episode_count: 22 },
        { month: 10, month_name: 'October', episode_count: 28 },
        { month: 11, month_name: 'November', episode_count: 30 },
      ];
      mockConnection.query.mockResolvedValueOnce([fallData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(80);
      expect(result.viewingBySeason.winter).toBe(0);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly aggregate winter months (December, January, February)', async () => {
      const winterData = [
        { month: 12, month_name: 'December', episode_count: 25 },
        { month: 1, month_name: 'January', episode_count: 20 },
        { month: 2, month_name: 'February', episode_count: 18 },
      ];
      mockConnection.query.mockResolvedValueOnce([winterData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(63);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle single month with data', async () => {
      const singleMonthData = [{ month: 6, month_name: 'June', episode_count: 50 }];
      mockConnection.query.mockResolvedValueOnce([singleMonthData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingByMonth).toEqual({ June: 50 });
      expect(result.viewingBySeason.summer).toBe(50);
      expect(result.peakViewingMonth).toBe('June');
      expect(result.slowestViewingMonth).toBe('June');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should correctly identify peak month when multiple months have same count', async () => {
      const tiedData = [
        { month: 1, month_name: 'January', episode_count: 30 },
        { month: 2, month_name: 'February', episode_count: 30 },
        { month: 3, month_name: 'March', episode_count: 10 },
      ];
      mockConnection.query.mockResolvedValueOnce([tiedData]);

      const result = await getSeasonalViewingStats(123);

      // Should be the first one encountered with max count
      expect(result.peakViewingMonth).toBe('January');
      expect(result.slowestViewingMonth).toBe('March');
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profileId parameter to query', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getSeasonalViewingStats(456);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('WHERE ews.profile_id = ?'), [456]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection even if query throws error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(getSeasonalViewingStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should use DbMonitor.executeWithTiming', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getSeasonalViewingStats(123);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith(
        'getSeasonalViewingStats',
        expect.any(Function),
      );
    });
  });
});
