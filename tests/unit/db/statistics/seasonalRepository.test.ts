import { getSeasonalViewingStats } from '@db/statistics/seasonalRepository';
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

describe('statisticsDb', () => {
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
  });
});
