import pool from '@utils/db';
import {
  getCachedStreamingServiceIds,
  getUSWatchProviders,
  loadStreamingService,
  setCachedStreamingServiceIds,
} from '@utils/watchProvidersUtility';

jest.mock('@utils/db', () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
}));

describe('watchProvidersUtility', () => {
  beforeEach(() => {
    setCachedStreamingServiceIds([]);
  });

  describe('getCachedStreamingServiceIds and setCachedStreamingServiceIds', () => {
    it('should get and set cached streaming service IDs', () => {
      expect(getCachedStreamingServiceIds()).toEqual([]);

      const ids = [1, 2, 3];
      setCachedStreamingServiceIds(ids);

      expect(getCachedStreamingServiceIds()).toEqual([1, 2, 3]);
    });
  });

  describe('getUSWatchProviders', () => {
    it('should return streaming service IDs from US flatrate providers when available', () => {
      setCachedStreamingServiceIds([1, 2, 3, 8, 9]);

      const contentDetails = {
        id: 1,
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

      expect(result).toEqual([1, 8]);
    });

    it('should return default provider ID when US providers exist but none match cached IDs', () => {
      setCachedStreamingServiceIds([100, 200, 300]);

      const contentDetails = {
        id: 1,
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

      expect(result).toEqual([defaultProviderId]);
    });

    it('should return default provider ID when US providers do not exist', () => {
      setCachedStreamingServiceIds([1, 2, 3]);

      const contentDetails = {
        id: 1,
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
      setCachedStreamingServiceIds([1, 2, 3]);

      const contentDetails = {
        id: 1,
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
              flatrate: [],
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
      const mockRows = [{ id: 1 }, { id: 2 }, { id: 8 }];

      (pool.execute as jest.Mock).mockResolvedValue([mockRows]);

      await loadStreamingService();

      expect(pool.execute).toHaveBeenCalledWith('SELECT id FROM streaming_services');
      expect(getCachedStreamingServiceIds()).toEqual([1, 2, 8]);
    });

    it('should handle empty results from database', async () => {
      (pool.execute as jest.Mock).mockResolvedValue([[]]);
      await loadStreamingService();
      expect(getCachedStreamingServiceIds()).toEqual([]);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection error');
      (pool.execute as jest.Mock).mockRejectedValue(dbError);

      await expect(loadStreamingService()).rejects.toThrow('Database connection error');
    });
  });
});
