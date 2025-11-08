import { TMDBMovie } from '../../../src/types/tmdbTypes';
import pool from '@utils/db';
import {
  getCachedStreamingServiceIds,
  getUSWatchProvidersMovie,
  getUSWatchProvidersShow,
  loadStreamingService,
  setCachedStreamingServiceIds,
} from '@utils/watchProvidersUtility';
import { TMDBShow } from 'dist/types/tmdbTypes';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/db', () => ({
  __esModule: true,
  default: {
    execute: vi.fn(),
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

  describe('getUSWatchProvidersMovie', () => {
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
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([1, 8]);
    });

    it('should return unavailable when US providers exist but none match cached IDs', () => {
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
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([9997]);
    });

    it('should return unavailable when US providers do not exist', () => {
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
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([9997]);
    });

    it('should return theater when there are no providers and the release date is last 90 days', () => {
      setCachedStreamingServiceIds([1, 2, 3]);

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const contentDetails = {
        id: 1,
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
            },
          },
        },
        release_date: thirtyDaysAgo.toISOString(),
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([9998]);
    });

    it('should return coming soon when there are no providers and the release date is in the future', () => {
      setCachedStreamingServiceIds([1, 2, 3]);

      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const contentDetails = {
        id: 1,
        'watch/providers': {
          results: {
            US: {
              link: 'https://example.com',
            },
          },
        },
        release_date: thirtyDaysFromNow.toISOString(),
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([9996]);
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
      } as unknown as TMDBMovie;

      const result = getUSWatchProvidersMovie(contentDetails);

      expect(result).toEqual([9997]);
    });
  });

  describe('getUSWatchProvidersShow', () => {
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
      } as unknown as TMDBShow;

      const result = getUSWatchProvidersShow(contentDetails);

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
      } as unknown as TMDBShow;

      const result = getUSWatchProvidersShow(contentDetails);

      expect(result).toEqual([9999]);
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
      } as unknown as TMDBShow;

      const result = getUSWatchProvidersShow(contentDetails);

      expect(result).toEqual([9999]);
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
      } as unknown as TMDBShow;

      const result = getUSWatchProvidersShow(contentDetails);

      expect(result).toEqual([9999]);
    });
  });

  describe('loadStreamingService', () => {
    it('should load streaming services from the database', async () => {
      const mockRows = [{ id: 1 }, { id: 2 }, { id: 8 }];

      (pool.execute as Mock).mockResolvedValue([mockRows]);

      await loadStreamingService();

      expect(pool.execute).toHaveBeenCalledWith('SELECT id FROM streaming_services');
      expect(getCachedStreamingServiceIds()).toEqual([1, 2, 8]);
    });

    it('should handle empty results from database', async () => {
      (pool.execute as Mock).mockResolvedValue([[]]);
      await loadStreamingService();
      expect(getCachedStreamingServiceIds()).toEqual([]);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection error');
      (pool.execute as Mock).mockRejectedValue(dbError);

      await expect(loadStreamingService()).rejects.toThrow('Database connection error');
    });
  });
});
