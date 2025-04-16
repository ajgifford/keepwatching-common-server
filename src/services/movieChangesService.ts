import * as moviesDb from '../db/moviesDb';
import { cliLogger, httpLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { Change, ContentUpdates } from '../types/contentTypes';
import { SUPPORTED_CHANGE_KEYS } from '../utils/changesUtility';
import { getUSMPARating } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';

/**
 * Check for changes to a specific movie and update if necessary
 * @param content Movie to check for changes
 * @param pastDate Date past date used as the start of the change window
 * @param currentDate Date current date used as the end of the change window
 */
export async function checkForMovieChanges(content: ContentUpdates, pastDate: string, currentDate: string) {
  const tmdbService = getTMDBService();

  try {
    const changesData = await tmdbService.getMovieChanges(content.tmdb_id, pastDate, currentDate);
    const changes: Change[] = changesData.changes || [];

    const supportedChanges = changes.filter((item) => SUPPORTED_CHANGE_KEYS.includes(item.key));

    if (supportedChanges.length > 0) {
      const movieDetails = await tmdbService.getMovieDetails(content.tmdb_id);

      const updatedMovie = moviesDb.createMovie(
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
      );

      await moviesDb.updateMovie(updatedMovie);
    }
  } catch (error) {
    cliLogger.error(`Error checking changes for movie ID ${content.id}`, error);
    httpLogger.error(ErrorMessages.MovieChangeFail, { error, movieId: content.id });
    throw errorService.handleError(error, `checkForMovieChanges(${content.id})`);
  }
}
