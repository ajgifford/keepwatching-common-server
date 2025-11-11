import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getAbandonmentRiskStats } from '@db/statistics/abandonmentRiskRepository';
import { RowDataPacket } from 'mysql2/promise';

describe('abandonmentRiskRepository', () => {
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

  describe('getAbandonmentRiskStats', () => {
    it('should return abandonment risk stats with shows at risk', async () => {
      const mockRiskRows = [
        {
          show_id: 1,
          show_title: 'Breaking Bad',
          days_since_last_watch: 45,
          unwatched_episodes: 12,
          status: 'WATCHING',
        },
        {
          show_id: 2,
          show_title: 'The Wire',
          days_since_last_watch: 60,
          unwatched_episodes: 8,
          status: 'WATCHING',
        },
      ] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 10,
          abandoned_shows: 3,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
      expect(mockConnection.query).toHaveBeenNthCalledWith(1, expect.stringContaining('days_since_last_watch'), [123]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, expect.stringContaining('total_started_shows'), [123]);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        showsAtRisk: [
          {
            showId: 1,
            showTitle: 'Breaking Bad',
            daysSinceLastWatch: 45,
            unwatchedEpisodes: 12,
            status: 'WATCHING',
          },
          {
            showId: 2,
            showTitle: 'The Wire',
            daysSinceLastWatch: 60,
            unwatchedEpisodes: 8,
            status: 'WATCHING',
          },
        ],
        showAbandonmentRate: 30.0,
      });
    });

    it('should return empty shows at risk with zero abandonment rate', async () => {
      const mockRiskRows = [] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 0,
          abandoned_shows: 0,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      expect(result).toEqual({
        showsAtRisk: [],
        showAbandonmentRate: 0,
      });
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should calculate abandonment rate correctly', async () => {
      const mockRiskRows = [] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 20,
          abandoned_shows: 7,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      // 7/20 = 0.35 = 35%, rounded to 1 decimal place
      expect(result.showAbandonmentRate).toBe(35.0);
    });

    it('should round abandonment rate to one decimal place', async () => {
      const mockRiskRows = [] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 3,
          abandoned_shows: 1,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      // 1/3 = 0.333... = 33.333...%, rounded to 33.3
      expect(result.showAbandonmentRate).toBe(33.3);
    });

    it('should handle zero total started shows without division by zero', async () => {
      const mockRiskRows = [] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 0,
          abandoned_shows: 0,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      expect(result.showAbandonmentRate).toBe(0);
    });

    it('should return 100% abandonment rate when all shows are abandoned', async () => {
      const mockRiskRows = [] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 5,
          abandoned_shows: 5,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      expect(result.showAbandonmentRate).toBe(100.0);
    });

    it('should sort shows at risk by days since last watch descending', async () => {
      const mockRiskRows = [
        {
          show_id: 2,
          show_title: 'Show B',
          days_since_last_watch: 90,
          unwatched_episodes: 10,
          status: 'WATCHING',
        },
        {
          show_id: 3,
          show_title: 'Show C',
          days_since_last_watch: 60,
          unwatched_episodes: 7,
          status: 'WATCHING',
        },
        {
          show_id: 1,
          show_title: 'Show A',
          days_since_last_watch: 30,
          unwatched_episodes: 5,
          status: 'WATCHING',
        },
      ] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 10,
          abandoned_shows: 2,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      // The query should return results ordered by days_since_last_watch DESC
      expect(result.showsAtRisk[0].daysSinceLastWatch).toBe(90);
      expect(result.showsAtRisk[1].daysSinceLastWatch).toBe(60);
      expect(result.showsAtRisk[2].daysSinceLastWatch).toBe(30);
    });

    it('should release connection on error in first query', async () => {
      const mockError = new Error('Database error');
      mockConnection.query.mockRejectedValueOnce(mockError);

      await expect(getAbandonmentRiskStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection on error in second query', async () => {
      const mockRiskRows = [] as RowDataPacket[];
      const mockError = new Error('Database error');

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockRejectedValueOnce(mockError);

      await expect(getAbandonmentRiskStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle single show at risk', async () => {
      const mockRiskRows = [
        {
          show_id: 1,
          show_title: 'Lost',
          days_since_last_watch: 75,
          unwatched_episodes: 20,
          status: 'WATCHING',
        },
      ] as RowDataPacket[];

      const mockRateRows = [
        {
          total_started_shows: 15,
          abandoned_shows: 4,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      const result = await getAbandonmentRiskStats(123);

      expect(result.showsAtRisk).toHaveLength(1);
      expect(result.showsAtRisk[0]).toEqual({
        showId: 1,
        showTitle: 'Lost',
        daysSinceLastWatch: 75,
        unwatchedEpisodes: 20,
        status: 'WATCHING',
      });
    });

    it('should pass correct profileId to both queries', async () => {
      const mockRiskRows = [] as RowDataPacket[];
      const mockRateRows = [
        {
          total_started_shows: 0,
          abandoned_shows: 0,
        },
      ] as RowDataPacket[];

      mockConnection.query.mockResolvedValueOnce([mockRiskRows]).mockResolvedValueOnce([mockRateRows]);

      await getAbandonmentRiskStats(456);

      expect(mockConnection.query).toHaveBeenNthCalledWith(1, expect.any(String), [456]);
      expect(mockConnection.query).toHaveBeenNthCalledWith(2, expect.any(String), [456]);
    });
  });
});
