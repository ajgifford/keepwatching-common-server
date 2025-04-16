import * as episodesDb from '../db/episodesDb';
import * as seasonsDb from '../db/seasonsDb';
import { cliLogger } from '../logger/logger';
import { ChangeItem, ContentUpdates } from '../types/contentTypes';
import { filterUniqueSeasonIds, sleep } from '../utils/changesUtility';
import { checkSeasonForEpisodeChanges } from './episodeChangesService';
import { seasonsService } from './seasonsService';
import { getTMDBService } from './tmdbService';

/**
 * Process season changes for a show
 * @param changes Season change items from TMDB
 * @param responseShow Full show details from TMDB
 * @param content Basic show info from our database
 * @param profileIds Profile IDs that have this show in their watchlist
 * @param pastDate Date past date used as the start of the change window
 * @param currentDate Date current date used as the end of the change window
 */
export async function processSeasonChanges(
  changes: ChangeItem[],
  responseShow: any,
  content: ContentUpdates,
  profileIds: number[],
  pastDate: string,
  currentDate: string,
) {
  const tmdbService = getTMDBService();
  const uniqueSeasonIds = filterUniqueSeasonIds(changes);
  const responseShowSeasons = responseShow.seasons || [];

  for (const seasonId of uniqueSeasonIds) {
    try {
      await sleep(500); // Rate limiting

      // Find the season in the show data
      const seasonInfo = responseShowSeasons.find((season: { id: number }) => season.id === seasonId);

      // Skip "season 0" (specials) and missing seasons
      if (!seasonInfo || seasonInfo.season_number === 0) {
        continue;
      }

      // Create Season object with updated data
      const updatedSeason = seasonsDb.createSeason(
        content.id,
        seasonInfo.id,
        seasonInfo.name,
        seasonInfo.overview,
        seasonInfo.season_number,
        seasonInfo.air_date,
        seasonInfo.poster_path,
        seasonInfo.episode_count,
      );

      // Update the season in our database
      await seasonsDb.updateSeason(updatedSeason);

      // Add this season to all profiles that have the show
      for (const profileId of profileIds) {
        await seasonsDb.saveFavorite(profileId, updatedSeason.id!);
      }

      // Check if there are episode changes for this season
      const hasEpisodeChanges = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      if (hasEpisodeChanges) {
        // Get detailed season info including episodes
        const seasonDetails = await tmdbService.getSeasonDetails(content.tmdb_id, updatedSeason.season_number);
        const episodes = seasonDetails.episodes || [];

        // Update each episode
        for (const episodeData of episodes) {
          const episode = await episodesDb.updateEpisode(
            episodesDb.createEpisode(
              episodeData.id,
              content.id,
              updatedSeason.id!,
              episodeData.episode_number,
              episodeData.episode_type || 'standard',
              episodeData.season_number,
              episodeData.name,
              episodeData.overview,
              episodeData.air_date,
              episodeData.runtime || 0,
              episodeData.still_path,
            ),
          );

          // Add this episode to all profiles that have the show
          for (const profileId of profileIds) {
            await episodesDb.saveFavorite(profileId, episode.id!);
          }
        }

        // Update watch status for all affected profiles
        for (const profileId of profileIds) {
          await seasonsService.updateSeasonWatchStatusForNewEpisodes(String(profileId), updatedSeason.id!);
        }
      }
    } catch (error) {
      // Log error but continue with next season
      cliLogger.error(`Error processing season ID ${seasonId} for show ${content.id}`, error);
    }
  }
}
