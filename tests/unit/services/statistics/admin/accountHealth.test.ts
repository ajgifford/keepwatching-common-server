import * as accountComparisonRepository from '@db/statistics/accountComparisonRepository';
import { BadRequestError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import {
  AdminStatisticsService,
  createAdminStatisticsService,
  resetAdminStatisticsService,
} from '@services/statistics/adminStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');
jest.mock('@db/statistics/accountComparisonRepository');

describe('AdminStatisticsService - Account Health', () => {
  let adminStatisticsService: AdminStatisticsService;
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resetAdminStatisticsService();

    adminStatisticsService = createAdminStatisticsService({
      cacheService: mockCacheService as any,
      serviceName: 'test-service',
    });
  });

  afterEach(() => {
    resetAdminStatisticsService();
    jest.resetModules();
  });

  describe('getAccountHealthMetrics', () => {
    it('should return account health metrics from cache if available', async () => {
      const mockHealthMetrics = {
        totalAccounts: 100,
        activeAccounts: 60,
        inactiveAccounts: 40,
        atRiskAccounts: 15,
        averageEngagementScore: 75.5,
        riskDistribution: { low: 60, medium: 25, high: 15 },
        accounts: [],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockHealthMetrics);

      const result = await adminStatisticsService.getAccountHealthMetrics();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_accounts_health_all', expect.any(Function), 1800);
      expect(result).toEqual(mockHealthMetrics);
      expect(accountComparisonRepository.getAllAccountHealthMetrics).not.toHaveBeenCalled();
    });

    it('should fetch and calculate account health metrics on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = [
        {
          account_id: 1,
          account_email: 'user1@example.com',
          days_since_last_activity: 5,
          total_episodes_watched: 1200,
          recent_episodes_watched: 50,
          account_created_at: new Date('2023-01-01'),
          last_activity_date: new Date('2025-10-28'),
          profile_count: 3,
          email_verified: true,
        },
        {
          account_id: 2,
          account_email: 'user2@example.com',
          days_since_last_activity: 45,
          total_episodes_watched: 300,
          recent_episodes_watched: 10,
          account_created_at: new Date('2024-01-01'),
          last_activity_date: new Date('2025-09-18'),
          profile_count: 2,
          email_verified: true,
        },
        {
          account_id: 3,
          account_email: 'user3@example.com',
          days_since_last_activity: 120,
          total_episodes_watched: 50,
          recent_episodes_watched: 0,
          account_created_at: new Date('2024-06-01'),
          last_activity_date: new Date('2025-07-04'),
          profile_count: 1,
          email_verified: false,
        },
      ];

      (accountComparisonRepository.getAllAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealthMetrics();

      expect(accountComparisonRepository.getAllAccountHealthMetrics).toHaveBeenCalledTimes(1);
      expect(result.totalAccounts).toBe(3);
      expect(result.activeAccounts).toBe(1); // Only account 1 (5 days)
      expect(result.inactiveAccounts).toBe(2); // Accounts 2 and 3
      expect(result.atRiskAccounts).toBe(2); // Accounts 2 (medium) and 3 (high)
      expect(result.riskDistribution.low).toBe(1);
      expect(result.riskDistribution.medium).toBe(1);
      expect(result.riskDistribution.high).toBe(1);
      expect(result.accounts).toHaveLength(3);
    });

    it('should calculate engagement scores correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = [
        {
          account_id: 1,
          account_email: 'active@example.com',
          days_since_last_activity: 3,
          total_episodes_watched: 1500,
          recent_episodes_watched: 100,
          account_created_at: new Date('2023-01-01'),
          last_activity_date: new Date(),
          profile_count: 2,
          email_verified: true,
        },
      ];

      (accountComparisonRepository.getAllAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealthMetrics();

      // Engagement score for 3 days + 1500 episodes (>1000) = 100 + 10 = 100 (capped)
      expect(result.accounts[0].engagementScore).toBe(100);
      expect(result.accounts[0].isAtRisk).toBe(false);
      expect(result.accounts[0].riskLevel).toBe('low');
    });

    it('should calculate risk levels correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = [
        {
          account_id: 1,
          account_email: 'low@example.com',
          days_since_last_activity: 15,
          total_episodes_watched: 100,
          recent_episodes_watched: 10,
          account_created_at: new Date('2024-01-01'),
          last_activity_date: new Date(),
          profile_count: 1,
          email_verified: true,
        },
        {
          account_id: 2,
          account_email: 'medium@example.com',
          days_since_last_activity: 60,
          total_episodes_watched: 100,
          recent_episodes_watched: 5,
          account_created_at: new Date('2024-01-01'),
          last_activity_date: new Date(),
          profile_count: 1,
          email_verified: true,
        },
        {
          account_id: 3,
          account_email: 'high@example.com',
          days_since_last_activity: 150,
          total_episodes_watched: 50,
          recent_episodes_watched: 0,
          account_created_at: new Date('2024-01-01'),
          last_activity_date: new Date(),
          profile_count: 1,
          email_verified: true,
        },
      ];

      (accountComparisonRepository.getAllAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealthMetrics();

      expect(result.accounts[0].riskLevel).toBe('low');
      expect(result.accounts[0].isAtRisk).toBe(false);

      expect(result.accounts[1].riskLevel).toBe('medium');
      expect(result.accounts[1].isAtRisk).toBe(true);

      expect(result.accounts[2].riskLevel).toBe('high');
      expect(result.accounts[2].isAtRisk).toBe(true);
    });

    it('should handle empty health data', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAllAccountHealthMetrics as jest.Mock).mockResolvedValue([]);

      const result = await adminStatisticsService.getAccountHealthMetrics();

      expect(result.totalAccounts).toBe(0);
      expect(result.activeAccounts).toBe(0);
      expect(result.inactiveAccounts).toBe(0);
      expect(result.atRiskAccounts).toBe(0);
      expect(result.averageEngagementScore).toBe(0);
      expect(result.accounts).toHaveLength(0);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database connection failed');
      (accountComparisonRepository.getAllAccountHealthMetrics as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getAccountHealthMetrics()).rejects.toThrow(
        'Handled: Database connection failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountHealthMetrics()');
    });
  });

  describe('getAccountHealth', () => {
    it('should return account health from cache if available', async () => {
      const mockHealth = {
        accountId: 123,
        accountEmail: 'test@example.com',
        engagementScore: 85,
        daysSinceLastActivity: 10,
        isAtRisk: false,
        riskLevel: 'low' as const,
        totalEpisodesWatched: 500,
        recentEpisodesWatched: 25,
        accountCreatedAt: new Date('2023-01-01'),
        lastActivityDate: new Date('2025-10-23'),
        profileCount: 2,
        emailVerified: true,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockHealth);

      const result = await adminStatisticsService.getAccountHealth(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_accounts_123_health', expect.any(Function), 1800);
      expect(result).toEqual(mockHealth);
      expect(accountComparisonRepository.getAccountHealthMetrics).not.toHaveBeenCalled();
    });

    it('should fetch and calculate account health on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = {
        account_id: 123,
        account_email: 'test@example.com',
        days_since_last_activity: 10,
        total_episodes_watched: 500,
        recent_episodes_watched: 25,
        account_created_at: new Date('2023-01-01'),
        last_activity_date: new Date('2025-10-23'),
        profile_count: 2,
        email_verified: true,
      };

      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealth(123);

      expect(accountComparisonRepository.getAccountHealthMetrics).toHaveBeenCalledWith(123);
      expect(result.accountId).toBe(123);
      expect(result.accountEmail).toBe('test@example.com');
      expect(result.daysSinceLastActivity).toBe(10);
      expect(result.riskLevel).toBe('low');
      expect(result.isAtRisk).toBe(false);
    });

    it('should throw BadRequestError when account not found', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockResolvedValue(null);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(adminStatisticsService.getAccountHealth(999)).rejects.toThrow(BadRequestError);
      await expect(adminStatisticsService.getAccountHealth(999)).rejects.toThrow('Account 999 not found');
    });

    it('should calculate engagement score for highly active account', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = {
        account_id: 123,
        account_email: 'active@example.com',
        days_since_last_activity: 2,
        total_episodes_watched: 2000,
        recent_episodes_watched: 100,
        account_created_at: new Date('2023-01-01'),
        last_activity_date: new Date(),
        profile_count: 3,
        email_verified: true,
      };

      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealth(123);

      // Engagement: 7 days or less = 100, >1000 episodes = +10 boost = 100 (capped)
      expect(result.engagementScore).toBe(100);
      expect(result.riskLevel).toBe('low');
    });

    it('should calculate engagement score for moderately active account', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = {
        account_id: 123,
        account_email: 'moderate@example.com',
        days_since_last_activity: 20,
        total_episodes_watched: 600,
        recent_episodes_watched: 30,
        account_created_at: new Date('2023-01-01'),
        last_activity_date: new Date(),
        profile_count: 2,
        email_verified: true,
      };

      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealth(123);

      // Engagement: 8-30 days = 75, 500-1000 episodes = +5 boost = 80
      expect(result.engagementScore).toBe(80);
      expect(result.riskLevel).toBe('low');
    });

    it('should calculate engagement score for at-risk account', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockHealthData = {
        account_id: 123,
        account_email: 'atrisk@example.com',
        days_since_last_activity: 100,
        total_episodes_watched: 200,
        recent_episodes_watched: 5,
        account_created_at: new Date('2023-01-01'),
        last_activity_date: new Date(),
        profile_count: 1,
        email_verified: true,
      };

      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await adminStatisticsService.getAccountHealth(123);

      // Engagement: 91-180 days = 25, no boost = 25
      expect(result.engagementScore).toBe(25);
      expect(result.riskLevel).toBe('high');
      expect(result.isAtRisk).toBe(true);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (accountComparisonRepository.getAccountHealthMetrics as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getAccountHealth(123)).rejects.toThrow('Handled: Database query failed');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountHealth(123)');
    });
  });
});
