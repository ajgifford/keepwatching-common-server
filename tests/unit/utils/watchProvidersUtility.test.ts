import pool from '@utils/db';
import {
  getCachedStreamingServiceIds,
  getUSWatchProviders,
  loadStreamingService,
  setCachedStreamingServiceIds,
} from '@utils/watchProvidersUtility';

// Mock the database pool
jest.mock('@utils/db', () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
}));

describe('watchProvidersUtility', () => {
  beforeEach(() => {
    // Clear the cache before each test
    setCachedStreamingServiceIds([]);
  });

  describe('getCachedStreamingServiceIds and setCachedStreamingServiceIds', () => {
    it('should get and set cached streaming service IDs', () => {
      // Initially empty
      expect(getCachedStreamingServiceIds()).toEqual([]);

      // Set some IDs
      const ids = [1, 2, 3];
      setCachedStreamingServiceIds(ids);

      // Verify the IDs were cached
      expect(getCachedStreamingServiceIds()).toEqual([1, 2, 3]);
    });
  });

  describe('getUSWatchProviders', () => {
    it('should return streaming service IDs from US flatrate providers when available', () => {
      // Setup cached streaming service IDs
      setCachedStreamingServiceIds([1, 2, 3, 8, 9]);

      // Create a test content details object
      const contentDetails = {
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
              flatrate: [
                { provider_id: 1, provider_name: 'Netflix', logo_path: '/logo1.png', display_priority: 1 },
                { provider_id: 8, provider_name: 'HBO Max', logo_path: '/logo8.png', display_priority: 2 },
                { provider_id: 10, provider_name: 'Disney+', logo_path: '/logo10.png', display_priority: 3 },
              ],
            },
          },
        },
      };

      const defaultProviderId = 99;
      const result = getUSWatchProviders(contentDetails, defaultProviderId);

      // Should only include provider IDs 1 and 8 (which are in the cached IDs)
      expect(result).toEqual([1, 8]);
    });

    it('should return default provider ID when US providers exist but none match cached IDs', () => {
      // Setup cached streaming service IDs
      setCachedStreamingServiceIds([100, 200, 300]);

      // Create a test content details object
      const contentDetails = {
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
              flatrate: [
                { provider_id: 1, provider_name: 'Netflix', logo_path: '/logo1.png', display_priority: 1 },
                { provider_id: 8, provider_name: 'HBO Max', logo_path: '/logo8.png', display_priority: 2 },
              ],
            },
          },
        },
      };

      const defaultProviderId = 99;
      const result = getUSWatchProviders(contentDetails, defaultProviderId);

      // None of the provided IDs match cached IDs
      expect(result).toEqual([defaultProviderId]);
    });

    it('should return default provider ID when US providers do not exist', () => {
      // Setup cached streaming service IDs
      setCachedStreamingServiceIds([1, 2, 3]);

      // Create a test content details object with no US providers
      const contentDetails = {
        'watch/providers': {
          results: {
            UK: {
              link: 'https://example.com',
              flatrate: [{ provider_id: 1, provider_name: 'Netflix', logo_path: '/logo1.png', display_priority: 1 }],
            },
          },
        },
      };

      const defaultProviderId = 99;
      const result = getUSWatchProviders(contentDetails, defaultProviderId);

      expect(result).toEqual([defaultProviderId]);
    });

    it('should return default provider ID when flatrate is not available', () => {
      // Setup cached streaming service IDs
      setCachedStreamingServiceIds([1, 2, 3]);

      // Create a test content details object with US providers but no flatrate
      const contentDetails = {
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
              flatrate: [], // Empty flatrate
            },
          },
        },
      };

      const defaultProviderId = 99;
      const result = getUSWatchProviders(contentDetails, defaultProviderId);

      expect(result).toEqual([defaultProviderId]);
    });
  });

  describe('loadStreamingService', () => {
    it('should load streaming services from the database', async () => {
      // Mock the database response
      const mockRows = [{ id: 1 }, { id: 2 }, { id: 8 }];

      (pool.execute as jest.Mock).mockResolvedValue([mockRows]);

      await loadStreamingService();

      // Verify the SQL query
      expect(pool.execute).toHaveBeenCalledWith('SELECT id FROM streaming_services');

      // Verify the cached IDs were updated
      expect(getCachedStreamingServiceIds()).toEqual([1, 2, 8]);
    });

    it('should handle empty results from database', async () => {
      // Mock an empty database response
      (pool.execute as jest.Mock).mockResolvedValue([[]]);

      await loadStreamingService();

      // Verify the cached IDs were updated to empty
      expect(getCachedStreamingServiceIds()).toEqual([]);
    });

    it('should propagate database errors', async () => {
      // Mock a database error
      const dbError = new Error('Database connection error');
      (pool.execute as jest.Mock).mockRejectedValue(dbError);

      await expect(loadStreamingService()).rejects.toThrow('Database connection error');
    });
  });
});
