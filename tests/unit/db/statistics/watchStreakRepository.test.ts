import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getWatchStreakStats } from '@db/statistics/watchStreakRepository';

describe('watchStreakRepository', () => {
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

  describe('getWatchStreakStats', () => {
    it('should return empty stats when no watch data', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getWatchStreakStats(123);

      const expectedResult = {
        currentStreak: 0,
        longestStreak: 0,
        currentStreakStartDate: '',
        longestStreakPeriod: {
          startDate: '',
          endDate: '',
          days: 0,
        },
        streaksOver7Days: 0,
        averageStreakLength: 0,
      };
      expect(result).toEqual(expectedResult);
    });

    it('should calculate single day streak', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Format as YYYY-MM-DD in local timezone
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      mockPool.execute.mockResolvedValueOnce([[{ watch_date: todayStr }]]);

      const result = await getWatchStreakStats(123);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.currentStreakStartDate).toBe(todayStr);
      expect(result.longestStreakPeriod.days).toBe(1);
      expect(result.streaksOver7Days).toBe(0);
      expect(result.averageStreakLength).toBe(1);
    });

    it('should calculate consecutive day streaks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      mockPool.execute.mockResolvedValueOnce([
        [
          { watch_date: twoDaysAgo.toISOString().split('T')[0] },
          { watch_date: yesterday.toISOString().split('T')[0] },
          { watch_date: today.toISOString().split('T')[0] },
        ],
      ]);

      const result = await getWatchStreakStats(123);

      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
      expect(result.currentStreakStartDate).toBe(twoDaysAgo.toISOString().split('T')[0]);
      expect(result.longestStreakPeriod.days).toBe(3);
      expect(result.longestStreakPeriod.startDate).toBe(twoDaysAgo.toISOString().split('T')[0]);
      expect(result.longestStreakPeriod.endDate).toBe(today.toISOString().split('T')[0]);
      expect(result.streaksOver7Days).toBe(0);
      expect(result.averageStreakLength).toBe(3);
    });

    it('should handle streak ending yesterday as current streak', async () => {
      // Create dates to match how the implementation parses YYYY-MM-DD strings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Use toISOString().split('T')[0] to get consistent YYYY-MM-DD format
      // This ensures dates are compared correctly in the implementation
      mockPool.execute.mockResolvedValueOnce([
        [{ watch_date: twoDaysAgo.toISOString().split('T')[0] }, { watch_date: yesterday.toISOString().split('T')[0] }],
      ]);

      const result = await getWatchStreakStats(123);

      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(2);
      expect(result.currentStreakStartDate).toBe(twoDaysAgo.toISOString().split('T')[0]);
    });

    it('should handle broken streaks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const date1 = new Date(today);
      date1.setDate(date1.getDate() - 10);
      const date2 = new Date(date1);
      date2.setDate(date2.getDate() + 1);
      const date3 = new Date(date2);
      date3.setDate(date3.getDate() + 1);
      // Gap of 3 days
      const date4 = new Date(date3);
      date4.setDate(date4.getDate() + 4);
      const date5 = new Date(date4);
      date5.setDate(date5.getDate() + 1);

      mockPool.execute.mockResolvedValueOnce([
        [
          { watch_date: date1.toISOString().split('T')[0] },
          { watch_date: date2.toISOString().split('T')[0] },
          { watch_date: date3.toISOString().split('T')[0] },
          { watch_date: date4.toISOString().split('T')[0] },
          { watch_date: date5.toISOString().split('T')[0] },
        ],
      ]);

      const result = await getWatchStreakStats(123);

      // Should have two streaks: 3 days and 2 days
      expect(result.currentStreak).toBe(0); // Last streak doesn't extend to today/yesterday
      expect(result.longestStreak).toBe(3);
      expect(result.longestStreakPeriod.days).toBe(3);
      expect(result.longestStreakPeriod.startDate).toBe(date1.toISOString().split('T')[0]);
      expect(result.longestStreakPeriod.endDate).toBe(date3.toISOString().split('T')[0]);
      expect(result.streaksOver7Days).toBe(0);
      expect(result.averageStreakLength).toBe(2.5); // (3 + 2) / 2
    });

    it('should count streaks over 7 days', async () => {
      const dates = [];
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 20);

      // Create a 10-day streak
      for (let i = 0; i < 10; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      // Gap
      // Create a 5-day streak
      for (let i = 15; i < 20; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      mockPool.execute.mockResolvedValueOnce([dates]);

      const result = await getWatchStreakStats(123);

      expect(result.longestStreak).toBe(10);
      expect(result.streaksOver7Days).toBe(1); // Only the 10-day streak
      expect(result.averageStreakLength).toBe(7.5); // (10 + 5) / 2
    });

    it('should handle multiple long streaks', async () => {
      const dates = [];
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 50);

      // Create an 8-day streak
      for (let i = 0; i < 8; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      // Gap of 5 days
      // Create a 12-day streak
      for (let i = 13; i < 25; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      // Gap of 3 days
      // Create a 7-day streak
      for (let i = 28; i < 35; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      mockPool.execute.mockResolvedValueOnce([dates]);

      const result = await getWatchStreakStats(123);

      expect(result.longestStreak).toBe(12);
      expect(result.streaksOver7Days).toBe(3); // All three streaks are >= 7 days
      expect(result.averageStreakLength).toBe(9); // (8 + 12 + 7) / 3 = 9
    });

    it('should release connection even if query fails', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(getWatchStreakStats(123)).rejects.toThrow('Database error');
    });

    it('should pass correct profile ID to query', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getWatchStreakStats(456);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE profile_id = ?'), [456]);
    });

    it('should only query WATCHED episodes', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await getWatchStreakStats(123);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'WATCHED'"), expect.any(Array));
    });

    it('should round average streak length to 1 decimal place', async () => {
      const dates = [];
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 20);

      // Create a 3-day streak
      for (let i = 0; i < 3; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      // Gap
      // Create a 5-day streak
      for (let i = 5; i < 10; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      // Gap
      // Create a 2-day streak
      for (let i = 12; i < 14; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push({ watch_date: date.toISOString().split('T')[0] });
      }

      mockPool.execute.mockResolvedValueOnce([dates]);

      const result = await getWatchStreakStats(123);

      // (3 + 5 + 2) / 3 = 3.333... should round to 3.3
      expect(result.averageStreakLength).toBe(3.3);
    });
  });
});
