import { BadRequestError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import {
  AccountStatisticsService,
  createAccountStatisticsService,
  resetAccountStatisticsService,
} from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@services/profileService');
vi.mock('@services/statistics/profileStatisticsService');

describe('Statistics - Abandonment - Account', () => {
  let accountStatisticsService: AccountStatisticsService;
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    resetAccountStatisticsService();

    accountStatisticsService = createAccountStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetAccountStatisticsService();
    vi.resetModules();
  });

  describe('getAccountAbandonmentRiskStats', () => {
    it('should return account abandonment risk stats from cache if available', async () => {
      const mockStats = {
        showsAtRisk: [
          {
            profileName: 'Profile 1',
            showId: 1,
            showTitle: 'The Wire',
            daysSinceLastWatch: 120,
            progressPercentage: 35,
          },
          {
            profileName: 'Profile 2',
            showId: 2,
            showTitle: 'Sopranos',
            daysSinceLastWatch: 90,
            progressPercentage: 50,
          },
        ],
        showAbandonmentRate: 18.5,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountAbandonmentRiskStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_abandonment_risk_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account abandonment risk stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        showsAtRisk: [
          { showId: 1, showTitle: 'The Wire', daysSinceLastWatch: 120, progressPercentage: 35 },
          { showId: 2, showTitle: 'Sopranos', daysSinceLastWatch: 90, progressPercentage: 50 },
        ],
        showAbandonmentRate: 15.5,
      };
      const profile2Stats = {
        showsAtRisk: [{ showId: 3, showTitle: 'Mad Men', daysSinceLastWatch: 100, progressPercentage: 40 }],
        showAbandonmentRate: 12.0,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getAbandonmentRiskStats as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountAbandonmentRiskStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_abandonment_risk_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.showsAtRisk).toHaveLength(3);
      expect(result.showAbandonmentRate).toBe(13.75);
    });

    it('should handle errors when getting account abandonment risk stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get abandonment risk stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getAbandonmentRiskStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountAbandonmentRiskStats(1)).rejects.toThrow(
        'Handled: Failed to get abandonment risk stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountAbandonmentRiskStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountAbandonmentRiskStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
