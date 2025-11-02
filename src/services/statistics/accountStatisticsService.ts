import { ACCOUNT_KEYS } from '../../constants/cacheKeys';
import { BadRequestError } from '../../middleware/errorMiddleware';
import { CacheService } from '../cacheService';
import { errorService } from '../errorService';
import { profileService } from '../profileService';
import { profileStatisticsService } from './profileStatisticsService';
import {
  AbandonmentRiskShow,
  AccountAbandonmentRiskStats,
  AccountActivityTimeline,
  AccountBingeWatchingStats,
  AccountContentDepthStats,
  AccountContentDiscoveryStats,
  AccountEpisodeProgress,
  AccountMilestoneStats,
  AccountSeasonalViewingStats,
  AccountStatisticsResponse,
  AccountTimeToWatchStats,
  AccountUnairedContentStats,
  AccountWatchStreakStats,
  AccountWatchingVelocityStats,
  Achievement,
  DailyActivity,
  MonthlyActivity,
  MovieStatisticsResponse,
  ProfileStatisticsResponse,
  ShowProgress,
  ShowStatisticsResponse,
  UniqueContentCounts,
  WeeklyActivity,
} from '@ajgifford/keepwatching-types';

/**
 * Interface for aggregated account statistics
 */
interface AggregatedStats {
  shows: ShowStatisticsResponse;
  movies: MovieStatisticsResponse;
  episodes: AccountEpisodeProgress;
  uniqueContent: UniqueContentCounts;
}

/**
 * Service class for handling account-level statistics business logic
 */
