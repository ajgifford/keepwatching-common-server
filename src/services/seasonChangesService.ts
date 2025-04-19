import { cliLogger } from '../logger/logger';
import { ChangeItem, ContentUpdates } from '../types/contentTypes';
import { filterUniqueSeasonIds, sleep } from '../utils/changesUtility';
import { checkSeasonForEpisodeChanges } from './episodeChangesService';
import { episodesService } from './episodesService';
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
      const updatedSeason = {
        show_id: content.id,
        tmdb_id: seasonInfo.id,
        name: seasonInfo.name,
        overview: seasonInfo.overview,
        season_number: seasonInfo.season_number,
        release_date: seasonInfo.air_date,
        poster_image: seasonInfo.poster_path,
        number_of_episodes: seasonInfo.episode_count,
      };

      // Update the season through the service layer
      const seasonResult = await seasonsService.updateSeason(updatedSeason);

      // Add this season to all profiles that have the show
      for (const profileId of profileIds) {
        await seasonsService.addSeasonToFavorites(profileId, seasonResult.id!);
      }

      // Check if there are episode changes for this season
      const hasEpisodeChanges = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      if (hasEpisodeChanges) {
        // Get detailed season info including episodes
        const seasonDetails = await tmdbService.getSeasonDetails(content.tmdb_id, updatedSeason.season_number);
        const episodes = seasonDetails.episodes || [];

        // Update each episode
        for (const episodeData of episodes) {
          const episodeToUpdate = {
            tmdb_id: episodeData.id,
            show_id: content.id,
            season_id: seasonResult.id!,
            episode_number: episodeData.episode_number,
            episode_type: episodeData.episode_type || 'standard',
            season_number: episodeData.season_number,
            title: episodeData.name,
            overview: episodeData.overview,
            air_date: episodeData.air_date,
            runtime: episodeData.runtime || 0,
            still_image: episodeData.still_path,
          };

          const episode = await episodesService.updateEpisode(episodeToUpdate);

          // Add this episode to all profiles that have the show
          for (const profileId of profileIds) {
            await episodesService.addEpisodeToFavorites(profileId, episode.id!);
          }
        }

        // Update watch status for all affected profiles
        for (const profileId of profileIds) {
          await seasonsService.updateSeasonWatchStatusForNewEpisodes(String(profileId), seasonResult.id!);
        }
      }
    } catch (error) {
      // Log error but continue with next season
      cliLogger.error(`Error processing season ID ${seasonId} for show ${content.id}`, error);
    }
  }
}
