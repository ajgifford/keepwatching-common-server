import { ADMIN_KEYS } from '../../constants/cacheKeys';
import * as accountComparisonRepository from '../../db/statistics/accountComparisonRepository';
import * as adminStatsRepository from '../../db/statistics/adminStatsRepository';
import * as contentPerformanceRepository from '../../db/statistics/contentPerformanceRepository';
import { BadRequestError } from '../../middleware/errorMiddleware';
import { CacheService } from '../cacheService';
import { errorService } from '../errorService';
import {
  AccountHealthMetrics,
  AccountHealthStats,
  AccountRankingStats,
  AdminDashboardStats,
  ContentEngagementStats,
  ContentPopularityStats,
  PlatformOverviewStats,
  PlatformTrendsStats,
  TrendingContentStats,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for handling admin-level statistics business logic
 */
export class AdminStatisticsService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Get platform-wide overview statistics
   *
   * @returns Platform overview metrics
   */
  public async getPlatformOverview(): Promise<PlatformOverviewStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.platformOverview(),
        async () => {
          const data = await adminStatsRepository.getPlatformOverview();

          const totalProfiles = data.total_profiles || 0;
          const totalAccounts = data.total_accounts || 0;

          return {
            totalAccounts,
            activeAccounts: data.active_accounts || 0,
            totalProfiles,
            totalShows: data.total_shows || 0,
            totalMovies: data.total_movies || 0,
            totalEpisodesWatched: data.total_episodes_watched || 0,
            totalMoviesWatched: data.total_movies_watched || 0,
            totalHoursWatched: Math.round(data.total_hours_watched || 0),
            averageProfilesPerAccount: totalAccounts > 0 ? Math.round((totalProfiles / totalAccounts) * 100) / 100 : 0,
            averageEpisodesPerAccount:
              data.active_accounts > 0
                ? Math.round((data.total_episodes_watched / data.active_accounts) * 100) / 100
                : 0,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, 'getPlatformOverview()');
    }
  }

  /**
   * Get platform trends over a period
   *
   * @param days - Number of days to analyze (default: 30)
   * @returns Platform trends with comparison to previous period
   */
  public async getPlatformTrends(days: number = 30): Promise<PlatformTrendsStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.platformTrends(days),
        async () => {
          const [trendsData, newAccountsCount, previousPeriodData] = await Promise.all([
            adminStatsRepository.getPlatformTrends(days),
            adminStatsRepository.getNewAccountsCount(days),
            adminStatsRepository.getPreviousPeriodActivity(days),
          ]);

          // Calculate totals for current period
          let currentEpisodesWatched = 0;
          let currentMoviesWatched = 0;
          const currentActiveAccounts = new Set<number>();

          trendsData.forEach((day) => {
            currentEpisodesWatched += day.episodes_watched || 0;
            currentMoviesWatched += day.movies_watched || 0;
            currentActiveAccounts.add(day.active_accounts);
          });

          // Calculate trends
          const dailyActiveUsersTrend =
            previousPeriodData.activeAccounts > 0
              ? Math.round(
                  ((currentActiveAccounts.size - previousPeriodData.activeAccounts) /
                    previousPeriodData.activeAccounts) *
                    100 *
                    100,
                ) / 100
              : 0;

          const totalPreviousActivity = previousPeriodData.episodesWatched + previousPeriodData.moviesWatched;
          const totalCurrentActivity = currentEpisodesWatched + currentMoviesWatched;
          const watchActivityTrend =
            totalPreviousActivity > 0
              ? Math.round(((totalCurrentActivity - totalPreviousActivity) / totalPreviousActivity) * 100 * 100) / 100
              : 0;

          return {
            periodDays: days,
            newAccountsInPeriod: newAccountsCount,
            episodesWatchedInPeriod: currentEpisodesWatched,
            moviesWatchedInPeriod: currentMoviesWatched,
            dailyActiveUsersTrend,
            watchActivityTrend,
            dailyActivity: trendsData.map((day) => ({
              date: day.activity_date,
              activeAccounts: day.active_accounts || 0,
              episodesWatched: day.episodes_watched || 0,
              moviesWatched: day.movies_watched || 0,
            })),
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getPlatformTrends(${days})`);
    }
  }

  /**
   * Get account rankings by a specific metric
   *
   * @param metric - Metric to rank by
   * @param limit - Maximum number of results (default: 50)
   * @returns Account rankings
   */
  public async getAccountRankings(
    metric: 'episodesWatched' | 'moviesWatched' | 'hoursWatched' | 'engagement' = 'engagement',
    limit: number = 50,
  ): Promise<AccountRankingStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.accountRankings(metric, limit),
        async () => {
          const rankings = await accountComparisonRepository.getAccountRankings(metric, limit);

          return {
            rankingMetric: metric,
            totalAccounts: rankings.length,
            rankings: rankings.map((row) => ({
              accountId: row.account_id,
              accountEmail: row.account_email,
              accountName: row.account_name,
              profileCount: row.profile_count,
              totalEpisodesWatched: row.total_episodes_watched,
              totalMoviesWatched: row.total_movies_watched,
              totalHoursWatched: Math.round(row.total_hours_watched),
              engagementScore: row.engagement_score,
              lastActivityDate: row.last_activity_date,
            })),
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountRankings(${metric}, ${limit})`);
    }
  }

  /**
   * Get health metrics for all accounts
   *
   * @returns Account health statistics
   */
  public async getAccountHealthMetrics(): Promise<AccountHealthStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.allAccountsHealth(),
        async () => {
          const healthData = await accountComparisonRepository.getAllAccountHealthMetrics();

          let totalAccounts = 0;
          let activeAccounts = 0;
          let inactiveAccounts = 0;
          let atRiskAccounts = 0;
          let totalEngagementScore = 0;
          const riskDistribution = { low: 0, medium: 0, high: 0 };

          const accounts: AccountHealthMetrics[] = healthData.map((row) => {
            totalAccounts++;

            const daysSinceActivity = row.days_since_last_activity;
            const isActive = daysSinceActivity <= 30;
            const engagementScore = this.calculateEngagementScore(
              row.days_since_last_activity,
              row.total_episodes_watched,
            );

            if (isActive) activeAccounts++;
            else inactiveAccounts++;

            const riskLevel = this.calculateRiskLevel(daysSinceActivity);
            const isAtRisk = riskLevel === 'medium' || riskLevel === 'high';

            if (isAtRisk) atRiskAccounts++;
            riskDistribution[riskLevel]++;
            totalEngagementScore += engagementScore;

            return {
              accountId: row.account_id,
              accountEmail: row.account_email,
              engagementScore,
              daysSinceLastActivity: daysSinceActivity,
              isAtRisk,
              riskLevel,
              totalEpisodesWatched: row.total_episodes_watched,
              recentEpisodesWatched: row.recent_episodes_watched,
              accountCreatedAt: row.account_created_at,
              lastActivityDate: row.last_activity_date,
              profileCount: row.profile_count,
              emailVerified: row.email_verified,
            };
          });

          return {
            totalAccounts,
            activeAccounts,
            inactiveAccounts,
            atRiskAccounts,
            averageEngagementScore:
              totalAccounts > 0 ? Math.round((totalEngagementScore / totalAccounts) * 100) / 100 : 0,
            riskDistribution,
            accounts,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, 'getAccountHealthMetrics()');
    }
  }

  /**
   * Get health metrics for a specific account
   *
   * @param accountId - Account ID
   * @returns Account health metrics
   */
  public async getAccountHealth(accountId: number): Promise<AccountHealthMetrics> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.accountHealth(accountId),
        async () => {
          const healthData = await accountComparisonRepository.getAccountHealthMetrics(accountId);

          if (!healthData) {
            throw new BadRequestError(`Account ${accountId} not found`);
          }

          const daysSinceActivity = healthData.days_since_last_activity;
          const engagementScore = this.calculateEngagementScore(daysSinceActivity, healthData.total_episodes_watched);
          const riskLevel = this.calculateRiskLevel(daysSinceActivity);
          const isAtRisk = riskLevel === 'medium' || riskLevel === 'high';

          return {
            accountId: healthData.account_id,
            accountEmail: healthData.account_email,
            engagementScore,
            daysSinceLastActivity: daysSinceActivity,
            isAtRisk,
            riskLevel,
            totalEpisodesWatched: healthData.total_episodes_watched,
            recentEpisodesWatched: healthData.recent_episodes_watched,
            accountCreatedAt: healthData.account_created_at,
            lastActivityDate: healthData.last_activity_date,
            profileCount: healthData.profile_count,
            emailVerified: healthData.email_verified,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountHealth(${accountId})`);
    }
  }

  /**
   * Get popular content across the platform
   *
   * @param contentType - Type of content (show, movie, or all)
   * @param limit - Maximum number of results (default: 20)
   * @returns Popular content statistics
   */
  public async getContentPopularity(
    contentType: 'show' | 'movie' | 'all' = 'all',
    limit: number = 20,
  ): Promise<ContentPopularityStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.contentPopularity(contentType, limit),
        async () => {
          let popularContent: Array<{
            contentId: number;
            title: string;
            contentType: 'show' | 'movie';
            accountCount: number;
            profileCount: number;
            totalWatchCount: number;
            completionRate: number;
            releaseYear?: number;
          }> = [];

          if (contentType === 'show' || contentType === 'all') {
            const shows = await contentPerformanceRepository.getPopularShows(limit);
            popularContent.push(
              ...shows.map((show) => ({
                contentId: show.content_id,
                title: show.title,
                contentType: 'show' as const,
                accountCount: show.account_count,
                profileCount: show.profile_count,
                totalWatchCount: show.total_watch_count,
                completionRate: show.completion_rate,
                releaseYear: show.release_year || undefined,
              })),
            );
          }

          if (contentType === 'movie' || contentType === 'all') {
            const movies = await contentPerformanceRepository.getPopularMovies(limit);
            popularContent.push(
              ...movies.map((movie) => ({
                contentId: movie.content_id,
                title: movie.title,
                contentType: 'movie' as const,
                accountCount: movie.account_count,
                profileCount: movie.profile_count,
                totalWatchCount: movie.total_watch_count,
                completionRate: movie.completion_rate,
                releaseYear: movie.release_year || undefined,
              })),
            );
          }

          // Sort by profile count descending
          popularContent.sort((a, b) => b.profileCount - a.profileCount);

          // Limit results
          if (contentType === 'all') {
            popularContent = popularContent.slice(0, limit);
          }

          return {
            contentType,
            resultCount: popularContent.length,
            popularContent,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentPopularity(${contentType}, ${limit})`);
    }
  }

  /**
   * Get trending content
   *
   * @param days - Number of days to analyze (default: 30)
   * @returns Trending content statistics
   */
  public async getTrendingContent(days: number = 30): Promise<TrendingContentStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.trendingContent(days),
        async () => {
          const [trendingShows, trendingMovies] = await Promise.all([
            contentPerformanceRepository.getTrendingShows(days, 10),
            contentPerformanceRepository.getTrendingMovies(days, 10),
          ]);

          const trendingContent = [
            ...trendingShows.map((show) => ({
              contentId: show.content_id,
              title: show.title,
              contentType: 'show' as const,
              newAdditions: show.new_additions,
              recentWatchCount: show.recent_watch_count,
              trendPercentage:
                show.previous_watch_count > 0
                  ? Math.round(
                      ((show.recent_watch_count - show.previous_watch_count) / show.previous_watch_count) * 100,
                    )
                  : show.recent_watch_count > 0
                    ? 100
                    : 0,
              trendDirection:
                show.recent_watch_count > show.previous_watch_count * 1.1
                  ? ('rising' as const)
                  : show.recent_watch_count < show.previous_watch_count * 0.9
                    ? ('falling' as const)
                    : ('stable' as const),
            })),
            ...trendingMovies.map((movie) => ({
              contentId: movie.content_id,
              title: movie.title,
              contentType: 'movie' as const,
              newAdditions: movie.new_additions,
              recentWatchCount: movie.recent_watch_count,
              trendPercentage:
                movie.previous_watch_count > 0
                  ? Math.round(
                      ((movie.recent_watch_count - movie.previous_watch_count) / movie.previous_watch_count) * 100,
                    )
                  : movie.recent_watch_count > 0
                    ? 100
                    : 0,
              trendDirection:
                movie.recent_watch_count > movie.previous_watch_count * 1.1
                  ? ('rising' as const)
                  : movie.recent_watch_count < movie.previous_watch_count * 0.9
                    ? ('falling' as const)
                    : ('stable' as const),
            })),
          ];

          // Sort by recent watch count
          trendingContent.sort((a, b) => b.recentWatchCount - a.recentWatchCount);

          return {
            periodDays: days,
            resultCount: trendingContent.length,
            trendingContent,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getTrendingContent(${days})`);
    }
  }

  /**
   * Get engagement metrics for specific content
   *
   * @param contentId - Content ID (show or movie)
   * @param contentType - Type of content (show or movie)
   * @returns Content engagement metrics
   */
  public async getContentEngagement(contentId: number, contentType: 'show' | 'movie'): Promise<ContentEngagementStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.contentEngagement(contentId, contentType),
        async () => {
          const engagementData =
            contentType === 'show'
              ? await contentPerformanceRepository.getShowEngagement(contentId)
              : await contentPerformanceRepository.getMovieEngagement(contentId);

          if (!engagementData) {
            throw new BadRequestError(`${contentType} ${contentId} not found`);
          }

          const totalProfiles = engagementData.total_profiles;
          const completedProfiles = engagementData.completed_profiles;
          const abandonedProfiles = engagementData.abandoned_profiles;

          return {
            contentId: engagementData.content_id,
            title: engagementData.title,
            contentType,
            totalAccounts: 0, // Would need additional query
            totalProfiles,
            completedProfiles,
            watchingProfiles: engagementData.watching_profiles,
            notStartedProfiles: engagementData.not_started_profiles,
            abandonedProfiles,
            completionRate: totalProfiles > 0 ? Math.round((completedProfiles / totalProfiles) * 100 * 100) / 100 : 0,
            abandonmentRate: totalProfiles > 0 ? Math.round((abandonedProfiles / totalProfiles) * 100 * 100) / 100 : 0,
            averageDaysToComplete: Math.round(engagementData.avg_days_to_complete || 0),
            averageProgress: Math.round(engagementData.avg_progress * 100) / 100,
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, `getContentEngagement(${contentId}, ${contentType})`);
    }
  }

  /**
   * Get combined admin dashboard statistics
   *
   * @returns Combined dashboard statistics
   */
  public async getAdminDashboard(): Promise<AdminDashboardStats> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.dashboard(),
        async () => {
          const [platformOverview, recentTrends, accountHealth, topContent] = await Promise.all([
            this.getPlatformOverview(),
            this.getPlatformTrends(30),
            this.getAccountHealthMetrics(),
            this.getContentPopularity('all', 5),
          ]);

          // Separate top shows and movies
          const topShows = topContent.popularContent.filter((c) => c.contentType === 'show');
          const topMovies = topContent.popularContent.filter((c) => c.contentType === 'movie');

          return {
            platformOverview,
            recentTrends,
            accountHealth: {
              totalAccounts: accountHealth.totalAccounts,
              activeAccounts: accountHealth.activeAccounts,
              atRiskAccounts: accountHealth.atRiskAccounts,
              averageEngagementScore: accountHealth.averageEngagementScore,
            },
            topContent: {
              topShows,
              topMovies,
            },
          };
        },
        1800, // 30 minutes cache
      );
    } catch (error) {
      throw errorService.handleError(error, 'getAdminDashboard()');
    }
  }

  /**
   * Calculate engagement score based on activity recency and total watch count
   *
   * @param daysSinceActivity - Days since last activity
   * @param totalEpisodesWatched - Total episodes watched
   * @returns Engagement score (0-100)
   * @private
   */
  private calculateEngagementScore(daysSinceActivity: number, totalEpisodesWatched: number): number {
    // Base score on recency
    let score = 0;
    if (daysSinceActivity <= 7) score = 100;
    else if (daysSinceActivity <= 30) score = 75;
    else if (daysSinceActivity <= 90) score = 50;
    else if (daysSinceActivity <= 180) score = 25;
    else score = 10;

    // Boost score based on total activity
    if (totalEpisodesWatched > 1000) score = Math.min(100, score + 10);
    else if (totalEpisodesWatched > 500) score = Math.min(100, score + 5);

    return score;
  }

  /**
   * Calculate risk level based on days since activity
   *
   * @param daysSinceActivity - Days since last activity
   * @returns Risk level
   * @private
   */
  private calculateRiskLevel(daysSinceActivity: number): 'low' | 'medium' | 'high' {
    if (daysSinceActivity <= 30) return 'low';
    if (daysSinceActivity <= 90) return 'medium';
    return 'high';
  }
}

export const adminStatisticsService = new AdminStatisticsService();