export class AccountStatisticsService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Get statistics (shows, movies and watch progress) for an account
   *
   * @param accountId - ID of the account to get statistics for
   * @returns Statistics for the account
   * @throws {BadRequestError} If no profiles found for account
   */
  public async getAccountStatistics(accountId: number): Promise<AccountStatisticsResponse> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.statistics(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => {
              return await profileStatisticsService.getProfileStatistics(profile.id);
            }),
          );

          const aggregatedStats = this.aggregateAccountStatistics(profileStats);

          return {
            profileCount: profiles.length,
            uniqueContent: aggregatedStats.uniqueContent,
            showStatistics: aggregatedStats.shows,
            movieStatistics: aggregatedStats.movies,
            episodeStatistics: aggregatedStats.episodes,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountStatistics(${accountId})`);
    }
  }

  /**
   * Aggregates statistics from multiple profiles into a single account-level view
   *
   * @param profilesStats - Array of profile statistics
   * @returns Aggregated statistics across all profiles
   * @private
   */
  private aggregateAccountStatistics(profilesStats: ProfileStatisticsResponse[]): AggregatedStats {
    if (!profilesStats.length) {
      return this.createEmptyAggregateStats();
    }

    const uniqueShowIds = new Set<number>();
    const uniqueMovieIds = new Set<number>();

    const aggregate = {
      shows: {
        total: 0,
        watchStatusCounts: { unaired: 0, watched: 0, watching: 0, notWatched: 0, upToDate: 0 },
        genreDistribution: {} as Record<string, number>,
        serviceDistribution: {} as Record<string, number>,
      },
      movies: {
        total: 0,
        watchStatusCounts: { unaired: 0, watched: 0, notWatched: 0 },
        genreDistribution: {} as Record<string, number>,
        serviceDistribution: {} as Record<string, number>,
      },
      episodes: {
        totalEpisodes: 0,
        watchedEpisodes: 0,
        unairedEpisodes: 0,
      },
    };

    profilesStats.forEach((profileStats) => {
      aggregate.shows.total += profileStats.showStatistics.total;
      aggregate.shows.watchStatusCounts.unaired += profileStats.showStatistics.watchStatusCounts.unaired;
      aggregate.shows.watchStatusCounts.watched += profileStats.showStatistics.watchStatusCounts.watched;
      aggregate.shows.watchStatusCounts.watching += profileStats.showStatistics.watchStatusCounts.watching;
      aggregate.shows.watchStatusCounts.notWatched += profileStats.showStatistics.watchStatusCounts.notWatched;
      aggregate.shows.watchStatusCounts.upToDate += profileStats.showStatistics.watchStatusCounts.upToDate || 0;

      aggregate.movies.total += profileStats.movieStatistics.total;
      aggregate.movies.watchStatusCounts.unaired += profileStats.movieStatistics.watchStatusCounts.unaired;
      aggregate.movies.watchStatusCounts.watched += profileStats.movieStatistics.watchStatusCounts.watched;
      aggregate.movies.watchStatusCounts.notWatched += profileStats.movieStatistics.watchStatusCounts.notWatched;

      aggregate.episodes.totalEpisodes += profileStats.episodeWatchProgress.totalEpisodes;
      aggregate.episodes.watchedEpisodes += profileStats.episodeWatchProgress.watchedEpisodes;
      aggregate.episodes.unairedEpisodes += profileStats.episodeWatchProgress.unairedEpisodes;

      Object.entries(profileStats.showStatistics.genreDistribution).forEach(([genre, count]) => {
        aggregate.shows.genreDistribution[genre] = (aggregate.shows.genreDistribution[genre] || 0) + (count as number);
      });

      Object.entries(profileStats.movieStatistics.genreDistribution).forEach(([genre, count]) => {
        aggregate.movies.genreDistribution[genre] =
          (aggregate.movies.genreDistribution[genre] || 0) + (count as number);
      });

      Object.entries(profileStats.showStatistics.serviceDistribution).forEach(([service, count]) => {
        aggregate.shows.serviceDistribution[service] =
          (aggregate.shows.serviceDistribution[service] || 0) + (count as number);
      });

      Object.entries(profileStats.movieStatistics.serviceDistribution).forEach(([service, count]) => {
        aggregate.movies.serviceDistribution[service] =
          (aggregate.movies.serviceDistribution[service] || 0) + (count as number);
      });

      profileStats.episodeWatchProgress.showsProgress.forEach((show: ShowProgress) => {
        uniqueShowIds.add(show.showId);
      });

      profileStats.movieStatistics.movieReferences.forEach((movie) => {
        uniqueMovieIds.add(movie.id);
      });
    });

    const showWatchProgress =
      aggregate.shows.total > 0
        ? Math.round(
            (aggregate.shows.watchStatusCounts.watched /
              (aggregate.shows.total - aggregate.shows.watchStatusCounts.unaired)) *
              100,
          )
        : 0;

    const movieWatchProgress =
      aggregate.movies.total > 0
        ? Math.round(
            (aggregate.movies.watchStatusCounts.watched /
              (aggregate.movies.total - aggregate.movies.watchStatusCounts.unaired)) *
              100,
          )
        : 0;

    const episodeWatchProgress =
      aggregate.episodes.totalEpisodes > 0
        ? Math.round(
            (aggregate.episodes.watchedEpisodes /
              (aggregate.episodes.totalEpisodes - aggregate.episodes.unairedEpisodes)) *
              100,
          )
        : 0;

    return {
      uniqueContent: {
        showCount: uniqueShowIds.size,
        movieCount: uniqueMovieIds.size,
      },
      shows: {
        ...aggregate.shows,
        watchProgress: showWatchProgress,
      },
      movies: {
        ...aggregate.movies,
        movieReferences: [],
        watchProgress: movieWatchProgress,
      },
      episodes: {
        ...aggregate.episodes,
        watchProgress: episodeWatchProgress,
      },
    };
  }

  /**
   * Creates an empty aggregated stats object
   * Used when there are no profiles or no data
   * @private
   */
  private createEmptyAggregateStats(): AggregatedStats {
    return {
      uniqueContent: {
        showCount: 0,
        movieCount: 0,
      },
      shows: {
        total: 0,
        watchStatusCounts: {
          unaired: 0,
          watched: 0,
          watching: 0,
          notWatched: 0,
          upToDate: 0,
        },
        genreDistribution: {},
        serviceDistribution: {},
        watchProgress: 0,
      },
      movies: {
        movieReferences: [],
        total: 0,
        watchStatusCounts: {
          unaired: 0,
          watched: 0,
          notWatched: 0,
        },
        genreDistribution: {},
        serviceDistribution: {},
        watchProgress: 0,
      },
      episodes: {
        totalEpisodes: 0,
        watchedEpisodes: 0,
        watchProgress: 0,
      },
    };
  }

  /**
   * Get account-level watching velocity statistics
   * Aggregates velocity data across all profiles using weighted average by profile activity
   */
  public async getAccountWatchingVelocity(accountId: number, days: number = 30): Promise<AccountWatchingVelocityStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.watchingVelocity(accountId, days),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => ({
              profileId: profile.id,
              profileName: profile.name,
              stats: await profileStatisticsService.getWatchingVelocity(profile.id, days),
            })),
          );

          // Weighted average by total episodes watched
          let totalEpisodes = 0;
          let weightedEpisodesPerWeek = 0;
          let weightedEpisodesPerMonth = 0;
          let weightedEpisodesPerDay = 0;
          const dayCount: Record<string, number> = {};
          const hourCount: Record<number, number> = {};
          const trendCount: Record<string, number> = { increasing: 0, decreasing: 0, stable: 0 };

          profileStats.forEach(({ stats }) => {
            const weight = stats.episodesPerMonth || 1;
            totalEpisodes += weight;
            weightedEpisodesPerWeek += stats.episodesPerWeek * weight;
            weightedEpisodesPerMonth += stats.episodesPerMonth * weight;
            weightedEpisodesPerDay += stats.averageEpisodesPerDay * weight;

            dayCount[stats.mostActiveDay] = (dayCount[stats.mostActiveDay] || 0) + weight;
            hourCount[stats.mostActiveHour] = (hourCount[stats.mostActiveHour] || 0) + weight;
            trendCount[stats.velocityTrend] += 1;
          });

          const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Monday';
          const mostActiveHour = Number(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
          const velocityTrend = (Object.entries(trendCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'stable') as
            | 'increasing'
            | 'decreasing'
            | 'stable';

          return {
            episodesPerWeek: totalEpisodes > 0 ? Math.round((weightedEpisodesPerWeek / totalEpisodes) * 100) / 100 : 0,
            episodesPerMonth:
              totalEpisodes > 0 ? Math.round((weightedEpisodesPerMonth / totalEpisodes) * 100) / 100 : 0,
            averageEpisodesPerDay:
              totalEpisodes > 0 ? Math.round((weightedEpisodesPerDay / totalEpisodes) * 100) / 100 : 0,
            mostActiveDay,
            mostActiveHour,
            velocityTrend,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountWatchingVelocity(${accountId}, ${days})`);
    }
  }

  /**
   * Get account-level activity timeline
   * Merges activity data across all profiles and sums by date/week/month
   */
  public async getAccountActivityTimeline(accountId: number): Promise<AccountActivityTimeline> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.activityTimeline(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileTimelines = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getActivityTimeline(profile.id)),
          );

          // Merge daily activity
          const dailyMap = new Map<string, DailyActivity>();
          profileTimelines.forEach(({ dailyActivity }) => {
            dailyActivity.forEach((day) => {
              const existing = dailyMap.get(day.date);
              if (existing) {
                existing.episodesWatched += day.episodesWatched;
                existing.showsWatched += day.showsWatched;
              } else {
                dailyMap.set(day.date, { ...day });
              }
            });
          });

          // Merge weekly activity
          const weeklyMap = new Map<string, WeeklyActivity>();
          profileTimelines.forEach(({ weeklyActivity }) => {
            weeklyActivity.forEach((week) => {
              const existing = weeklyMap.get(week.weekStart);
              if (existing) {
                existing.episodesWatched += week.episodesWatched;
              } else {
                weeklyMap.set(week.weekStart, { ...week });
              }
            });
          });

          // Merge monthly activity
          const monthlyMap = new Map<string, MonthlyActivity>();
          profileTimelines.forEach(({ monthlyActivity }) => {
            monthlyActivity.forEach((month) => {
              const existing = monthlyMap.get(month.month);
              if (existing) {
                existing.episodesWatched += month.episodesWatched;
                existing.moviesWatched += month.moviesWatched;
              } else {
                monthlyMap.set(month.month, { ...month });
              }
            });
          });

          return {
            dailyActivity: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
            weeklyActivity: Array.from(weeklyMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
            monthlyActivity: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountActivityTimeline(${accountId})`);
    }
  }

  /**
   * Get account-level binge-watching statistics
   * Sums sessions, finds max binge, and merges top shows across profiles
   */
  public async getAccountBingeWatchingStats(accountId: number): Promise<AccountBingeWatchingStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.bingeWatchingStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => ({
              profileId: profile.id,
              profileName: profile.name,
              stats: await profileStatisticsService.getBingeWatchingStats(profile.id),
            })),
          );

          let totalSessions = 0;
          let totalEpisodes = 0;
          let longestBinge: { profileName: string; showTitle: string; episodeCount: number; date: string } = {
            profileName: '',
            showTitle: '',
            episodeCount: 0,
            date: new Date().toISOString(),
          };
          const showBingeMap = new Map<number, { showId: number; showTitle: string; bingeSessionCount: number }>();

          profileStats.forEach(({ profileName, stats }) => {
            totalSessions += stats.bingeSessionCount;
            totalEpisodes += stats.averageEpisodesPerBinge * stats.bingeSessionCount;

            if (stats.longestBingeSession.episodeCount > longestBinge.episodeCount) {
              longestBinge = {
                profileName,
                showTitle: stats.longestBingeSession.showTitle,
                episodeCount: stats.longestBingeSession.episodeCount,
                date: stats.longestBingeSession.date,
              };
            }

            stats.topBingedShows.forEach((show) => {
              const existing = showBingeMap.get(show.showId);
              if (existing) {
                existing.bingeSessionCount += show.bingeSessionCount;
              } else {
                showBingeMap.set(show.showId, { ...show });
              }
            });
          });

          const topBingedShows = Array.from(showBingeMap.values())
            .sort((a, b) => b.bingeSessionCount - a.bingeSessionCount)
            .slice(0, 10);

          return {
            bingeSessionCount: totalSessions,
            averageEpisodesPerBinge: totalSessions > 0 ? Math.round((totalEpisodes / totalSessions) * 100) / 100 : 0,
            longestBingeSession: longestBinge,
            topBingedShows,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountBingeWatchingStats(${accountId})`);
    }
  }

  /**
   * Get account-level watch streak statistics
   * Finds max current/longest streaks across profiles
   */
  public async getAccountWatchStreakStats(accountId: number): Promise<AccountWatchStreakStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.watchStreakStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getWatchStreakStats(profile.id)),
          );

          let maxCurrentStreak = 0;
          let maxLongestStreak = 0;
          let currentStreakStartDate = new Date().toISOString();
          let longestStreakPeriod = {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            days: 0,
          };
          let totalStreaksOver7Days = 0;
          let totalStreakLength = 0;
          let streakCount = 0;

          profileStats.forEach((stats) => {
            if (stats.currentStreak > maxCurrentStreak) {
              maxCurrentStreak = stats.currentStreak;
              currentStreakStartDate = stats.currentStreakStartDate;
            }

            if (stats.longestStreak > maxLongestStreak) {
              maxLongestStreak = stats.longestStreak;
              longestStreakPeriod = stats.longestStreakPeriod;
            }

            totalStreaksOver7Days += stats.streaksOver7Days;
            totalStreakLength += stats.averageStreakLength * stats.streaksOver7Days;
            streakCount += stats.streaksOver7Days;
          });

          return {
            currentStreak: maxCurrentStreak,
            longestStreak: maxLongestStreak,
            currentStreakStartDate,
            longestStreakPeriod,
            streaksOver7Days: totalStreaksOver7Days,
            averageStreakLength: streakCount > 0 ? Math.round((totalStreakLength / streakCount) * 100) / 100 : 0,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountWatchStreakStats(${accountId})`);
    }
  }

  /**
   * Get account-level time-to-watch statistics
   * Averages days to start/complete, merges fastest completions
   */
  public async getAccountTimeToWatchStats(accountId: number): Promise<AccountTimeToWatchStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.timeToWatchStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => ({
              profileId: profile.id,
              profileName: profile.name,
              stats: await profileStatisticsService.getTimeToWatchStats(profile.id),
            })),
          );

          let totalDaysToStart = 0;
          let totalDaysToComplete = 0;
          let showCount = 0;
          const fastestCompletionsList: Array<{
            profileName: string;
            showId: number;
            showTitle: string;
            daysToComplete: number;
          }> = [];
          let totalUnwatched30 = 0;
          let totalUnwatched90 = 0;
          let totalUnwatched365 = 0;

          profileStats.forEach(({ profileName, stats }) => {
            totalDaysToStart += stats.averageDaysToStartShow;
            totalDaysToComplete += stats.averageDaysToCompleteShow;
            showCount++;

            stats.fastestCompletions.forEach((completion) => {
              fastestCompletionsList.push({
                profileName,
                ...completion,
              });
            });

            totalUnwatched30 += stats.backlogAging.unwatchedOver30Days;
            totalUnwatched90 += stats.backlogAging.unwatchedOver90Days;
            totalUnwatched365 += stats.backlogAging.unwatchedOver365Days;
          });

          const fastestCompletions = fastestCompletionsList
            .sort((a, b) => a.daysToComplete - b.daysToComplete)
            .slice(0, 10);

          return {
            averageDaysToStartShow: showCount > 0 ? Math.round((totalDaysToStart / showCount) * 100) / 100 : 0,
            averageDaysToCompleteShow: showCount > 0 ? Math.round((totalDaysToComplete / showCount) * 100) / 100 : 0,
            fastestCompletions,
            backlogAging: {
              unwatchedOver30Days: totalUnwatched30,
              unwatchedOver90Days: totalUnwatched90,
              unwatchedOver365Days: totalUnwatched365,
            },
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountTimeToWatchStats(${accountId})`);
    }
  }

  /**
   * Get account-level seasonal viewing statistics
   * Sums viewing by month/season across profiles
   */
  public async getAccountSeasonalViewingStats(accountId: number): Promise<AccountSeasonalViewingStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.seasonalViewingStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getSeasonalViewingStats(profile.id)),
          );

          const viewingByMonth: Record<string, number> = {};
          const viewingBySeason = {
            spring: 0,
            summer: 0,
            fall: 0,
            winter: 0,
          };

          profileStats.forEach((stats) => {
            Object.entries(stats.viewingByMonth).forEach(([month, count]) => {
              viewingByMonth[month] = (viewingByMonth[month] || 0) + count;
            });

            viewingBySeason.spring += stats.viewingBySeason.spring;
            viewingBySeason.summer += stats.viewingBySeason.summer;
            viewingBySeason.fall += stats.viewingBySeason.fall;
            viewingBySeason.winter += stats.viewingBySeason.winter;
          });

          const monthEntries = Object.entries(viewingByMonth);
          const peakViewingMonth = monthEntries.length > 0 ? monthEntries.sort((a, b) => b[1] - a[1])[0][0] : '';
          const slowestViewingMonth = monthEntries.length > 0 ? monthEntries.sort((a, b) => a[1] - b[1])[0][0] : '';

          return {
            viewingByMonth,
            viewingBySeason,
            peakViewingMonth,
            slowestViewingMonth,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountSeasonalViewingStats(${accountId})`);
    }
  }

  /**
   * Get account-level milestone statistics
   * Sums totals and merges achievements across profiles
   */
  public async getAccountMilestoneStats(accountId: number): Promise<AccountMilestoneStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.milestoneStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getMilestoneStats(profile.id)),
          );

          let totalEpisodesWatched = 0;
          let totalMoviesWatched = 0;
          let totalHoursWatched = 0;
          const achievements: Achievement[] = [];

          profileStats.forEach((stats) => {
            totalEpisodesWatched += stats.totalEpisodesWatched;
            totalMoviesWatched += stats.totalMoviesWatched;
            totalHoursWatched += stats.totalHoursWatched;
            achievements.push(...stats.recentAchievements);
          });

          const recentAchievements = achievements
            .sort((a, b) => b.achievedDate.localeCompare(a.achievedDate))
            .slice(0, 10);

          return {
            totalEpisodesWatched,
            totalMoviesWatched,
            totalHoursWatched,
            milestones: [],
            recentAchievements,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountMilestoneStats(${accountId})`);
    }
  }

  /**
   * Get account-level content depth statistics
   * Weighted averages for episode counts/runtimes
   */
  public async getAccountContentDepthStats(accountId: number): Promise<AccountContentDepthStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.contentDepthStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getContentDepthStats(profile.id)),
          );

          let totalEpisodeCount = 0;
          let totalMovieRuntime = 0;
          let profileCount = 0;
          const releaseYearDistribution: Record<string, number> = {};
          const contentMaturityDistribution: Record<string, number> = {};

          profileStats.forEach((stats) => {
            totalEpisodeCount += stats.averageEpisodeCountPerShow;
            totalMovieRuntime += stats.averageMovieRuntime;
            profileCount++;

            Object.entries(stats.releaseYearDistribution).forEach(([year, count]) => {
              releaseYearDistribution[year] = (releaseYearDistribution[year] || 0) + count;
            });

            Object.entries(stats.contentMaturityDistribution).forEach(([rating, count]) => {
              contentMaturityDistribution[rating] = (contentMaturityDistribution[rating] || 0) + count;
            });
          });

          return {
            averageEpisodeCountPerShow:
              profileCount > 0 ? Math.round((totalEpisodeCount / profileCount) * 100) / 100 : 0,
            averageMovieRuntime: profileCount > 0 ? Math.round((totalMovieRuntime / profileCount) * 100) / 100 : 0,
            releaseYearDistribution,
            contentMaturityDistribution,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountContentDepthStats(${accountId})`);
    }
  }

  /**
   * Get account-level content discovery statistics
   * Average addition rates, combine ratios
   */
  public async getAccountContentDiscoveryStats(accountId: number): Promise<AccountContentDiscoveryStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.contentDiscoveryStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getContentDiscoveryStats(profile.id)),
          );

          let minDaysSinceLastAdded = Infinity;
          let totalShowsPerMonth = 0;
          let totalMoviesPerMonth = 0;
          let totalShowRatio = 0;
          let totalMovieRatio = 0;
          let profileCount = 0;

          profileStats.forEach((stats) => {
            if (stats.daysSinceLastContentAdded < minDaysSinceLastAdded) {
              minDaysSinceLastAdded = stats.daysSinceLastContentAdded;
            }
            totalShowsPerMonth += stats.contentAdditionRate.showsPerMonth;
            totalMoviesPerMonth += stats.contentAdditionRate.moviesPerMonth;
            totalShowRatio += stats.watchToAddRatio.shows;
            totalMovieRatio += stats.watchToAddRatio.movies;
            profileCount++;
          });

          return {
            daysSinceLastContentAdded: minDaysSinceLastAdded === Infinity ? 0 : minDaysSinceLastAdded,
            contentAdditionRate: {
              showsPerMonth: profileCount > 0 ? Math.round((totalShowsPerMonth / profileCount) * 100) / 100 : 0,
              moviesPerMonth: profileCount > 0 ? Math.round((totalMoviesPerMonth / profileCount) * 100) / 100 : 0,
            },
            watchToAddRatio: {
              shows: profileCount > 0 ? Math.round((totalShowRatio / profileCount) * 100) / 100 : 0,
              movies: profileCount > 0 ? Math.round((totalMovieRatio / profileCount) * 100) / 100 : 0,
            },
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountContentDiscoveryStats(${accountId})`);
    }
  }

  /**
   * Get account-level abandonment risk statistics
   * Merges at-risk shows with profile names
   */
  public async getAccountAbandonmentRiskStats(accountId: number): Promise<AccountAbandonmentRiskStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.abandonmentRiskStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => ({
              profileId: profile.id,
              profileName: profile.name,
              stats: await profileStatisticsService.getAbandonmentRiskStats(profile.id),
            })),
          );

          const showsAtRisk: Array<AbandonmentRiskShow & { profileName: string }> = [];
          let totalAbandonmentRate = 0;
          let profileCount = 0;

          profileStats.forEach(({ profileName, stats }) => {
            stats.showsAtRisk.forEach((show) => {
              showsAtRisk.push({
                ...show,
                profileName,
              });
            });
            totalAbandonmentRate += stats.showAbandonmentRate;
            profileCount++;
          });

          return {
            showsAtRisk: showsAtRisk.sort((a, b) => b.daysSinceLastWatch - a.daysSinceLastWatch).slice(0, 20),
            showAbandonmentRate: profileCount > 0 ? Math.round((totalAbandonmentRate / profileCount) * 100) / 100 : 0,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountAbandonmentRiskStats(${accountId})`);
    }
  }

  /**
   * Get account-level unaired content statistics
   * Sums counts across profiles
   */
  public async getAccountUnairedContentStats(accountId: number): Promise<AccountUnairedContentStats> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.unairedContentStats(accountId),
        async () => {
          const profiles = await profileService.getProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => await profileStatisticsService.getUnairedContentStats(profile.id)),
          );

          let totalUnairedShowCount = 0;
          let totalUnairedSeasonCount = 0;
          let totalUnairedMovieCount = 0;
          let totalUnairedEpisodeCount = 0;

          profileStats.forEach((stats) => {
            totalUnairedShowCount += stats.unairedShowCount;
            totalUnairedSeasonCount += stats.unairedSeasonCount;
            totalUnairedMovieCount += stats.unairedMovieCount;
            totalUnairedEpisodeCount += stats.unairedEpisodeCount;
          });

          return {
            unairedShowCount: totalUnairedShowCount,
            unairedSeasonCount: totalUnairedSeasonCount,
            unairedMovieCount: totalUnairedMovieCount,
            unairedEpisodeCount: totalUnairedEpisodeCount,
          };
        },
        3600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getAccountUnairedContentStats(${accountId})`);
    }
  }
}

export const accountStatisticsService = new AccountStatisticsService();
