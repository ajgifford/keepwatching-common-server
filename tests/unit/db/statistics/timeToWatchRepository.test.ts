import { getTimeToWatchStats } from '@db/statistics/timeToWatchRepository';
import { getDbPool } from '@utils/db';
import { type Mock, afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

  const fixedDate = new Date('2025-11-01T12:00:00Z');

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

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

  describe('getTimeToWatchStats', () => {
    it('should return empty object when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getTimeToWatchStats(123);

      const expectedResult = {
        averageDaysToStartShow: 0,
        averageDaysToCompleteShow: 0,
        fastestCompletions: [],
        backlogAging: {
          unwatchedOver30Days: 0,
          unwatchedOver90Days: 0,
          unwatchedOver365Days: 0,
        },
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should use DbMonitor for timing', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTimeToWatchStats(123);

      expect(mockDbMonitorInstance.executeWithTiming).toHaveBeenCalledWith('getTimeToWatchStats', expect.any(Function));
    });

    it('should release connection even if query fails', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(getTimeToWatchStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profile ID to query', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTimeToWatchStats(456);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [456]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should query for WATCHED episodes only', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTimeToWatchStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain("status = 'WATCHED'");
    });

    it('should include show_watch_status and episode_watch_status joins', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getTimeToWatchStats(123);

      const queryCall = mockConnection.query.mock.calls[0][0];
      expect(queryCall).toContain('show_watch_status');
      expect(queryCall).toContain('episode_watch_status');
    });

    it('should filter out shows with negative days_to_start', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-10'),
          days_to_start: 4,
          days_to_complete: 5,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-10'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-15'),
          days_to_start: -5,
          days_to_complete: 10,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      // Should only include the show with positive days_to_start
      expect(result.averageDaysToStartShow).toBe(4);
    });

    it('should only include completed shows in average days to complete', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-15'),
          days_to_start: 4,
          days_to_complete: 10,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: null,
          days_to_start: 4,
          days_to_complete: null,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      // Should only include completed show in average
      expect(result.averageDaysToCompleteShow).toBe(10);
    });

    it('should round averages to 1 decimal place', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-15'),
          days_to_start: 5,
          days_to_complete: 10,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-08'),
          last_watched: new Date('2025-10-18'),
          days_to_start: 7,
          days_to_complete: 10,
        },
        {
          show_id: 3,
          show_title: 'Show 3',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-10'),
          last_watched: new Date('2025-10-25'),
          days_to_start: 9,
          days_to_complete: 15,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      // (5 + 7 + 9) / 3 = 7
      expect(result.averageDaysToStartShow).toBe(7);
      // (10 + 10 + 15) / 3 = 11.666... should round to 11.7
      expect(result.averageDaysToCompleteShow).toBe(11.7);
    });

    it('should return only top 5 fastest completions', async () => {
      const shows = Array.from({ length: 10 }, (_, i) => ({
        show_id: i + 1,
        show_title: `Show ${i + 1}`,
        created_at: new Date('2025-10-01'),
        first_watched: new Date('2025-10-05'),
        last_watched: new Date('2025-10-10'),
        days_to_start: 4,
        days_to_complete: i + 1,
      }));

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      expect(result.fastestCompletions).toHaveLength(5);
      expect(result.fastestCompletions[0].daysToComplete).toBe(1);
      expect(result.fastestCompletions[4].daysToComplete).toBe(5);
    });

    it('should sort fastest completions by days ascending', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-25'),
          days_to_start: 4,
          days_to_complete: 20,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-10'),
          days_to_start: 4,
          days_to_complete: 5,
        },
        {
          show_id: 3,
          show_title: 'Show 3',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-20'),
          days_to_start: 4,
          days_to_complete: 15,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      expect(result.fastestCompletions).toHaveLength(3);
      expect(result.fastestCompletions[0].showId).toBe(2);
      expect(result.fastestCompletions[0].daysToComplete).toBe(5);
      expect(result.fastestCompletions[1].showId).toBe(3);
      expect(result.fastestCompletions[1].daysToComplete).toBe(15);
      expect(result.fastestCompletions[2].showId).toBe(1);
      expect(result.fastestCompletions[2].daysToComplete).toBe(20);
    });

    it('should calculate backlog aging for unwatched shows over 30 days', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-09-15'), // 47 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-25'), // 7 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      expect(result.backlogAging.unwatchedOver30Days).toBe(1);
      expect(result.backlogAging.unwatchedOver90Days).toBe(0);
      expect(result.backlogAging.unwatchedOver365Days).toBe(0);
    });

    it('should calculate backlog aging for unwatched shows over 90 days', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-07-15'), // 109 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-09-15'), // 47 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      expect(result.backlogAging.unwatchedOver30Days).toBe(2);
      expect(result.backlogAging.unwatchedOver90Days).toBe(1);
      expect(result.backlogAging.unwatchedOver365Days).toBe(0);
    });

    it('should calculate backlog aging for unwatched shows over 365 days', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2024-10-01'), // 396 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-07-15'), // 109 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      expect(result.backlogAging.unwatchedOver30Days).toBe(2);
      expect(result.backlogAging.unwatchedOver90Days).toBe(2);
      expect(result.backlogAging.unwatchedOver365Days).toBe(1);
    });

    it('should not include watched shows in backlog aging', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2024-10-01'), // 396 days ago
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-15'),
          days_to_start: 369,
          days_to_complete: 10,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-07-15'), // 109 days ago
          first_watched: null,
          last_watched: null,
          days_to_start: null,
          days_to_complete: null,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      // Only the unwatched show should count in backlog
      expect(result.backlogAging.unwatchedOver30Days).toBe(1);
      expect(result.backlogAging.unwatchedOver90Days).toBe(1);
      expect(result.backlogAging.unwatchedOver365Days).toBe(0);
    });

    it('should filter out shows with zero days_to_complete', async () => {
      const shows = [
        {
          show_id: 1,
          show_title: 'Show 1',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-05'),
          days_to_start: 4,
          days_to_complete: 0,
        },
        {
          show_id: 2,
          show_title: 'Show 2',
          created_at: new Date('2025-10-01'),
          first_watched: new Date('2025-10-05'),
          last_watched: new Date('2025-10-15'),
          days_to_start: 4,
          days_to_complete: 10,
        },
      ];

      mockConnection.query.mockResolvedValueOnce([shows]);

      const result = await getTimeToWatchStats(123);

      // Should only include show with days_to_complete > 0
      expect(result.averageDaysToCompleteShow).toBe(10);
      expect(result.fastestCompletions).toHaveLength(1);
      expect(result.fastestCompletions[0].showId).toBe(2);
    });
  });
});
