import * as statisticsDb from '@db/statisticsDb';
import { errorService } from '@services/errorService';
import {
  ProfileStatisticsService,
  createProfileStatisticsService,
  resetProfileStatisticsService,
} from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - Recap - Profile', () => {
  let profileStatisticsService: ProfileStatisticsService;
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    resetProfileStatisticsService();

    profileStatisticsService = createProfileStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetProfileStatisticsService();
    jest.resetModules();
    jest.useRealTimers();
  });

  describe('getProfileRecap', () => {
    it('should cache a closed year period indefinitely (ttl 0)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2027-01-15T00:00:00Z'));
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockResolvedValue({ profileId: 123 });

      await profileStatisticsService.getProfileRecap(123, 'year', 2026);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recap_year_2026', expect.any(Function), 0);
      expect(statisticsDb.getRecapStats).toHaveBeenCalledWith(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');
    });

    it('should use a short TTL for the current, still-open year period', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-02T00:00:00Z'));
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockResolvedValue({ profileId: 123 });

      await profileStatisticsService.getProfileRecap(123, 'year', 2026);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recap_year_2026', expect.any(Function), 1800);
    });

    it('should resolve month date boundaries and cache a closed month indefinitely', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T00:00:00Z'));
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockResolvedValue({ profileId: 123 });

      await profileStatisticsService.getProfileRecap(123, 'month', 2026, 7);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recap_month_2026_7', expect.any(Function), 0);
      expect(statisticsDb.getRecapStats).toHaveBeenCalledWith(123, 'month', 2026, 7, '2026-07-01', '2026-07-31');
    });

    it('should resolve February boundaries correctly', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00Z'));
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockResolvedValue({ profileId: 123 });

      await profileStatisticsService.getProfileRecap(123, 'month', 2026, 2);

      expect(statisticsDb.getRecapStats).toHaveBeenCalledWith(123, 'month', 2026, 2, '2026-02-01', '2026-02-28');
    });

    it('should use a short TTL for the current, still-open month period', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00Z'));
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockResolvedValue({ profileId: 123 });

      await profileStatisticsService.getProfileRecap(123, 'month', 2026, 7);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_recap_month_2026_7',
        expect.any(Function),
        1800,
      );
    });

    it('should handle errors when getting a profile recap', async () => {
      const error = new Error('Failed to get recap stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getRecapStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getProfileRecap(123, 'year', 2026)).rejects.toThrow(
        'Handled: Failed to get recap stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileRecap(123, year, 2026, undefined)');
    });
  });

  describe('getAvailableRecapPeriods', () => {
    it('should return available recap periods from cache if available', async () => {
      const mockPeriods = { years: [2025, 2026], months: [{ year: 2026, month: 7 }] };
      mockCacheService.getOrSet.mockResolvedValue(mockPeriods);

      const result = await profileStatisticsService.getAvailableRecapPeriods(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recap_available', expect.any(Function), 1800);
      expect(result).toEqual(mockPeriods);
      expect(statisticsDb.getAvailableRecapPeriods).not.toHaveBeenCalled();
    });

    it('should fetch and return available recap periods on cache miss', async () => {
      const mockPeriods = { years: [2026], months: [] };
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getAvailableRecapPeriods as jest.Mock).mockResolvedValue(mockPeriods);

      const result = await profileStatisticsService.getAvailableRecapPeriods(123);

      expect(statisticsDb.getAvailableRecapPeriods).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockPeriods);
    });

    it('should handle errors when getting available recap periods', async () => {
      const error = new Error('Failed to get available recap periods');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getAvailableRecapPeriods as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getAvailableRecapPeriods(123)).rejects.toThrow(
        'Handled: Failed to get available recap periods',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAvailableRecapPeriods(123)');
    });
  });
});
