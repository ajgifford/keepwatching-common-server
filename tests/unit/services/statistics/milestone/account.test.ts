import * as accountsDb from '@db/accountsDb';
import { BadRequestError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import {
  AccountStatisticsService,
  createAccountStatisticsService,
  resetAccountStatisticsService,
} from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');
jest.mock('@services/profileService');
jest.mock('@services/statistics/profileStatisticsService');
jest.mock('@db/accountsDb');

describe('Statistics - Milestone - Account', () => {
  let accountStatisticsService: AccountStatisticsService;
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resetAccountStatisticsService();

    accountStatisticsService = createAccountStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetAccountStatisticsService();
    jest.resetModules();
  });

  describe('getAccountMilestoneStats', () => {
    it('should return account milestone stats from cache if available', async () => {
      const mockStats = {
        totalEpisodesWatched: 3000,
        totalMoviesWatched: 500,
        totalHoursWatched: 5000,
        milestones: [],
        recentAchievements: [
          {
            name: '1000 Episodes',
            description: 'Watched 1000 episodes',
            achievedDate: '2024-01-01',
            category: 'episodes',
          },
        ],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountMilestoneStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_milestone_stats', expect.any(Function), 3600);
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account milestone stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        totalEpisodesWatched: 1500,
        totalMoviesWatched: 250,
        totalHoursWatched: 2500,
        milestones: [],
        recentAchievements: [
          {
            name: '1000 Episodes',
            description: 'Watched 1000 episodes',
            achievedDate: '2024-01-01',
            category: 'episodes',
          },
        ],
      };
      const profile2Stats = {
        totalEpisodesWatched: 1200,
        totalMoviesWatched: 200,
        totalHoursWatched: 2000,
        milestones: [],
        recentAchievements: [
          {
            name: '1000 Episodes',
            description: 'Watched 1000 episodes',
            achievedDate: '2024-02-01',
            category: 'episodes',
          },
        ],
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue({ id: 1, createdAt: new Date('2024-01-01') });
      (profileStatisticsService.getMilestoneStats as jest.Mock).mockImplementation(async (id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountMilestoneStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_milestone_stats', expect.any(Function), 3600);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.totalEpisodesWatched).toBe(2700);
      expect(result.totalMoviesWatched).toBe(450);
      expect(result.totalHoursWatched).toBe(4500);
    });

    it('should handle errors when getting account milestone stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue({ id: 1, createdAt: new Date('2024-01-01') });

      const error = new Error('Failed to get milestone stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getMilestoneStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountMilestoneStats(1)).rejects.toThrow(
        'Handled: Failed to get milestone stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountMilestoneStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountMilestoneStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
