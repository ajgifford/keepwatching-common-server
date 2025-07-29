import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { UpdatePersonResult } from '../types/personTypes';
import { generateDateRange, sleep } from '../utils/changesUtility';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { personService } from './personService';
import { showService } from './showService';

/**
 * Updates movies that might have changes
 */
export async function updateMovies() {
  try {
    const movies = await moviesService.getMoviesForUpdates();
    cliLogger.info(`Found ${movies.length} movies to check for updates`);
    const { currentDate, pastDate } = generateDateRange(10);

    for (const movie of movies) {
      try {
        await sleep(500);
        await moviesService.checkMovieForChanges(movie, pastDate, currentDate);
      } catch (error) {
        // Log error but continue with next movie
        cliLogger.error(`Failed to check for changes in movie ID ${movie.id}`, error);
      }
    }
    await moviesService.invalidateAllMoviesCache();
  } catch (error) {
    cliLogger.error('Unexpected error while checking for movie updates', error);
    appLogger.error(ErrorMessages.MoviesChangeFail, { error });
    throw errorService.handleError(error, 'updateMovies()');
  }
}

/**
 * Updates shows that might have changes
 */
export async function updateShows() {
  try {
    const shows = await showService.getShowsForUpdates();
    cliLogger.info(`Found ${shows.length} shows to check for updates`);
    const { currentDate, pastDate } = generateDateRange(2);

    for (const show of shows) {
      try {
        await sleep(500);
        await showService.checkShowForChanges(show, pastDate, currentDate);
      } catch (error) {
        // Log error but continue with next show
        cliLogger.error(`Failed to check for changes in show ID ${show.id}`, error);
      }
    }
    await showService.invalidateAllShowsCache();
  } catch (error) {
    cliLogger.error('Unexpected error while checking for show updates', error);
    appLogger.error(ErrorMessages.ShowsChangeFail, { error });
    throw errorService.handleError(error, 'updateShows()');
  }
}

/**
 * Updates people that might have changes
 */
export async function updatePeople() {
  try {
    const results: UpdatePersonResult[] = [];
    const startTime = new Date();

    const blockNumber = personService.calculateBlockNumber(startTime);
    const blockInfo = await personService.getTodayBlockInfo();
    cliLogger.info(`Starting daily person update for block ${blockInfo.blockNumber}`, {
      totalPeople: blockInfo.totalPeople,
      date: blockInfo.date,
    });

    const people = await personService.getPeopleForUpdates(blockNumber);
    for (const person of people) {
      try {
        await sleep(500);
        const result = await personService.checkAndUpdatePerson(person);
        results.push(result);
      } catch (error) {
        // Log error but continue with next person
        cliLogger.error(`Failed to check for changes in person ID ${person.id}`, error);
      }
    }
    await showService.invalidateAllShowsCache();

    const endTime = new Date();
    const stats = createPersonJobStats(blockInfo, results, startTime, endTime);
    cliLogger.info('Daily person update completed', {
      blockNumber: stats.blockNumber,
      processed: stats.processed,
      successful: stats.successful,
      updated: stats.updated,
      failed: stats.failed,
      duration: `${stats.duration}ms`,
    });
  } catch (error) {
    cliLogger.error('Unexpected error while checking for person updates', error);
    appLogger.error(ErrorMessages.PeopleChangeFail, { error });
    throw errorService.handleError(error, 'updatePeople()');
  }
}

function createPersonJobStats(
  blockInfo: { date: string; blockNumber: number; totalPeople: number },
  results: UpdatePersonResult[],
  startTime: Date,
  endTime: Date,
) {
  return {
    date: blockInfo.date,
    blockNumber: blockInfo.blockNumber,
    totalPeople: blockInfo.totalPeople,
    processed: results.length,
    successful: results.filter((r) => r.success).length,
    updated: results.filter((r) => r.hadUpdates).length,
    failed: results.filter((r) => !r.success).length,
    duration: endTime.getTime() - startTime.getTime(),
    startTime,
    endTime,
  };
}
