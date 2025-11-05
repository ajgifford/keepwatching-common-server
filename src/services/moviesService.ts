import { MOVIE_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as moviesDb from '../db/moviesDb';
import * as personsDb from '../db/personsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { BadRequestError, NoAffectedRowsError } from '../middleware/errorMiddleware';
import { ContentUpdates } from '../types/contentTypes';
import { TMDBMovie, TMDBPaginatedResponse, TMDBRelatedMovie } from '../types/tmdbTypes';
import { TMDBGenre } from '../types/tmdbTypes';
import { SUPPORTED_CHANGE_KEYS } from '../utils/changesUtility';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '../utils/contentUtility';
import { generateGenreArrayFromIds } from '../utils/genreUtility';
import { filterEnglishMovies } from '../utils/usSearchFilter';
import { getUSWatchProvidersMovie } from '../utils/watchProvidersUtility';
import { checkAndRecordAchievements } from './achievementDetectionService';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { profileService } from './profileService';
import { getTMDBService } from './tmdbService';
import { watchStatusService } from './watchStatusService';
import {
  AddMovieFavorite,
  CastMember,
  ContentReference,
  CreateMovieRequest,
  MovieReference,
  MovieStatisticsResponse,
  ProfileMovie,
  RemoveMovieFavorite,
  SimilarOrRecommendedMovie,
  SimpleWatchStatus,
  UpdateMovieRequest,
  WatchStatus,
} from '@ajgifford/keepwatching-types';

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
  public invalidateProfileMovieCache(profileId: number): void {
    this.cache.invalidateProfileMovies(profileId);
  }

  /**
   * Invalidate all caches related to an account by running through it's profiles
   */
  public async invalidateAccountCache(accountId: number): Promise<void> {
    const profiles = await profileService.getProfilesByAccountId(accountId);
    for (const profile of profiles) {
      this.invalidateProfileMovieCache(profile.id);
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
   * Retrieve the given movie for a specific profile
   *
   * @param profileId - ID of the profile to get movies for
   * @param movieId - ID of the movie to get
   * @returns Movie associated with the profile
   */
  public async getMovieDetailsForProfile(profileId: number, movieId: number): Promise<ProfileMovie> {
    try {
      return await this.cache.getOrSet(
        MOVIE_KEYS.details(profileId, movieId),
        () => moviesDb.getMovieDetailsForProfile(profileId, movieId),
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getMovieDetailsForProfile(${profileId}, ${movieId})`);
    }
  }

  /**
   * Retrieve the cast members for the given movie
   *
   * @param movieId - ID of the movie to get
   * @returns the cast members of the movie
   */
  public async getMovieCastMembers(movieId: number): Promise<CastMember[]> {
    try {
      return await this.cache.getOrSet(
        MOVIE_KEYS.castMembers(movieId),
        () => personsDb.getMovieCastMembers(movieId),
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getMovieCastMembers(${movieId})`);
    }
  }

  /**
   * Retrieves all movies for a specific profile
   *
   * @param profileId - ID of the profile to get movies for
   * @returns Movies associated with the profile
   */
  public async getMoviesForProfile(profileId: number): Promise<ProfileMovie[]> {
    try {
      const movies = await this.cache.getOrSet(
        PROFILE_KEYS.movies(profileId),
        () => moviesDb.getAllMoviesForProfile(profileId),
        600,
      );

      // Check and update any UNAIRED movies that have been released
      const updatedMovies = await this.checkAndUpdateUnairedMovies(profileId, movies);

      return updatedMovies;
    } catch (error) {
      throw errorService.handleError(error, `getMoviesForProfile(${profileId})`);
    }
  }

  /**
   * Helper method to check UNAIRED movies and update their status if they've been released
   * Updates both the database and the in-memory movie list
   */
  private async checkAndUpdateUnairedMovies(profileId: number, movies: ProfileMovie[]): Promise<ProfileMovie[]> {
    const now = new Date();
    const unairedMovies = movies.filter(
      (movie) => movie.watchStatus === WatchStatus.UNAIRED && new Date(movie.releaseDate) <= now,
    );

    if (unairedMovies.length === 0) {
      return movies;
    }

    let updatedCount = 0;

    for (const movie of unairedMovies) {
      try {
        const result = await watchStatusService.checkAndUpdateMovieStatus(profileId, movie.id);
        if (result.affectedRows > 0) {
          // Update the movie status in the returned list
          movie.watchStatus = WatchStatus.NOT_WATCHED;
          updatedCount++;
        }
      } catch (error) {
        cliLogger.error(`Failed to update watch status for movie ${movie.id}`, error);
      }
    }

    // Invalidate cache after updates so next fetch gets fresh data
    if (updatedCount > 0) {
      this.invalidateProfileMovieCache(profileId);
    }

    return movies;
  }

  /**
   * Gets recent movie releases for a profile
   *
   * @param profileId - ID of the profile to get recent movies for
   * @returns Array of recent movie releases
   */
  public async getRecentMoviesForProfile(profileId: number): Promise<ContentReference[]> {
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
  public async getUpcomingMoviesForProfile(profileId: number): Promise<ContentReference[]> {
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
  public async addMovieToFavorites(profileId: number, movieTMDBId: number): Promise<AddMovieFavorite> {
    try {
      const existingMovieToFavorite = await moviesDb.findMovieByTMDBId(movieTMDBId);
      if (existingMovieToFavorite) {
        return await this.favoriteExistingMovie(existingMovieToFavorite, profileId);
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
  private async favoriteExistingMovie(movie: MovieReference, profileId: number): Promise<AddMovieFavorite> {
    const now = new Date();
    const status =
      !movie.releaseDate || new Date(movie.releaseDate) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED;
    const existing = await moviesDb.getMovieForProfile(profileId, movie.id).catch(() => null);
    if (existing) {
      const recentMovies = await this.getRecentMoviesForProfile(profileId);
      const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);
      return {
        favoritedMovie: existing,
        recentUpcomingMovies: { recentMovies, upcomingMovies },
      };
    }
    const saved = await moviesDb.saveFavorite(profileId, movie.id, status);
    if (!saved) {
      throw new NoAffectedRowsError('Failed to save a movie as a favorite');
    }

    this.invalidateProfileMovieCache(profileId);

    const favoritedMovie = await moviesDb.getMovieForProfile(profileId, movie.id);
    const recentMovies = await this.getRecentMoviesForProfile(profileId);
    const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

    return {
      favoritedMovie,
      recentUpcomingMovies: { recentMovies, upcomingMovies },
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
  private async favoriteNewMovie(movieTMDBId: number, profileId: number): Promise<AddMovieFavorite> {
    const tmdbService = getTMDBService();
    const movieResponse = await tmdbService.getMovieDetails(movieTMDBId);
    const now = new Date();

    const createMovieRequest: CreateMovieRequest = {
      tmdb_id: movieResponse.id,
      title: movieResponse.title,
      description: movieResponse.overview,
      release_date: movieResponse.release_date,
      runtime: movieResponse.runtime,
      poster_image: movieResponse.poster_path,
      backdrop_image: movieResponse.backdrop_path,
      user_rating: movieResponse.vote_average,
      mpa_rating: getUSMPARating(movieResponse.release_dates),
      director: getDirectors(movieResponse),
      production_companies: getUSProductionCompanies(movieResponse.production_companies),
      budget: movieResponse.budget,
      revenue: movieResponse.revenue,
      streaming_service_ids: getUSWatchProvidersMovie(movieResponse),
      genre_ids: movieResponse.genres.map((genre: TMDBGenre) => genre.id),
    };

    const savedMovieId = await moviesDb.saveMovie(createMovieRequest);
    const status =
      !movieResponse.release_date || new Date(movieResponse.release_date) > now
        ? WatchStatus.UNAIRED
        : WatchStatus.NOT_WATCHED;
    const favoriteSaved = await moviesDb.saveFavorite(profileId, savedMovieId, status);
    if (!favoriteSaved) {
      throw new NoAffectedRowsError('Failed to save a movie as a favorite');
    }

    const favoritedMovie = await moviesDb.getMovieForProfile(profileId, savedMovieId);
    const recentMovies = await this.getRecentMoviesForProfile(profileId);
    const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

    this.invalidateProfileMovieCache(profileId);
    this.processMovieCast(movieResponse, savedMovieId);

    return {
      favoritedMovie,
      recentUpcomingMovies: { recentMovies, upcomingMovies },
    };
  }

  private async processMovieCast(movie: TMDBMovie, movieId: number) {
    try {
      const cast = movie.credits.cast ?? [];
      for (const castMember of cast) {
        const person = await personsDb.findPersonByTMDBId(castMember.id);
        let personId = null;
        if (person) {
          personId = person.id;
        } else {
          const tmdbPerson = await getTMDBService().getPersonDetails(castMember.id);
          personId = await personsDb.savePerson({
            tmdb_id: tmdbPerson.id,
            name: tmdbPerson.name,
            gender: tmdbPerson.gender,
            biography: tmdbPerson.biography,
            profile_image: tmdbPerson.profile_path,
            birthdate: tmdbPerson.birthday,
            deathdate: tmdbPerson.deathday,
            place_of_birth: tmdbPerson.place_of_birth,
          });
        }
        personsDb.saveMovieCast({
          content_id: movieId,
          person_id: personId,
          character_name: castMember.character,
          credit_id: castMember.credit_id,
          cast_order: castMember.order,
        });

        this.cache.invalidatePerson(personId);
      }
    } catch (error) {
      cliLogger.error('Error fetching movie cast:', error);
    }
  }

  /**
   * Removes a movie from a profile's favorites
   *
   * @param profileId - ID of the profile to remove the movie from
   * @param movieId - ID of the movie to remove
   * @returns Object containing recent and upcoming movies after removal
   */
  public async removeMovieFromFavorites(profileId: number, movieId: number): Promise<RemoveMovieFavorite> {
    try {
      const removedMovie = await moviesDb.findMovieById(movieId);
      errorService.assertExists(removedMovie, 'Movie', movieId);

      await moviesDb.removeFavorite(profileId, movieId);
      this.invalidateProfileMovieCache(profileId);

      const recentMovies = await this.getRecentMoviesForProfile(profileId);
      const upcomingMovies = await this.getUpcomingMoviesForProfile(profileId);

      return {
        removedMovie,
        recentUpcomingMovies: { recentMovies, upcomingMovies },
      };
    } catch (error) {
      throw errorService.handleError(error, `removeMovieFromFavorites(${profileId}, ${movieId})`);
    }
  }

  /**
   * Updates the watch status of a movie
   *
   * @param accountId - ID of the account (for cache invalidation)
   * @param profileId - ID of the profile to update the watch status for
   * @param movieId - ID of the movie to update
   * @param status - New watch status ('WATCHED' or 'NOT_WATCHED')
   * @returns Success state of the update operation
   */
  public async updateMovieWatchStatus(
    accountId: number,
    profileId: number,
    movieId: number,
    status: SimpleWatchStatus,
  ): Promise<boolean> {
    try {
      const success = await moviesDb.updateWatchStatus(profileId, movieId, status);

      if (!success) {
        throw new BadRequestError(
          `Failed to update watch status. Ensure the movie (ID: ${movieId}) exists in your favorites.`,
        );
      }

      this.invalidateProfileMovieCache(profileId);

      // Check for new achievements (non-blocking)
      checkAndRecordAchievements(profileId, accountId).catch((err) => {
        console.error('Error checking achievements after movie watch status update:', err);
      });

      return success;
    } catch (error) {
      throw errorService.handleError(error, `updateMovieWatchStatus(${profileId}, ${movieId}, ${status})`);
    }
  }

  /**
   * Get trending movies for discovery emails
   */
  public async getTrendingMovies(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await moviesDb.getTrendingMovies(limit);
    } catch (error) {
      throw errorService.handleError(error, `getTrendingMovies(${limit})`);
    }
  }

  /**
   * Get recently released movies
   */
  public async getRecentlyReleasedMovies(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await moviesDb.getRecentlyReleasedMovies(limit);
    } catch (error) {
      throw errorService.handleError(error, `getRecentlyReleasedMovies(${limit})`);
    }
  }

  /**
   * Get top rated movies
   */
  public async getTopRatedMovies(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await moviesDb.getTopRatedMovies(limit);
    } catch (error) {
      throw errorService.handleError(error, `getTopRatedMovies(${limit})`);
    }
  }

  /**
   * Gets recommendations for similar movies based on a given movie
   *
   * @param profileId - ID of the profile requesting recommendations
   * @param movieId - ID of the movie to get recommendations for
   * @returns Array of recommended movies
   */
  public async getMovieRecommendations(profileId: number, movieId: number): Promise<SimilarOrRecommendedMovie[]> {
    try {
      const movieReference = await moviesDb.findMovieById(movieId);
      errorService.assertExists(movieReference, 'MovieReference', movieId);

      return await this.cache.getOrSet(
        MOVIE_KEYS.recommendations(movieId),
        async () => {
          const tmdbService = getTMDBService();
          const response = await tmdbService.getMovieRecommendations(movieReference.tmdbId);
          return await this.populateSimilarOrRecommendedResult(response, profileId);
        },
        86400, // 24 hours TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getMovieRecommendations(${profileId}, ${movieId})`);
    }
  }

  /**
   * Gets similar movies based on a given movie
   *
   * @param profileId - ID of the profile requesting similar movies
   * @param movieId - ID of the movies to get recommendations for
   * @returns Array of recommended movies
   */
  public async getSimilarMovies(profileId: number, movieId: number): Promise<SimilarOrRecommendedMovie[]> {
    try {
      const movieReference = await moviesDb.findMovieById(movieId);
      errorService.assertExists(movieReference, 'MovieReference', movieId);

      return await this.cache.getOrSet(
        MOVIE_KEYS.similar(movieId),
        async () => {
          const tmdbService = getTMDBService();
          const response = await tmdbService.getSimilarMovies(movieReference.tmdbId);
          return await this.populateSimilarOrRecommendedResult(response, profileId);
        },
        86400, // 24 hours TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getSimilarMovies(${profileId}, ${movieId})`);
    }
  }

  private async populateSimilarOrRecommendedResult(
    response: TMDBPaginatedResponse<TMDBRelatedMovie>,
    profileId: number,
  ): Promise<SimilarOrRecommendedMovie[]> {
    const responseMovies = filterEnglishMovies(response.results);
    const userMovies = await moviesDb.getAllMoviesForProfile(profileId);
    const userMovieIds = new Set(userMovies.map((s) => s.tmdbId));
    return responseMovies.map((rec: TMDBRelatedMovie) => ({
      id: rec.id,
      title: rec.title,
      genres: generateGenreArrayFromIds(rec.genre_ids),
      premiered: rec.release_date,
      summary: rec.overview,
      image: rec.poster_path,
      rating: rec.vote_average,
      popularity: rec.popularity,
      language: rec.original_language,
      country: 'US',
      inFavorites: userMovieIds.has(rec.id),
    }));
  }

  /**
   * Check for changes to a specific movie and updates if necessary
   * @param content Movie to check for changes
   * @param pastDate Date past date used as the start of the change window
   * @param currentDate Date current date used as the end of the change window
   */
  public async checkMovieForChanges(content: ContentUpdates, pastDate: string, currentDate: string): Promise<void> {
    const tmdbService = getTMDBService();

    try {
      const { changes } = await tmdbService.getMovieChanges(content.tmdb_id, pastDate, currentDate);
      const supportedChanges = changes.filter((item) => SUPPORTED_CHANGE_KEYS.includes(item.key));

      if (supportedChanges.length > 0) {
        const movieDetails = await tmdbService.getMovieDetails(content.tmdb_id);

        const updateMovieRequest: UpdateMovieRequest = {
          id: content.id,
          tmdb_id: movieDetails.id,
          title: movieDetails.title,
          description: movieDetails.overview,
          release_date: movieDetails.release_date,
          runtime: movieDetails.runtime,
          poster_image: movieDetails.poster_path,
          backdrop_image: movieDetails.backdrop_path,
          user_rating: movieDetails.vote_average,
          mpa_rating: getUSMPARating(movieDetails.release_dates),
          director: getDirectors(movieDetails),
          production_companies: getUSProductionCompanies(movieDetails.production_companies),
          budget: movieDetails.budget,
          revenue: movieDetails.revenue,
          streaming_service_ids: getUSWatchProvidersMovie(movieDetails),
          genre_ids: movieDetails.genres.map((genre: TMDBGenre) => genre.id),
        };

        await moviesDb.updateMovie(updateMovieRequest);

        if (supportedChanges.filter((item) => 'cast'.includes(item.key))) {
          this.processMovieCast(movieDetails, content.id);
        }
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
  public async getProfileMovieStatistics(profileId: number): Promise<MovieStatisticsResponse> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.movieStatistics(profileId),
        async () => {
          const movies = await moviesDb.getAllMoviesForProfile(profileId);

          const total = movies.length;
          const unaired = movies.filter((m) => m.watchStatus === WatchStatus.UNAIRED).length;
          const watched = movies.filter((m) => m.watchStatus === WatchStatus.WATCHED).length;
          const notWatched = movies.filter((m) => m.watchStatus === WatchStatus.NOT_WATCHED).length;

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
          const movieReferences: MovieReference[] = [];
          movies.forEach((movie) => {
            movieReferences.push({
              id: movie.id,
              title: movie.title,
              tmdbId: movie.tmdbId,
              releaseDate: movie.releaseDate,
            });
            if (movie.streamingServices && typeof movie.streamingServices === 'string') {
              const serviceArray = movie.streamingServices.split(',').map((service) => service.trim());
              serviceArray.forEach((service: string) => {
                if (service) {
                  serviceCounts[service] = (serviceCounts[service] || 0) + 1;
                }
              });
            }
          });

          return {
            movieReferences: movieReferences,
            total: total,
            watchStatusCounts: { unaired, watched, notWatched },
            genreDistribution: genreCounts,
            serviceDistribution: serviceCounts,
            watchProgress: total > 0 ? Math.round((watched / (total - unaired)) * 100) : 0,
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
