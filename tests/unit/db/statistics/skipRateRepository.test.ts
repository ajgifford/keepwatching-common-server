import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getAccountSkipRateStats, getProfileSkipRateStats } from '@db/statistics/skipRateRepository';

describe('skipRateRepository', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getProfileSkipRateStats
  // ---------------------------------------------------------------------------

  describe('getProfileSkipRateStats()', () => {
    it('should return totals, skip rate, and top-10 most-skipped shows for a profile', async () => {
      const totalsRows = [{ total_seasons_tracked: 42, total_seasons_skipped: 5 }];
      const showRows = [
        { show_id: 1, show_title: "Grey's Anatomy", skipped_season_count: 3 },
        { show_id: 2, show_title: 'ER', skipped_season_count: 2 },
      ];

      mockPool.execute.mockResolvedValueOnce([totalsRows]).mockResolvedValueOnce([showRows]);

      const result = await getProfileSkipRateStats(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        totalSeasonsTracked: 42,
        totalSeasonsSkipped: 5,
        skipRate: (5 / 42) * 100,
        mostSkippedShows: [
          { showId: 1, showTitle: "Grey's Anatomy", skippedSeasonCount: 3 },
          { showId: 2, showTitle: 'ER', skippedSeasonCount: 2 },
        ],
      });
    });

    it('should return zero totals, zero rate, and empty list when nothing tracked', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total_seasons_tracked: 0, total_seasons_skipped: 0 }]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileSkipRateStats(123);

      expect(result).toEqual({
        totalSeasonsTracked: 0,
        totalSeasonsSkipped: 0,
        skipRate: 0,
        mostSkippedShows: [],
      });
    });

    it('should query season_watch_status filtered by SKIPPED status and profileId', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total_seasons_tracked: 0, total_seasons_skipped: 0 }]])
        .mockResolvedValueOnce([[]]);

      await getProfileSkipRateStats(456);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('season_watch_status');
      expect(calls[0][1]).toEqual([456]);
      expect(calls[1][0]).toContain("status = 'SKIPPED'");
      expect(calls[1][0]).toContain('ORDER BY skipped_season_count DESC');
      expect(calls[1][0]).toContain('LIMIT 10');
      expect(calls[1][1]).toEqual([456]);
    });

    it('should compute skip rate with no seasons tracked as 0 (not NaN)', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total_seasons_tracked: 0, total_seasons_skipped: 0 }]])
        .mockResolvedValueOnce([[]]);

      const result = await getProfileSkipRateStats(1);

      expect(result.skipRate).toBe(0);
      expect(Number.isNaN(result.skipRate)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getAccountSkipRateStats
  // ---------------------------------------------------------------------------

  describe('getAccountSkipRateStats()', () => {
    it('should return totals, skip rate, and top-10 most-skipped shows with profile attribution', async () => {
      const totalsRows = [{ total_seasons_tracked: 120, total_seasons_skipped: 14 }];
      const showRows = [{ show_id: 1, show_title: "Grey's Anatomy", skipped_season_count: 3, profile_name: 'Alice' }];

      mockPool.execute.mockResolvedValueOnce([totalsRows]).mockResolvedValueOnce([showRows]);

      const result = await getAccountSkipRateStats(7);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        totalSeasonsTracked: 120,
        totalSeasonsSkipped: 14,
        skipRate: (14 / 120) * 100,
        mostSkippedShows: [{ showId: 1, showTitle: "Grey's Anatomy", skippedSeasonCount: 3, profileName: 'Alice' }],
      });
    });

    it('should join profiles table and filter by account_id', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total_seasons_tracked: 0, total_seasons_skipped: 0 }]])
        .mockResolvedValueOnce([[]]);

      await getAccountSkipRateStats(99);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('JOIN profiles p');
      expect(calls[0][0]).toContain('p.account_id = ?');
      expect(calls[0][1]).toEqual([99]);
      expect(calls[1][0]).toContain('p.name AS profile_name');
      expect(calls[1][1]).toEqual([99]);
    });

    it('should return zero totals, zero rate, and empty list when nothing tracked', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ total_seasons_tracked: 0, total_seasons_skipped: 0 }]])
        .mockResolvedValueOnce([[]]);

      const result = await getAccountSkipRateStats(7);

      expect(result).toEqual({
        totalSeasonsTracked: 0,
        totalSeasonsSkipped: 0,
        skipRate: 0,
        mostSkippedShows: [],
      });
    });
  });
});
