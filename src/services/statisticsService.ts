import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import { BadRequestError } from '../middleware/errorMiddleware';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { profileService } from './profileService';
import { showService } from './showService';
import {
  AccountEpisodeProgress,
  AccountStatisticsResponse,
  MovieReference,
  MovieStatisticsResponse,
  ProfileStatisticsResponse,
  ShowProgress,
  ShowStatisticsResponse,
  UniqueContentCounts,
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
        watchStatusCounts: { watched: 0, watching: 0, notWatched: 0, upToDate: 0 },
        genreDistribution: {} as Record<string, number>,
        serviceDistribution: {} as Record<string, number>,
      },
      movies: {
        total: 0,
        watchStatusCounts: { watched: 0, notWatched: 0 },
        genreDistribution: {} as Record<string, number>,
        serviceDistribution: {} as Record<string, number>,
      },
      episodes: {
        totalEpisodes: 0,
        watchedEpisodes: 0,
      },
    };

    profilesStats.forEach((profileStats) => {
      aggregate.shows.total += profileStats.showStatistics.total;
      aggregate.shows.watchStatusCounts.watched += profileStats.showStatistics.watchStatusCounts.watched;
      aggregate.shows.watchStatusCounts.watching += profileStats.showStatistics.watchStatusCounts.watching;
      aggregate.shows.watchStatusCounts.notWatched += profileStats.showStatistics.watchStatusCounts.notWatched;
      aggregate.shows.watchStatusCounts.upToDate += profileStats.showStatistics.watchStatusCounts.upToDate || 0;

      aggregate.movies.total += profileStats.movieStatistics.total;
      aggregate.movies.watchStatusCounts.watched += profileStats.movieStatistics.watchStatusCounts.watched;
      aggregate.movies.watchStatusCounts.notWatched += profileStats.movieStatistics.watchStatusCounts.notWatched;

      aggregate.episodes.totalEpisodes += profileStats.episodeWatchProgress.totalEpisodes;
      aggregate.episodes.watchedEpisodes += profileStats.episodeWatchProgress.watchedEpisodes;

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
        ? Math.round((aggregate.shows.watchStatusCounts.watched / aggregate.shows.total) * 100)
        : 0;

    const movieWatchProgress =
      aggregate.movies.total > 0
        ? Math.round((aggregate.movies.watchStatusCounts.watched / aggregate.movies.total) * 100)
        : 0;

    const episodeWatchProgress =
      aggregate.episodes.totalEpisodes > 0
        ? Math.round((aggregate.episodes.watchedEpisodes / aggregate.episodes.totalEpisodes) * 100)
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
}

export const statisticsService = new StatisticsService();
