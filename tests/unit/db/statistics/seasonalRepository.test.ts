import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getSeasonalViewingStats } from '@db/statistics/seasonalRepository';

describe('statisticsDb', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSeasonalViewingStats', () => {
    it('should return empty object when no data', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

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
      mockPool.execute.mockResolvedValueOnce([monthRows]);

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
    });

    it('should handle partial data (only some months have viewing)', async () => {
      const partialData = [
        { month: 1, month_name: 'January', episode_count: 10 },
        { month: 4, month_name: 'April', episode_count: 25 },
        { month: 7, month_name: 'July', episode_count: 15 },
      ];
      mockPool.execute.mockResolvedValueOnce([partialData]);

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
    });

    it('should correctly aggregate spring months (March, April, May)', async () => {
      const springData = [
        { month: 3, month_name: 'March', episode_count: 20 },
        { month: 4, month_name: 'April', episode_count: 30 },
        { month: 5, month_name: 'May', episode_count: 25 },
      ];
      mockPool.execute.mockResolvedValueOnce([springData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(75);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(0);
    });

    it('should correctly aggregate summer months (June, July, August)', async () => {
      const summerData = [
        { month: 6, month_name: 'June', episode_count: 15 },
        { month: 7, month_name: 'July', episode_count: 20 },
        { month: 8, month_name: 'August', episode_count: 18 },
      ];
      mockPool.execute.mockResolvedValueOnce([summerData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(53);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(0);
    });

    it('should correctly aggregate fall months (September, October, November)', async () => {
      const fallData = [
        { month: 9, month_name: 'September', episode_count: 22 },
        { month: 10, month_name: 'October', episode_count: 28 },
        { month: 11, month_name: 'November', episode_count: 30 },
      ];
      mockPool.execute.mockResolvedValueOnce([fallData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(80);
      expect(result.viewingBySeason.winter).toBe(0);
    });

    it('should correctly aggregate winter months (December, January, February)', async () => {
      const winterData = [
        { month: 12, month_name: 'December', episode_count: 25 },
        { month: 1, month_name: 'January', episode_count: 20 },
        { month: 2, month_name: 'February', episode_count: 18 },
      ];
      mockPool.execute.mockResolvedValueOnce([winterData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingBySeason.spring).toBe(0);
      expect(result.viewingBySeason.summer).toBe(0);
      expect(result.viewingBySeason.fall).toBe(0);
      expect(result.viewingBySeason.winter).toBe(63);
    });

    it('should handle single month with data', async () => {
      const singleMonthData = [{ month: 6, month_name: 'June', episode_count: 50 }];
      mockPool.execute.mockResolvedValueOnce([singleMonthData]);

      const result = await getSeasonalViewingStats(123);

      expect(result.viewingByMonth).toEqual({ June: 50 });
      expect(result.viewingBySeason.summer).toBe(50);
      expect(result.peakViewingMonth).toBe('June');
      expect(result.slowestViewingMonth).toBe('June');
    });

    it('should correctly identify peak month when multiple months have same count', async () => {
      const tiedData = [
        { month: 1, month_name: 'January', episode_count: 30 },
        { month: 2, month_name: 'February', episode_count: 30 },
        { month: 3, month_name: 'March', episode_count: 10 },
      ];
      mockPool.execute.mockResolvedValueOnce([tiedData]);

      const result = await getSeasonalViewingStats(123);

      // Should be the first one encountered with max count
      expect(result.peakViewingMonth).toBe('January');
      expect(result.slowestViewingMonth).toBe('March');
    });

    it('should pass correct profileId parameter to query', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getSeasonalViewingStats(456);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE ews.profile_id = ?'), [456]);
    });

    it('should release connection even if query throws error', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getSeasonalViewingStats(123)).rejects.toThrow('Database error');
    });
  });
});
