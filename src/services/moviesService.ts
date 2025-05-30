import { MOVIE_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as moviesDb from '../db/moviesDb';
import { appLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { BadRequestError, NoAffectedRowsError } from '../middleware/errorMiddleware';
import { Change, ContentUpdates } from '../types/contentTypes';
import { SUPPORTED_CHANGE_KEYS } from '../utils/changesUtility';
import { getUSMPARating } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { profileService } from './profileService';
import { getTMDBService } from './tmdbService';

/**
 * Service class for handling movie-related business logic
 * This separates the business logic from the controller layer
 */
export class MoviesService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Invalidate all caches related to a profile's movies
   */
  public invalidateProfileMovieCache(profileId: string): void {
    this.cache.invalidateProfileMovies(profileId);
  }

  /**
   * Invalidate all caches related to an account by running through it's profiles
   */
  public async invalidateAccountCache(accountId: number): Promise<void> {
    const profiles = await profileService.getProfilesByAccountId(accountId);
    for (const profile of profiles) {
      this.invalidateProfileMovieCache(String(profile.id!));
    }

    this.cache.invalidateAccount(accountId);
  }

  /**
   * Invalidate the cache related to all movies
   */
  public async invalidateAllMoviesCache() {
    this.cache.invalidatePattern('allMovies_');
  }

  /**
   * Gets a list of movies that may need metadata updates
   *
   * @returns Array of movies needing updates
   */
  public async getMoviesForUpdates(): Promise<ContentUpdates[]> {
    try {
      return await moviesDb.getMoviesForUpdates();
    } catch (error) {
      throw errorService.handleError(error, `getMoviesForUpdates()`);
    }
  }

  /**
   * Retrieves all movies for a specific profile
   *
   * @param profileId - ID of the profile to get movies for
   * @returns Movies associated with the profile
   */
  public async getMoviesForProfile(profileId: string) {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.movies(profileId),
        () => moviesDb.getAllMoviesForProfile(profileId),
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getMoviesForProfile(${profileId})`);
    }
  }

  /**
   * Gets recent movie releases for a profile
   *
   * @param profileId - ID of the profile to get recent movies for
   * @returns Array of recent movie releases
   */
  public async getRecentMoviesForProfile(profileId: string) {
    try {
      return await this.cache.getOrSet(
        `${PROFILE_KEYS.recentMovies(profileId)}`,
        () => moviesDb.getRecentMovieReleasesForProfile(profileId),
        300, // 5 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getRecentMoviesForProfile(${profileId})`);
    }
  }

  /**
   * Gets upcoming movie releases for a profile
   *
   * @param profileId - ID of the profile to get upcoming movies for
   * @returns Array of upcoming movie releases
   */
  public async getUpcomingMoviesForProfile(profileId: string) {
    try {
      return await this.cache.getOrSet(
        `${PROFILE_KEYS.upcomingMovies(profileId)}`,
        () => moviesDb.getUpcomingMovieReleasesForProfile(profileId),
        300, // 5 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getUpcomingMoviesForProfile(${profileId})`);
    }
  }

  /**
   * Adds a movie to a profile's favorites
   *
   * @param profileId - ID of the profile to add the movie for
   * @param movieTMDBId - TMDB ID of the movie to add
   * @returns Object containing the favorited movie and updated recent/upcoming lists
   */
  public async addMovieToFavorites(profileId: string, movieTMDBId: number) {
    try {
      const existingMovieToFavorite = await moviesDb.findMovieByTMDBId(movieTMDBId);
      if (existingMovieToFavorite) {
        return await this.favoriteExistingMovie(existingMovieToFavorite.id!, profileId);
      }

      return await this.favoriteNewMovie(movieTMDBId, profileId);
    } catch (error) {
      throw errorService.handleError(error, `addMovieToFavorites(${profileId}, ${movieTMDBId})`);
    }
  }

  /**
   * Adds an existing movie to a profile's favorites
   *
   * @param movieToFavorite - Movie to add to favorites
   * @param profileId - ID of the profile to add the movie for
   * @returns Object containing the favorited movie and updated recent/upcoming lists
   */
  private async favoriteExistingMovie(movieId: number, profileId: string) {
    const saved = await moviesDb.saveFavorite(profileId, movieId);
    if (!saved) {
      throw new NoAffectedRowsError('Failed to save a movie as a favorite');
    }

    this.invalidateProfileMovieCache(profileId);

    const newMovie = await moviesDb.getMovieForProfile(profileId, movieId);
    const recentMovies = await this.getRecentMoviesForProfile(profileId);
    const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

    return {
      favoritedMovie: newMovie,
      recentMovies,
      upcomingMovies,
    };
  }

  /**
   * Adds a new movie (not yet in the database) to a profile's favorites
   * Fetches movie data from TMDB API, saves it to the database, and adds to favorites
   *
   * @param movieTMDBId - TMDB ID of the movie to add
   * @param profileId - ID of the profile to add the movie for
   * @returns Object containing the favorited movie and updated recent/upcoming lists
   */
  private async favoriteNewMovie(movieTMDBId: number, profileId: string) {
    const tmdbService = getTMDBService();
    const response = await tmdbService.getMovieDetails(movieTMDBId);

    const newMovieToFavorite = moviesDb.createMovie(
      response.id,
      response.title,
      response.overview,
      response.release_date,
      response.runtime,
      response.poster_path,
      response.backdrop_path,
      response.vote_average,
      getUSMPARating(response.release_dates),
      undefined,
      getUSWatchProviders(response, 9998),
      response.genres.map((genre: { id: any }) => genre.id),
    );

    const movieSaved = await moviesDb.saveMovie(newMovieToFavorite);
    if (!movieSaved) {
      throw new NoAffectedRowsError('Failed to save movie information');
    }

    const favoriteSaved = await moviesDb.saveFavorite(profileId, newMovieToFavorite.id!);
    if (!favoriteSaved) {
      throw new NoAffectedRowsError('Failed to save a movie as a favorite');
    }

    const newMovie = await moviesDb.getMovieForProfile(profileId, newMovieToFavorite.id!);
    const recentMovies = await this.getRecentMoviesForProfile(profileId);
    const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

    this.invalidateProfileMovieCache(profileId);

    return {
      favoritedMovie: newMovie,
      recentMovies,
      upcomingMovies,
    };
  }

  /**
   * Removes a movie from a profile's favorites
   *
   * @param profileId - ID of the profile to remove the movie from
   * @param movieId - ID of the movie to remove
   * @returns Object containing recent and upcoming movies after removal
   */
  public async removeMovieFromFavorites(profileId: string, movieId: number) {
    try {
      const movieToRemove = await moviesDb.findMovieById(movieId);
      errorService.assertExists(movieToRemove, 'Movie', movieId);

      await moviesDb.removeFavorite(profileId, movieId);
      this.invalidateProfileMovieCache(profileId);

      const recentMovies = await this.getRecentMoviesForProfile(profileId);
      const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

      return {
        removedMovie: movieToRemove,
        recentMovies,
        upcomingMovies,
      };
    } catch (error) {
      throw errorService.handleError(error, `removeMovieFromFavorites(${profileId}, ${movieId})`);
    }
  }

  /**
   * Updates the watch status of a movie
   *
   * @param profileId - ID of the profile to update the watch status for
   * @param movieId - ID of the movie to update
   * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
   * @returns Success state of the update operation
   */
  public async updateMovieWatchStatus(profileId: string, movieId: number, status: string) {
    try {
      const success = await moviesDb.updateWatchStatus(profileId, movieId, status);

      if (!success) {
        throw new BadRequestError(
          `Failed to update watch status. Ensure the movie (ID: ${movieId}) exists in your favorites.`,
        );
      }

      this.invalidateProfileMovieCache(profileId);

      return success;
    } catch (error) {
      throw errorService.handleError(error, `updateMovieWatchStatus(${profileId}, ${movieId}, ${status})`);
    }
  }

  /**
   * Check for changes to a specific movie and updates if necessary
   * @param content Movie to check for changes
   * @param pastDate Date past date used as the start of the change window
   * @param currentDate Date current date used as the end of the change window
   */
  public async checkMovieForChanges(content: ContentUpdates, pastDate: string, currentDate: string) {
    const tmdbService = getTMDBService();

    try {
      const changesData = await tmdbService.getMovieChanges(content.tmdb_id, pastDate, currentDate);
      const changes: Change[] = changesData.changes || [];

      const supportedChanges = changes.filter((item) => SUPPORTED_CHANGE_KEYS.includes(item.key));

      if (supportedChanges.length > 0) {
        const movieDetails = await tmdbService.getMovieDetails(content.tmdb_id);

        await moviesDb.updateMovie(
          moviesDb.createMovie(
            movieDetails.id,
            movieDetails.title,
            movieDetails.overview,
            movieDetails.release_date,
            movieDetails.runtime,
            movieDetails.poster_path,
            movieDetails.backdrop_path,
            movieDetails.vote_average,
            getUSMPARating(movieDetails.release_dates),
            content.id,
            getUSWatchProviders(movieDetails, 9998),
            movieDetails.genres.map((genre: { id: any }) => genre.id),
          ),
        );
      }
    } catch (error) {
      appLogger.error(ErrorMessages.MovieChangeFail, { error, movieId: content.id });
      throw errorService.handleError(error, `checkMovieForChanges(${content.id})`);
    }
  }

  /**
   * Get statistics about a profile's movies
   *
   * @param profileId - ID of the profile to get statistics for
   * @returns Object containing various watch statistics
   */
  public async getProfileMovieStatistics(profileId: string) {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.movieStatistics(profileId),
        async () => {
          const movies = await moviesDb.getAllMoviesForProfile(profileId);

          const total = movies.length;
          const watched = movies.filter((m) => m.watch_status === 'WATCHED').length;
          const notWatched = movies.filter((m) => m.watch_status === 'NOT_WATCHED').length;

          const genreCounts: Record<string, number> = {};
          movies.forEach((movie) => {
            if (movie.genres && typeof movie.genres === 'string') {
              const genreArray = movie.genres.split(',').map((genre) => genre.trim());
              genreArray.forEach((genre: string) => {
                if (genre) {
                  // Skip empty strings
                  genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                }
              });
            }
          });

          const serviceCounts: Record<string, number> = {};
          movies.forEach((movie) => {
            if (movie.streaming_services && typeof movie.streaming_services === 'string') {
              const serviceArray = movie.streaming_services.split(',').map((service) => service.trim());
              serviceArray.forEach((service: string) => {
                if (service) {
                  serviceCounts[service] = (serviceCounts[service] || 0) + 1;
                }
              });
            }
          });

          return {
            total: total,
            watchStatusCounts: { watched, notWatched },
            genreDistribution: genreCounts,
            serviceDistribution: serviceCounts,
            watchProgress: total > 0 ? Math.round((watched / total) * 100) : 0,
          };
        },
        1800,
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfileMovieStatistics(${profileId})`);
    }
  }
}

export const moviesService = new MoviesService();
