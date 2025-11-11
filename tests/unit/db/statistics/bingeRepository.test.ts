import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getBingeWatchingStats } from '@db/statistics/bingeRepository';
import { RowDataPacket } from 'mysql2/promise';

describe('bingeRepository', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockConnection = mocks.mockConnection;
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBingeWatchingStats', () => {
    it('should return empty object when no data', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const result = await getBingeWatchingStats(123);

      const expectedResult = {
        bingeSessionCount: 0,
        averageEpisodesPerBinge: 0,
        longestBingeSession: {
          showTitle: '',
          episodeCount: 0,
          date: '',
        },
        topBingedShows: [],
      };
      expect(result).toEqual(expectedResult);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should detect a single binge session with 3 episodes', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 103,
          watched_at: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000).toISOString(), // +4 hours
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(1);
      expect(result.averageEpisodesPerBinge).toBe(3);
      expect(result.longestBingeSession).toEqual({
        showTitle: 'Breaking Bad',
        episodeCount: 3,
        date: '2025-10-15',
      });
      expect(result.topBingedShows).toEqual([
        {
          showId: 1,
          showTitle: 'Breaking Bad',
          bingeSessionCount: 1,
        },
      ]);
    });

    it('should not count sessions with less than 3 episodes', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(0);
      expect(result.averageEpisodesPerBinge).toBe(0);
      expect(result.longestBingeSession).toEqual({
        showTitle: '',
        episodeCount: 0,
        date: '',
      });
      expect(result.topBingedShows).toEqual([]);
    });

    it('should not count episodes watched more than 24 hours apart', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 25 * 60 * 60 * 1000).toISOString(), // +25 hours (over 24)
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 103,
          watched_at: new Date(baseTime.getTime() + 27 * 60 * 60 * 1000).toISOString(), // +27 hours
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(0);
      expect(result.averageEpisodesPerBinge).toBe(0);
    });

    it('should detect multiple binge sessions for the same show', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        // First binge session (3 episodes)
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 103,
          watched_at: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        },
        // Second binge session (4 episodes, more than 24 hours after first)
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 104,
          watched_at: new Date(baseTime.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 105,
          watched_at: new Date(baseTime.getTime() + 50 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 106,
          watched_at: new Date(baseTime.getTime() + 52 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 107,
          watched_at: new Date(baseTime.getTime() + 54 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(2);
      expect(result.averageEpisodesPerBinge).toBe(3.5); // (3 + 4) / 2
      expect(result.longestBingeSession.episodeCount).toBe(4);
      expect(result.topBingedShows[0].bingeSessionCount).toBe(2);
    });

    it('should separate binge sessions for different shows', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        // Breaking Bad binge (3 episodes)
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 103,
          watched_at: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        },
        // The Wire binge (4 episodes)
        {
          show_id: 2,
          show_title: 'The Wire',
          episode_id: 201,
          watched_at: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'The Wire',
          episode_id: 202,
          watched_at: new Date(baseTime.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'The Wire',
          episode_id: 203,
          watched_at: new Date(baseTime.getTime() + 10 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'The Wire',
          episode_id: 204,
          watched_at: new Date(baseTime.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(2);
      expect(result.averageEpisodesPerBinge).toBe(3.5); // (3 + 4) / 2
      expect(result.longestBingeSession).toEqual({
        showTitle: 'The Wire',
        episodeCount: 4,
        date: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      expect(result.topBingedShows).toHaveLength(2);
    });

    it('should calculate average episodes per binge correctly', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        // Session 1: 3 episodes
        { show_id: 1, show_title: 'Show A', episode_id: 1, watched_at: baseTime.toISOString() },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 2,
          watched_at: new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 3,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        // Session 2: 5 episodes
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 4,
          watched_at: new Date(baseTime.getTime() + 30 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 5,
          watched_at: new Date(baseTime.getTime() + 31 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 6,
          watched_at: new Date(baseTime.getTime() + 32 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 7,
          watched_at: new Date(baseTime.getTime() + 33 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 8,
          watched_at: new Date(baseTime.getTime() + 34 * 60 * 60 * 1000).toISOString(),
        },
        // Session 3: 4 episodes
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 9,
          watched_at: new Date(baseTime.getTime() + 60 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 10,
          watched_at: new Date(baseTime.getTime() + 61 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 11,
          watched_at: new Date(baseTime.getTime() + 62 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 12,
          watched_at: new Date(baseTime.getTime() + 63 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.bingeSessionCount).toBe(3);
      expect(result.averageEpisodesPerBinge).toBe(4.0); // (3 + 5 + 4) / 3 = 12 / 3 = 4.0
    });

    it('should round average episodes per binge to one decimal place', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        // Session 1: 3 episodes
        { show_id: 1, show_title: 'Show A', episode_id: 1, watched_at: baseTime.toISOString() },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 2,
          watched_at: new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 3,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        // Session 2: 4 episodes
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 4,
          watched_at: new Date(baseTime.getTime() + 30 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 5,
          watched_at: new Date(baseTime.getTime() + 31 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 6,
          watched_at: new Date(baseTime.getTime() + 32 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 7,
          watched_at: new Date(baseTime.getTime() + 33 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      // (3 + 4) / 2 = 3.5
      expect(result.averageEpisodesPerBinge).toBe(3.5);
    });

    it('should return top 5 binged shows sorted by session count', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');

      // Create binge sessions for 6 different shows with varying counts
      const mockEpisodes = [];

      // Show 1: 3 binge sessions
      for (let session = 0; session < 3; session++) {
        for (let ep = 0; ep < 3; ep++) {
          mockEpisodes.push({
            show_id: 1,
            show_title: 'Show 1',
            episode_id: session * 10 + ep,
            watched_at: new Date(baseTime.getTime() + (session * 100 + ep * 2) * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Show 2: 1 binge session
      for (let ep = 0; ep < 3; ep++) {
        mockEpisodes.push({
          show_id: 2,
          show_title: 'Show 2',
          episode_id: 100 + ep,
          watched_at: new Date(baseTime.getTime() + (500 + ep * 2) * 60 * 60 * 1000).toISOString(),
        });
      }

      // Show 3: 5 binge sessions
      for (let session = 0; session < 5; session++) {
        for (let ep = 0; ep < 3; ep++) {
          mockEpisodes.push({
            show_id: 3,
            show_title: 'Show 3',
            episode_id: 200 + session * 10 + ep,
            watched_at: new Date(baseTime.getTime() + (1000 + session * 100 + ep * 2) * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Show 4: 2 binge sessions
      for (let session = 0; session < 2; session++) {
        for (let ep = 0; ep < 3; ep++) {
          mockEpisodes.push({
            show_id: 4,
            show_title: 'Show 4',
            episode_id: 300 + session * 10 + ep,
            watched_at: new Date(baseTime.getTime() + (2000 + session * 100 + ep * 2) * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Show 5: 4 binge sessions
      for (let session = 0; session < 4; session++) {
        for (let ep = 0; ep < 3; ep++) {
          mockEpisodes.push({
            show_id: 5,
            show_title: 'Show 5',
            episode_id: 400 + session * 10 + ep,
            watched_at: new Date(baseTime.getTime() + (3000 + session * 100 + ep * 2) * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Show 6: 1 binge session (should not appear in top 5)
      for (let ep = 0; ep < 3; ep++) {
        mockEpisodes.push({
          show_id: 6,
          show_title: 'Show 6',
          episode_id: 500 + ep,
          watched_at: new Date(baseTime.getTime() + (4000 + ep * 2) * 60 * 60 * 1000).toISOString(),
        });
      }

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.topBingedShows).toHaveLength(5);
      // Should be sorted by bingeSessionCount descending: Show 3 (5), Show 5 (4), Show 1 (3), Show 4 (2), Show 2 or 6 (1)
      expect(result.topBingedShows[0]).toEqual({ showId: 3, showTitle: 'Show 3', bingeSessionCount: 5 });
      expect(result.topBingedShows[1]).toEqual({ showId: 5, showTitle: 'Show 5', bingeSessionCount: 4 });
      expect(result.topBingedShows[2]).toEqual({ showId: 1, showTitle: 'Show 1', bingeSessionCount: 3 });
      expect(result.topBingedShows[3]).toEqual({ showId: 4, showTitle: 'Show 4', bingeSessionCount: 2 });
      expect(result.topBingedShows[4].bingeSessionCount).toBe(1);
    });

    it('should identify longest binge session correctly', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        // Session 1: 3 episodes
        { show_id: 1, show_title: 'Show A', episode_id: 1, watched_at: baseTime.toISOString() },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 2,
          watched_at: new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Show A',
          episode_id: 3,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        // Session 2: 7 episodes (longest)
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 4,
          watched_at: new Date(baseTime.getTime() + 30 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 5,
          watched_at: new Date(baseTime.getTime() + 31 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 6,
          watched_at: new Date(baseTime.getTime() + 32 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 7,
          watched_at: new Date(baseTime.getTime() + 33 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 8,
          watched_at: new Date(baseTime.getTime() + 34 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 9,
          watched_at: new Date(baseTime.getTime() + 35 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 2,
          show_title: 'Show B',
          episode_id: 10,
          watched_at: new Date(baseTime.getTime() + 36 * 60 * 60 * 1000).toISOString(),
        },
        // Session 3: 4 episodes
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 11,
          watched_at: new Date(baseTime.getTime() + 60 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 12,
          watched_at: new Date(baseTime.getTime() + 61 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 13,
          watched_at: new Date(baseTime.getTime() + 62 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 3,
          show_title: 'Show C',
          episode_id: 14,
          watched_at: new Date(baseTime.getTime() + 63 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      expect(result.longestBingeSession).toEqual({
        showTitle: 'Show B',
        episodeCount: 7,
        date: new Date(baseTime.getTime() + 30 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    });

    it('should handle binge session ending at last episode', async () => {
      const baseTime = new Date('2025-10-15T10:00:00Z');
      const mockEpisodes = [
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 101,
          watched_at: baseTime.toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 102,
          watched_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          episode_id: 103,
          watched_at: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockEpisodes]);

      const result = await getBingeWatchingStats(123);

      // Should detect the binge session even though it's the last episodes in the list
      expect(result.bingeSessionCount).toBe(1);
      expect(result.averageEpisodesPerBinge).toBe(3);
    });

    it('should release connection on error', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getBingeWatchingStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profileId to query', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      await getBingeWatchingStats(456);

      expect(mockConnection.query).toHaveBeenCalledWith(expect.any(String), [456]);
    });
  });
});
