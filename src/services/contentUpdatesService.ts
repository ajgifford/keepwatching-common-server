import * as moviesDb from '../db/moviesDb';
import * as showsDb from '../db/showsDb';
import { cliLogger, httpLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { generateDateRange, sleep } from '../utils/changesUtility';
import { checkForMovieChanges } from './movieChangesService';
import { checkForShowChanges } from './showChangesService';

/**
 * Updates movies that might have changes
 */
export async function updateMovies() {
  try {
    const movies = await moviesDb.getMoviesForUpdates();
    cliLogger.info(`Found ${movies.length} movies to check for updates`);
    const { currentDate, pastDate } = generateDateRange(10);

    for (const movie of movies) {
      try {
        await sleep(500);
        await checkForMovieChanges(movie, pastDate, currentDate);
      } catch (error) {
        // Log error but continue with next movie
        cliLogger.error(`Failed to check for changes in movie ID ${movie.id}`, error);
      }
    }
  } catch (error) {
    cliLogger.error('Unexpected error while checking for movie updates', error);
    httpLogger.error(ErrorMessages.MoviesChangeFail, { error });
    throw error;
  }
}

/**
 * Updates shows that might have changes
 */
export async function updateShows() {
  try {
    const shows = await showsDb.getShowsForUpdates();
    cliLogger.info(`Found ${shows.length} shows to check for updates`);
    const { currentDate, pastDate } = generateDateRange(2);

    for (const show of shows) {
      try {
        await sleep(500);
        await checkForShowChanges(show, pastDate, currentDate);
      } catch (error) {
        // Log error but continue with next show
        cliLogger.error(`Failed to check for changes in show ID ${show.id}`, error);
      }
    }
  } catch (error) {
    cliLogger.error('Unexpected error while checking for show updates', error);
    httpLogger.error(ErrorMessages.ShowsChangeFail, { error });
    throw error;
  }
}
