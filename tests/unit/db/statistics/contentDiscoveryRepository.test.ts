import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getContentDiscoveryStats } from '@db/statistics/contentDiscoveryRepository';
import { RowDataPacket } from 'mysql2/promise';

describe('contentDiscoveryRepository', () => {
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

  describe('getContentDiscoveryStats', () => {
    it('should return zero values when no content added', async () => {
      const mockAdditionRows = [
        {
          last_content_added: null,
          shows_added_30_days: 0,
          movies_added_30_days: 0,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.daysSinceLastContentAdded).toBe(0);
      expect(result.contentAdditionRate.showsPerMonth).toBe(0);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(0);
      expect(result.watchToAddRatio.shows).toBe(0);
      expect(result.watchToAddRatio.movies).toBe(0);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should calculate days since last content added correctly', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const mockAdditionRows = [
        {
          last_content_added: fiveDaysAgo,
          shows_added_30_days: 0,
          movies_added_30_days: 0,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.daysSinceLastContentAdded).toBe(5);
    });

    it('should calculate content addition rate correctly', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 10,
          movies_added_30_days: 5,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      // 10 shows in 30 days = 10 per month
      expect(result.contentAdditionRate.showsPerMonth).toBe(10.0);
      // 5 movies in 30 days = 5 per month
      expect(result.contentAdditionRate.moviesPerMonth).toBe(5.0);
    });

    it('should round addition rates to one decimal place', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 7,
          movies_added_30_days: 3,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      // Should be 7.0 and 3.0 (one decimal place)
      expect(result.contentAdditionRate.showsPerMonth).toBe(7.0);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(3.0);
    });

    it('should calculate watch-to-add ratio correctly', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 10,
          movies_added_30_days: 8,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 5,
          movies_completed_30_days: 4,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      // 5 completed / 10 added = 0.5
      expect(result.watchToAddRatio.shows).toBe(0.5);
      // 4 completed / 8 added = 0.5
      expect(result.watchToAddRatio.movies).toBe(0.5);
    });

    it('should round watch-to-add ratio to two decimal places', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 3,
          movies_added_30_days: 7,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 2,
          movies_completed_30_days: 5,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      // 2 / 3 = 0.666... rounded to 0.67
      expect(result.watchToAddRatio.shows).toBe(0.67);
      // 5 / 7 = 0.714... rounded to 0.71
      expect(result.watchToAddRatio.movies).toBe(0.71);
    });

    it('should handle zero shows added without division by zero', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 0,
          movies_added_30_days: 5,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 10,
          movies_completed_30_days: 3,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.watchToAddRatio.shows).toBe(0);
      expect(result.watchToAddRatio.movies).toBe(0.6); // 3 / 5
    });

    it('should handle zero movies added without division by zero', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 4,
          movies_added_30_days: 0,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 2,
          movies_completed_30_days: 10,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.watchToAddRatio.shows).toBe(0.5); // 2 / 4
      expect(result.watchToAddRatio.movies).toBe(0);
    });

    it('should handle ratio greater than 1.0', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 5,
          movies_added_30_days: 3,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 10,
          movies_completed_30_days: 9,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      // 10 / 5 = 2.0 (completing more than adding)
      expect(result.watchToAddRatio.shows).toBe(2.0);
      // 9 / 3 = 3.0
      expect(result.watchToAddRatio.movies).toBe(3.0);
    });

    it('should return complete stats with all data', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const mockAdditionRows = [
        {
          last_content_added: twoDaysAgo,
          shows_added_30_days: 15,
          movies_added_30_days: 10,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 12,
          movies_completed_30_days: 8,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      expect(result.daysSinceLastContentAdded).toBe(2);
      expect(result.contentAdditionRate.showsPerMonth).toBe(15.0);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(10.0);
      expect(result.watchToAddRatio.shows).toBe(0.8); // 12 / 15
      expect(result.watchToAddRatio.movies).toBe(0.8); // 8 / 10
    });

    it('should release connection on error in first query', async () => {
      const mockError = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(mockError);

      await expect(getContentDiscoveryStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection on error in second query', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 5,
          movies_added_30_days: 3,
        },
      ] as RowDataPacket[];
      const mockError = new Error('Database error');

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockRejectedValueOnce(mockError);

      await expect(getContentDiscoveryStats(123)).rejects.toThrow('Database error');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass correct profileId to first query', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 0,
          movies_added_30_days: 0,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      await getContentDiscoveryStats(456);

      // First query has 4 profileId parameters
      expect(mockConnection.execute).toHaveBeenNthCalledWith(1, expect.any(String), [456, 456, 456, 456]);
    });

    it('should pass correct profileId to second query', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 0,
          movies_added_30_days: 0,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      await getContentDiscoveryStats(789);

      // Second query has 2 profileId parameters
      expect(mockConnection.execute).toHaveBeenNthCalledWith(2, expect.any(String), [789, 789]);
    });

    it('should handle very large numbers of additions', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 1000,
          movies_added_30_days: 500,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 750,
          movies_completed_30_days: 400,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.contentAdditionRate.showsPerMonth).toBe(1000.0);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(500.0);
      expect(result.watchToAddRatio.shows).toBe(0.75); // 750 / 1000
      expect(result.watchToAddRatio.movies).toBe(0.8); // 400 / 500
    });

    it('should handle 30 days ago for daysSinceLastContentAdded', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const mockAdditionRows = [
        {
          last_content_added: thirtyDaysAgo,
          shows_added_30_days: 5,
          movies_added_30_days: 3,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 4,
          movies_completed_30_days: 2,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.daysSinceLastContentAdded).toBe(30);
    });

    it('should handle zero completions with additions', async () => {
      const mockAdditionRows = [
        {
          last_content_added: new Date(),
          shows_added_30_days: 20,
          movies_added_30_days: 15,
        },
      ] as RowDataPacket[];
      const mockCompletionRows = [
        {
          shows_completed_30_days: 0,
          movies_completed_30_days: 0,
        },
      ] as RowDataPacket[];

      mockConnection.execute.mockResolvedValueOnce([mockAdditionRows]).mockResolvedValueOnce([mockCompletionRows]);

      const result = await getContentDiscoveryStats(123);

      expect(result.contentAdditionRate.showsPerMonth).toBe(20.0);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(15.0);
      expect(result.watchToAddRatio.shows).toBe(0);
      expect(result.watchToAddRatio.movies).toBe(0);
    });
  });
});
