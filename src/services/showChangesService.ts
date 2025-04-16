import * as showsDb from '../db/showsDb';
import { cliLogger, httpLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { Change, ContentUpdates } from '../types/contentTypes';
import { SUPPORTED_CHANGE_KEYS } from '../utils/changesUtility';
import { getEpisodeToAirId, getInProduction, getUSNetwork, getUSRating } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { errorService } from './errorService';
import { processSeasonChanges } from './seasonChangesService';
import { showService } from './showService';
import { getTMDBService } from './tmdbService';

/**
 * Check for changes to a specific show and update if necessary
 * @param content Show to check for changes
 * @param pastDate Date past date used as the start of the change window
 * @param currentDate Date current date used as the end of the change window
 */
export async function checkForShowChanges(content: ContentUpdates, pastDate: string, currentDate: string) {
  const tmdbService = getTMDBService();

  try {
    const changesData = await tmdbService.getShowChanges(content.tmdb_id, pastDate, currentDate);
    const changes: Change[] = changesData.changes || [];

    const supportedChanges = changes.filter((item) => SUPPORTED_CHANGE_KEYS.includes(item.key));

    if (supportedChanges.length > 0) {
      const showDetails = await tmdbService.getShowDetails(content.tmdb_id);

      const updatedShow = showsDb.createShow(
        showDetails.id,
        showDetails.name,
        showDetails.overview,
        showDetails.first_air_date,
        showDetails.poster_path,
        showDetails.backdrop_path,
        showDetails.vote_average,
        getUSRating(showDetails.content_ratings),
        content.id,
        getUSWatchProviders(showDetails, 9999),
        showDetails.number_of_episodes,
        showDetails.number_of_seasons,
        showDetails.genres.map((genre: { id: any }) => genre.id),
        showDetails.status,
        showDetails.type,
        getInProduction(showDetails),
        showDetails.last_air_date,
        getEpisodeToAirId(showDetails.last_episode_to_air),
        getEpisodeToAirId(showDetails.next_episode_to_air),
        getUSNetwork(showDetails.networks),
      );

      await showsDb.updateShow(updatedShow);

      const profileIds = await showsDb.getProfilesForShow(updatedShow.id!);

      const seasonChanges = changes.filter((item) => item.key === 'season');
      if (seasonChanges.length > 0) {
        await processSeasonChanges(seasonChanges[0].items, showDetails, content, profileIds, pastDate, currentDate);
        await showService.updateShowWatchStatusForNewContent(updatedShow.id!, profileIds);
      }
    }
  } catch (error) {
    cliLogger.error(`Error checking changes for show ID ${content.id}`, error);
    httpLogger.error(ErrorMessages.ShowChangeFail, { error, showId: content.id });
    throw errorService.handleError(error, `checkForShowChanges(${content.id})`);
  }
}
