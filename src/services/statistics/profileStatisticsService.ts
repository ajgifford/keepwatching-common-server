import { PROFILE_KEYS } from '../../constants/cacheKeys';
import { getProfileRewatchStats } from '../../db/statistics/rewatchRepository';
import * as statisticsDb from '../../db/statisticsDb';
import { CacheService } from '../cacheService';
import { errorService } from '../errorService';
import { moviesService } from '../moviesService';
import { showService } from '../showService';
import {
  AbandonmentRiskStats,
  AvailableRecapPeriods,
  BingeWatchingStats,
  ContentDepthStats,
  ContentDiscoveryStats,
  DailyActivity,
  MilestoneStats,
  MonthlyActivity,
  ProfileRecapResponse,
  ProfileRewatchStats,
  ProfileStatisticsResponse,
  RecapPeriodType,
  SeasonalViewingStats,
  TimeToWatchStats,
  UnairedContentStats,
  WatchStreakStats,
  WatchingActivityTimeline,
  WatchingVelocityStats,
  WeeklyActivity,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for handling profile-level statistics business logic
 */
export class ProfileStatisticsService {
  private cache: CacheService;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  /**
   * Get statistics (shows, movies and watch progress) for a profile
   *
   * @param profileId - ID of the profile to get statistics for
   * @returns Statistics for the profile
   */
  public async getProfileStatistics(profileId: number): Promise<ProfileStatisticsResponse> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.statistics(profileId),
        async () => {
          const showStatistics = await showService.getProfileShowStatistics(profileId);
          const movieStatistics = await moviesService.getProfileMovieStatistics(profileId);
          const episodeWatchProgress = await showService.getProfileWatchProgress(profileId);

          return { profileId: Number(profileId), showStatistics, movieStatistics, episodeWatchProgress };
        },
        1800,
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfileStatistics(${profileId})`);
    }
  }

  /**
   * Get watching velocity statistics for a profile
   * Analyzes viewing patterns over a specified time period
   *
   * @param profileId - ID of the profile to get velocity stats for
   * @param days - Number of days to analyze (default: 30)
   * @returns Watching velocity statistics
   */
  public async getWatchingVelocity(profileId: number, days: number = 30): Promise<WatchingVelocityStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.watchingVelocity(profileId, days),
        async () => {
          return await statisticsDb.getWatchingVelocityData(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getWatchingVelocity(${profileId}, ${days})`);
    }
  }

  /**
   * Get daily activity timeline for a profile
   *
   * @param profileId - ID of the profile
   * @param days - Number of days to retrieve (default: 30)
   * @returns Array of daily activity entries
   */
  public async getDailyActivity(profileId: number, days: number = 30): Promise<DailyActivity[]> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.dailyActivity(profileId, days),
        async () => {
          return await statisticsDb.getDailyActivityTimeline(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getDailyActivity(${profileId}, ${days})`);
    }
  }

  /**
   * Get weekly activity timeline for a profile
   *
   * @param profileId - ID of the profile
   * @param weeks - Number of weeks to retrieve (default: 12)
   * @returns Array of weekly activity entries
   */
  public async getWeeklyActivity(profileId: number, weeks: number = 12): Promise<WeeklyActivity[]> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.weeklyActivity(profileId, weeks),
        async () => {
          return await statisticsDb.getWeeklyActivityTimeline(profileId, weeks);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getWeeklyActivity(${profileId}, ${weeks})`);
    }
  }

  /**
   * Get monthly activity timeline for a profile
   *
   * @param profileId - ID of the profile
   * @param months - Number of months to retrieve (default: 12)
   * @returns Array of monthly activity entries
   */
  public async getMonthlyActivity(profileId: number, months: number = 12): Promise<MonthlyActivity[]> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.monthlyActivity(profileId, months),
        async () => {
          return await statisticsDb.getMonthlyActivityTimeline(profileId, months);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getMonthlyActivity(${profileId}, ${months})`);
    }
  }

  /**
   * Get comprehensive activity timeline for a profile
   * Combines daily, weekly, and monthly activity data
   *
   * @param profileId - ID of the profile
   * @returns Complete activity timeline
   */
  public async getActivityTimeline(profileId: number, days: number = 36500): Promise<WatchingActivityTimeline> {
    try {
      const weeks = Math.ceil(days / 7);
      const months = Math.max(1, Math.ceil(days / 30));

      const [dailyActivity, weeklyActivity, monthlyActivity] = await Promise.all([
        this.getDailyActivity(profileId, days),
        this.getWeeklyActivity(profileId, weeks),
        this.getMonthlyActivity(profileId, months),
      ]);

      return {
        dailyActivity,
        weeklyActivity,
        monthlyActivity,
      };
    } catch (error) {
      throw errorService.handleError(error, `getActivityTimeline(${profileId}, ${days})`);
    }
  }

  /**
   * Get binge-watching statistics for a profile
   * Identifies sessions where 3+ episodes were watched within 24 hours
   *
   * @param profileId - ID of the profile
   * @returns Binge-watching statistics
   */
  public async getBingeWatchingStats(profileId: number, days: number = 36500): Promise<BingeWatchingStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.bingeWatchingStats(profileId, days),
        async () => {
          return await statisticsDb.getBingeWatchingStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getBingeWatchingStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get watch streak statistics for a profile
   * Tracks consecutive days with watching activity
   *
   * @param profileId - ID of the profile
   * @returns Watch streak statistics
   */
  public async getWatchStreakStats(profileId: number, days: number = 36500): Promise<WatchStreakStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.watchStreakStats(profileId, days),
        async () => {
          return await statisticsDb.getWatchStreakStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getWatchStreakStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get time-to-watch statistics for a profile
   * Analyzes how long content sits before being watched and completion rates
   *
   * @param profileId - ID of the profile
   * @returns Time-to-watch statistics
   */
  public async getTimeToWatchStats(profileId: number, days: number = 36500): Promise<TimeToWatchStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.timeToWatchStats(profileId, days),
        async () => {
          return await statisticsDb.getTimeToWatchStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getTimeToWatchStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get seasonal viewing pattern statistics for a profile
   * Analyzes viewing patterns by month and season
   *
   * @param profileId - ID of the profile
   * @returns Seasonal viewing statistics
   */
  public async getSeasonalViewingStats(profileId: number, days: number = 36500): Promise<SeasonalViewingStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.seasonalViewingStats(profileId, days),
        async () => {
          return await statisticsDb.getSeasonalViewingStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getSeasonalViewingStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get milestone statistics for a profile
   * Tracks viewing milestones and achievements
   *
   * @param profileId - ID of the profile
   * @returns Milestone statistics
   */
  public async getMilestoneStats(profileId: number): Promise<MilestoneStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.milestoneStats(profileId),
        async () => {
          return await statisticsDb.getMilestoneStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getMilestoneStats(${profileId})`);
    }
  }

  /**
   * Get content depth statistics for a profile
   * Analyzes preferences for content length, release years, and maturity ratings
   *
   * @param profileId - ID of the profile
   * @returns Content depth statistics
   */
  public async getContentDepthStats(profileId: number, days: number = 36500): Promise<ContentDepthStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.contentDepthStats(profileId, days),
        async () => {
          return await statisticsDb.getContentDepthStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentDepthStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get content discovery statistics for a profile
   * Analyzes content addition patterns and watch-to-add ratios
   *
   * @param profileId - ID of the profile
   * @returns Content discovery statistics
   */
  public async getContentDiscoveryStats(profileId: number, days: number = 30): Promise<ContentDiscoveryStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.contentDiscoveryStats(profileId, days),
        async () => {
          return await statisticsDb.getContentDiscoveryStats(profileId, days);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentDiscoveryStats(${profileId}, ${days})`);
    }
  }

  /**
   * Get abandonment risk statistics for a profile
   * Identifies shows at risk of being abandoned and calculates abandonment rates
   *
   * @param profileId - ID of the profile
   * @returns Abandonment risk statistics
   */
  public async getAbandonmentRiskStats(profileId: number): Promise<AbandonmentRiskStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.abandonmentRiskStats(profileId),
        async () => {
          return await statisticsDb.getAbandonmentRiskStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getAbandonmentRiskStats(${profileId})`);
    }
  }

  /**
   * Get unaired content statistics for a profile
   * Counts shows, seasons, movies, and episodes awaiting release
   *
   * @param profileId - ID of the profile
   * @returns Unaired content statistics
   */
  public async getUnairedContentStats(profileId: number): Promise<UnairedContentStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.unairedContentStats(profileId),
        async () => {
          return await statisticsDb.getUnairedContentStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getUnairedContentStats(${profileId})`);
    }
  }

  /**
   * Get rewatch statistics for a profile
   * Returns totals and most-rewatched shows/movies
   *
   * @param profileId - ID of the profile
   * @returns Rewatch statistics
   */
  public async getRewatchStats(profileId: number): Promise<ProfileRewatchStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.rewatchStats(profileId),
        async () => {
          return await getProfileRewatchStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getRewatchStats(${profileId})`);
    }
  }

  /**
   * Get a period-scoped recap ("year/month in review") for a profile
   * Closed periods (past months/years) are cached indefinitely since their data can't change;
   * the current in-progress period uses a short TTL
   *
   * @param profileId - ID of the profile
   * @param period - Whether to recap a calendar month or calendar year
   * @param year - Calendar year of the period
   * @param month - Calendar month (1-12) of the period, required when period is 'month'
   * @returns The profile's recap for the period
   */
  public async getProfileRecap(
    profileId: number,
    period: RecapPeriodType,
    year: number,
    month?: number,
  ): Promise<ProfileRecapResponse> {
    try {
      const { startDate, endDate, isClosedPeriod } = resolveRecapDateRange(period, year, month);

      return await this.cache.getOrSet(
        PROFILE_KEYS.recap(profileId, period, year, month),
        async () => {
          return await statisticsDb.getRecapStats(profileId, period, year, month, startDate, endDate);
        },
        isClosedPeriod ? 0 : 1800,
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfileRecap(${profileId}, ${period}, ${year}, ${month})`);
    }
  }

  /**
   * Get the distinct calendar years and months that have watch activity for a profile
   * Used to bound recap navigation so the UI never shows an empty period
   *
   * @param profileId - ID of the profile
   * @returns Available recap periods
   */
  public async getAvailableRecapPeriods(profileId: number): Promise<AvailableRecapPeriods> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.recapAvailable(profileId),
        async () => {
          return await statisticsDb.getAvailableRecapPeriods(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getAvailableRecapPeriods(${profileId})`);
    }
  }
}

/**
 * Resolve a (period, year, month) tuple to explicit date boundaries
 *
 * @param period - Whether the range is a calendar month or calendar year
 * @param year - Calendar year of the period
 * @param month - Calendar month (1-12), required when period is 'month'
 * @returns Inclusive start/end dates (YYYY-MM-DD) and whether the period has fully closed
 */
export function resolveRecapDateRange(
  period: RecapPeriodType,
  year: number,
  month?: number,
): { startDate: string; endDate: string; isClosedPeriod: boolean } {
  let startDate: string;
  let endDate: string;

  if (period === 'month') {
    if (!month) {
      throw new Error('month is required when period is "month"');
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  const today = new Date().toISOString().split('T')[0];
  const isClosedPeriod = endDate < today;

  return { startDate, endDate, isClosedPeriod };
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createProfileStatisticsService(dependencies?: {
  cacheService?: CacheService;
}): ProfileStatisticsService {
  return new ProfileStatisticsService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: ProfileStatisticsService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getProfileStatisticsService(): ProfileStatisticsService {
  if (!instance) {
    instance = createProfileStatisticsService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetProfileStatisticsService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { profileStatisticsService }` continues to work
 */
export const profileStatisticsService = getProfileStatisticsService();
