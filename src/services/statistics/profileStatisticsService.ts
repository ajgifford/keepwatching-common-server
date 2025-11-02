import { PROFILE_KEYS } from '../../constants/cacheKeys';
import * as statisticsDb from '../../db/statisticsDb';
import { CacheService } from '../cacheService';
import { errorService } from '../errorService';
import { moviesService } from '../moviesService';
import { showService } from '../showService';
import {
  AbandonmentRiskStats,
  BingeWatchingStats,
  ContentDepthStats,
  ContentDiscoveryStats,
  DailyActivity,
  MilestoneStats,
  MonthlyActivity,
  ProfileStatisticsResponse,
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

  constructor() {
    this.cache = CacheService.getInstance();
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
  public async getActivityTimeline(profileId: number): Promise<WatchingActivityTimeline> {
    try {
      const [dailyActivity, weeklyActivity, monthlyActivity] = await Promise.all([
        this.getDailyActivity(profileId, 30),
        this.getWeeklyActivity(profileId, 12),
        this.getMonthlyActivity(profileId, 12),
      ]);

      return {
        dailyActivity,
        weeklyActivity,
        monthlyActivity,
      };
    } catch (error) {
      throw errorService.handleError(error, `getActivityTimeline(${profileId})`);
    }
  }

  /**
   * Get binge-watching statistics for a profile
   * Identifies sessions where 3+ episodes were watched within 24 hours
   *
   * @param profileId - ID of the profile
   * @returns Binge-watching statistics
   */
  public async getBingeWatchingStats(profileId: number): Promise<BingeWatchingStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.bingeWatchingStats(profileId),
        async () => {
          return await statisticsDb.getBingeWatchingStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getBingeWatchingStats(${profileId})`);
    }
  }

  /**
   * Get watch streak statistics for a profile
   * Tracks consecutive days with watching activity
   *
   * @param profileId - ID of the profile
   * @returns Watch streak statistics
   */
  public async getWatchStreakStats(profileId: number): Promise<WatchStreakStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.watchStreakStats(profileId),
        async () => {
          return await statisticsDb.getWatchStreakStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getWatchStreakStats(${profileId})`);
    }
  }

  /**
   * Get time-to-watch statistics for a profile
   * Analyzes how long content sits before being watched and completion rates
   *
   * @param profileId - ID of the profile
   * @returns Time-to-watch statistics
   */
  public async getTimeToWatchStats(profileId: number): Promise<TimeToWatchStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.timeToWatchStats(profileId),
        async () => {
          return await statisticsDb.getTimeToWatchStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getTimeToWatchStats(${profileId})`);
    }
  }

  /**
   * Get seasonal viewing pattern statistics for a profile
   * Analyzes viewing patterns by month and season
   *
   * @param profileId - ID of the profile
   * @returns Seasonal viewing statistics
   */
  public async getSeasonalViewingStats(profileId: number): Promise<SeasonalViewingStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.seasonalViewingStats(profileId),
        async () => {
          return await statisticsDb.getSeasonalViewingStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getSeasonalViewingStats(${profileId})`);
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
  public async getContentDepthStats(profileId: number): Promise<ContentDepthStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.contentDepthStats(profileId),
        async () => {
          return await statisticsDb.getContentDepthStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentDepthStats(${profileId})`);
    }
  }

  /**
   * Get content discovery statistics for a profile
   * Analyzes content addition patterns and watch-to-add ratios
   *
   * @param profileId - ID of the profile
   * @returns Content discovery statistics
   */
  public async getContentDiscoveryStats(profileId: number): Promise<ContentDiscoveryStats> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.contentDiscoveryStats(profileId),
        async () => {
          return await statisticsDb.getContentDiscoveryStats(profileId);
        },
        1800, // 30 minute TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentDiscoveryStats(${profileId})`);
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
}

export const profileStatisticsService = new ProfileStatisticsService();
