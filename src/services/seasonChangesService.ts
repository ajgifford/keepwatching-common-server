import { cliLogger } from '../logger/logger';
import { ContentUpdates } from '../types/contentTypes';
import { TMDBChange, TMDBShow } from '../types/tmdbTypes';
import { filterUniqueSeasonIds, sleep } from '../utils/changesUtility';
import { checkSeasonForEpisodeChanges } from './episodeChangesService';
import { episodesService } from './episodesService';
import { seasonsService } from './seasonsService';
import { getTMDBService } from './tmdbService';
import { ProfileAccountMapping, WatchStatus } from '@ajgifford/keepwatching-types';

/**
 * Process season changes for a show
 * @param change Season change items from TMDB
 * @param responseShow Full show details from TMDB
 * @param content Basic show info from our database
 * @param profileIds Profile IDs that have this show in their watchlist
 * @param pastDate Date past date used as the start of the change window
 * @param currentDate Date current date used as the end of the change window
 */
export async function processSeasonChanges(
  change: TMDBChange,
  responseShow: TMDBShow,
  content: ContentUpdates,
  profileAccountMappings: ProfileAccountMapping[],
  pastDate: string,
  currentDate: string,
): Promise<void> {
  const tmdbService = getTMDBService();
  const uniqueSeasonIds = filterUniqueSeasonIds(change);
  const responseShowSeasons = responseShow.seasons || [];

  for (const uniqueSeasonId of uniqueSeasonIds) {
    try {
      await sleep(500); // Rate limiting
      const now = new Date();

      // Find the season in the show data
      const seasonInfo = responseShowSeasons.find((season: { id: number }) => season.id === uniqueSeasonId);

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
      const seasonId = await seasonsService.updateSeason(updatedSeason);

      // Add this season to all profiles that have the show
      for (const mapping of profileAccountMappings) {
        await seasonsService.addSeasonToFavorites(
          mapping.profileId,
          seasonId,
          new Date(seasonInfo.air_date) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
        );
      }

      // For seasons that have aired, always fetch episodes to ensure completeness
      // This prevents gaps when TMDB doesn't report episode changes within our time window
      const seasonHasAired = new Date(seasonInfo.air_date) <= now;
      const hasEpisodeChanges = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      if (seasonHasAired || hasEpisodeChanges) {
        // Get detailed season info including episodes
        const seasonDetails = await tmdbService.getSeasonDetails(content.tmdb_id, updatedSeason.season_number);
        const episodes = seasonDetails.episodes || [];

        // Update each episode
        for (const episodeData of episodes) {
          const episodeToUpdate = {
            tmdb_id: episodeData.id,
            show_id: content.id,
            season_id: seasonId,
            episode_number: episodeData.episode_number,
            episode_type: episodeData.episode_type || 'standard',
            season_number: episodeData.season_number,
            title: episodeData.name,
            overview: episodeData.overview,
            air_date: episodeData.air_date,
            runtime: episodeData.runtime || 0,
            still_image: episodeData.still_path,
          };

          const episodeId = await episodesService.updateEpisode(episodeToUpdate);

          // Add this episode to all profiles that have the show
          for (const mapping of profileAccountMappings) {
            await episodesService.addEpisodeToFavorites(
              mapping.profileId,
              episodeId,
              new Date(episodeData.air_date) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
            );
          }
        }
      }
    } catch (error) {
      // Log error but continue with next season
      cliLogger.error(`Error processing season ID ${uniqueSeasonId} for show ${content.id}`, error);
    }
  }
}
