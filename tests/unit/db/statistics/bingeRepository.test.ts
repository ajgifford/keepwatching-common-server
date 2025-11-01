import { getBingeWatchingStats } from '@db/statistics/bingeRepository';
import { getDbPool } from '@utils/db';

const mockDbMonitorInstance = {
  executeWithTiming: jest.fn((name: string, fn: () => any) => fn()),
};

// Mock dependencies
jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
}));

jest.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: jest.fn(() => mockDbMonitorInstance),
  },
}));

describe('bingeRepository', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Create mock pool
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
    };

    // Set up getDbPool to return mock pool
    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    // Reset DbMonitor mock
    mockDbMonitorInstance.executeWithTiming.mockClear();
    mockDbMonitorInstance.executeWithTiming.mockImplementation((name: string, fn: () => any) => fn());
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
  });
});
