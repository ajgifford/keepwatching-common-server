import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as statisticsDb from '../db/statisticsDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { profileService } from './profileService';
import { showService } from './showService';
import {
  AccountEpisodeProgress,
  AccountStatisticsResponse,
  DailyActivity,
  MonthlyActivity,
  MovieReference,
  MovieStatisticsResponse,
  ProfileStatisticsResponse,
  ShowProgress,
  ShowStatisticsResponse,
  UniqueContentCounts,
  WatchingActivityTimeline,
  WatchingVelocityStats,
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
 * Service class for handling statistics-related business logic
 */
export class StatisticsService {
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
              const showStats = await showService.getProfileShowStatistics(profile.id);
              const movieStats = await moviesService.getProfileMovieStatistics(profile.id);
              const progress = await showService.getProfileWatchProgress(profile.id);

              return {
                profileId: profile.id,
                profileName: profile.name,
                showStatistics: showStats,
                movieStatistics: movieStats,
                episodeWatchProgress: progress,
              } as ProfileStatisticsResponse;
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

      profileStats.movieStatistics.movieReferences.forEach((movie: MovieReference) => {
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
        600, // 10 minute TTL
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
        300, // 5 minute TTL
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
        600, // 10 minute TTL
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
}

export const statisticsService = new StatisticsService();
