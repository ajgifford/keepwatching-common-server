import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as profilesDb from '../db/profilesDb';
import { BadRequestError } from '../middleware/errorMiddleware';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { showService } from './showService';

/**
 * Interface for aggregated account statistics
 */
export interface AggregatedStats {
  shows: {
    total: number;
    watchStatusCounts: {
      watched: number;
      watching: number;
      notWatched: number;
    };
    genreDistribution: Record<string, number>;
    serviceDistribution: Record<string, number>;
    watchProgress: number;
  };
  movies: {
    total: number;
    watchStatusCounts: {
      watched: number;
      notWatched: number;
    };
    genreDistribution: Record<string, number>;
    serviceDistribution: Record<string, number>;
    watchProgress: number;
  };
  episodes: {
    totalEpisodes: number;
    watchedEpisodes: number;
    watchProgress: number;
  };
  uniqueContent: {
    showCount: number;
    movieCount: number;
  };
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
  public async getProfileStatistics(profileId: string) {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.statistics(profileId),
        async () => {
          const showStatistics = await showService.getProfileShowStatistics(profileId);
          const movieStatistics = await moviesService.getProfileMovieStatistics(profileId);
          const episodeWatchProgress = await showService.getProfileWatchProgress(profileId);

          return { showStatistics, movieStatistics, episodeWatchProgress };
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
  public async getAccountStatistics(accountId: number) {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.statistics(accountId),
        async () => {
          const profiles = await profilesDb.getAllProfilesByAccountId(accountId);
          if (!profiles || profiles.length === 0) {
            throw new BadRequestError(`No profiles found for account ${accountId}`);
          }

          const profileStats = await Promise.all(
            profiles.map(async (profile) => {
              const profileId = profile.id!.toString();
              const showStats = await showService.getProfileShowStatistics(profileId);
              const movieStats = await moviesService.getProfileMovieStatistics(profileId);
              const progress = await showService.getProfileWatchProgress(profileId);

              return {
                profileId: profile.id,
                profileName: profile.name,
                showStatistics: showStats,
                movieStatistics: movieStats,
                progress,
              };
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
   * @param profileStats - Array of profile statistics
   * @returns Aggregated statistics across all profiles
   * @private
   */
  private aggregateAccountStatistics(profileStats: any[]): AggregatedStats {
    if (!profileStats.length) {
      return this.createEmptyAggregateStats();
    }

    const uniqueShowIds = new Set<number>();
    const uniqueMovieIds = new Set<number>();

    const aggregate = {
      shows: {
        total: 0,
        watchStatusCounts: { watched: 0, watching: 0, notWatched: 0 },
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

    profileStats.forEach((profileStat) => {
      aggregate.shows.total += profileStat.showStatistics.total;
      aggregate.shows.watchStatusCounts.watched += profileStat.showStatistics.watchStatusCounts.watched;
      aggregate.shows.watchStatusCounts.watching += profileStat.showStatistics.watchStatusCounts.watching;
      aggregate.shows.watchStatusCounts.notWatched += profileStat.showStatistics.watchStatusCounts.notWatched;

      aggregate.movies.total += profileStat.movieStatistics.total;
      aggregate.movies.watchStatusCounts.watched += profileStat.movieStatistics.watchStatusCounts.watched;
      aggregate.movies.watchStatusCounts.notWatched += profileStat.movieStatistics.watchStatusCounts.notWatched;

      aggregate.episodes.totalEpisodes += profileStat.progress.totalEpisodes;
      aggregate.episodes.watchedEpisodes += profileStat.progress.watchedEpisodes;

      Object.entries(profileStat.showStatistics.genreDistribution).forEach(([genre, count]) => {
        aggregate.shows.genreDistribution[genre] = (aggregate.shows.genreDistribution[genre] || 0) + (count as number);
      });

      Object.entries(profileStat.movieStatistics.genreDistribution).forEach(([genre, count]) => {
        aggregate.movies.genreDistribution[genre] =
          (aggregate.movies.genreDistribution[genre] || 0) + (count as number);
      });

      Object.entries(profileStat.showStatistics.serviceDistribution).forEach(([service, count]) => {
        aggregate.shows.serviceDistribution[service] =
          (aggregate.shows.serviceDistribution[service] || 0) + (count as number);
      });

      Object.entries(profileStat.movieStatistics.serviceDistribution).forEach(([service, count]) => {
        aggregate.movies.serviceDistribution[service] =
          (aggregate.movies.serviceDistribution[service] || 0) + (count as number);
      });

      if (profileStat.progress.showsProgress) {
        profileStat.progress.showsProgress.forEach((show: any) => {
          uniqueShowIds.add(show.showId);
        });
      }

      if (profileStat.movieStatistics && profileStat.movieStatistics.movies) {
        profileStat.movieStatistics.movies.forEach((movie: any) => {
          if (movie.movie_id) {
            uniqueMovieIds.add(movie.movie_id);
          }
        });
      }
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
        },
        genreDistribution: {},
        serviceDistribution: {},
        watchProgress: 0,
      },
      movies: {
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
