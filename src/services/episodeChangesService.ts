import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBChange } from '../types/tmdbTypes';
import { getTMDBService } from './tmdbService';

/**
 * Check if a season has episode changes
 * @param seasonId Season ID to check
 * @param pastDate Date past date used as the start of the change window
 * @param currentDate Date current date used as the end of the change window
 * @returns True if there are episode changes, false otherwise
 */
export async function checkSeasonForEpisodeChanges(
  seasonId: number,
  pastDate: string,
  currentDate: string,
): Promise<boolean> {
  const tmdbService = getTMDBService();

  try {
    const changesData = await tmdbService.getSeasonChanges(seasonId, pastDate, currentDate);
    const changes: TMDBChange[] = changesData.changes || [];
    return changes.some((item) => item.key === 'episode');
  } catch (error) {
    cliLogger.error(`Error checking changes for season ID ${seasonId}`, error);
    appLogger.error(ErrorMessages.SeasonChangeFail, { error, seasonId });
    return false;
  }
}
