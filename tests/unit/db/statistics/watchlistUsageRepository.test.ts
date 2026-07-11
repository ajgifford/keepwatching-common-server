import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getAccountWatchlistUsageStats, getProfileWatchlistUsageStats } from '@db/statistics/watchlistUsageRepository';

describe('watchlistUsageRepository', () => {
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
  // getProfileWatchlistUsageStats
  // ---------------------------------------------------------------------------

  describe('getProfileWatchlistUsageStats()', () => {
    it('should combine currently-queued, churn, completion, and avg-completion queries', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 3, avg_current_queue_days: 12.5 }]])
        .mockResolvedValueOnce([[{ content_type: 'show', content_id: 101, title: 'Severance', days_in_queue: 42 }]])
        .mockResolvedValueOnce([
          [
            { event_type: 'added', cnt: 25 },
            { event_type: 'removed', cnt: 17 },
          ],
        ])
        .mockResolvedValueOnce([[{ completed_count: 11, abandoned_count: 6, total_removed: 17 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: 9.2 }]]);

      const result = await getProfileWatchlistUsageStats(123);

      expect(mockPool.execute).toHaveBeenCalledTimes(5);
      expect(result).toEqual({
        currentlyQueuedCount: 3,
        averageCurrentQueueDays: 12.5,
        totalAdded: 25,
        totalRemoved: 17,
        completedCount: 11,
        abandonedCount: 6,
        completionRate: (11 / 17) * 100,
        averageDaysToCompletion: 9.2,
        longestQueuedItems: [{ contentId: 101, contentType: 'show', title: 'Severance', daysInQueue: 42 }],
      });
    });

    it('should return null averageDaysToCompletion when nothing has been completed', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 0, avg_current_queue_days: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ completed_count: 0, abandoned_count: 0, total_removed: 0 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: null }]]);

      const result = await getProfileWatchlistUsageStats(123);

      expect(result.averageDaysToCompletion).toBeNull();
      expect(result.completionRate).toBe(0);
      expect(result.totalAdded).toBe(0);
      expect(result.totalRemoved).toBe(0);
    });

    it('should compute completion rate as 0 (not NaN) when nothing has been removed', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 5, avg_current_queue_days: 3 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ event_type: 'added', cnt: 5 }]])
        .mockResolvedValueOnce([[{ completed_count: 0, abandoned_count: 0, total_removed: 0 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: null }]]);

      const result = await getProfileWatchlistUsageStats(1);

      expect(result.completionRate).toBe(0);
      expect(Number.isNaN(result.completionRate)).toBe(false);
      expect(result.totalAdded).toBe(5);
      expect(result.totalRemoved).toBe(0);
    });

    it('should query watchlist_items and watchlist_item_events filtered by profileId', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 0, avg_current_queue_days: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ completed_count: 0, abandoned_count: 0, total_removed: 0 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: null }]]);

      await getProfileWatchlistUsageStats(456);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('FROM watchlist_items');
      expect(calls[0][1]).toEqual([456]);
      expect(calls[1][0]).toContain('LIMIT 5');
      expect(calls[2][0]).toContain('watchlist_item_events');
      expect(calls[2][0]).toContain('GROUP BY event_type');
      expect(calls[3][0]).toContain("event_type = 'removed'");
      expect(calls[4][0]).toContain('LAG(');
      expect(calls[4][0]).toContain('PARTITION BY profile_id, content_type, content_id');
    });
  });

  // ---------------------------------------------------------------------------
  // getAccountWatchlistUsageStats
  // ---------------------------------------------------------------------------

  describe('getAccountWatchlistUsageStats()', () => {
    it('should combine account-scoped queries and attribute longest-queued items to profiles', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 15, avg_current_queue_days: 10.1 }]])
        .mockResolvedValueOnce([
          [{ content_type: 'show', content_id: 101, title: 'Severance', days_in_queue: 42, profile_name: 'Alice' }],
        ])
        .mockResolvedValueOnce([
          [
            { event_type: 'added', cnt: 60 },
            { event_type: 'removed', cnt: 45 },
          ],
        ])
        .mockResolvedValueOnce([[{ completed_count: 30, abandoned_count: 15, total_removed: 45 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: 8.5 }]]);

      const result = await getAccountWatchlistUsageStats(7);

      expect(mockPool.execute).toHaveBeenCalledTimes(5);
      expect(result).toEqual({
        currentlyQueuedCount: 15,
        averageCurrentQueueDays: 10.1,
        totalAdded: 60,
        totalRemoved: 45,
        completedCount: 30,
        abandonedCount: 15,
        completionRate: (30 / 45) * 100,
        averageDaysToCompletion: 8.5,
        longestQueuedItems: [
          { contentId: 101, contentType: 'show', title: 'Severance', daysInQueue: 42, profileName: 'Alice' },
        ],
      });
    });

    it('should filter by account_id directly and join profiles for attribution', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ currently_queued_count: 0, avg_current_queue_days: 0 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ completed_count: 0, abandoned_count: 0, total_removed: 0 }]])
        .mockResolvedValueOnce([[{ avg_days_to_completion: null }]]);

      await getAccountWatchlistUsageStats(99);

      const calls = mockPool.execute.mock.calls;
      expect(calls[0][0]).toContain('WHERE account_id = ?');
      expect(calls[0][1]).toEqual([99]);
      expect(calls[1][0]).toContain('JOIN profiles p');
      expect(calls[1][0]).toContain('p.name AS profile_name');
      expect(calls[1][1]).toEqual([99]);
    });
  });
});
