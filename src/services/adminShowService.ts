import { ADMIN_KEYS, PROFILE_KEYS, SHOW_KEYS } from '../constants/cacheKeys';
import * as episodesDb from '../db/episodesDb';
import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { sleep } from '../utils/changesUtility';
import { getEpisodeToAirId, getInProduction, getUSNetwork, getUSRating } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { seasonsService } from './seasonsService';
import { showService } from './showService';
import { socketService } from './socketService';
import { getTMDBService } from './tmdbService';

/**
 * Service for handling admin-specific show operations
 * Provides caching and error handling on top of the repository layer
 */
export class AdminShowService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  public async getAllShows(page: number, offset: number, limit: number) {
    try {
      const allShowsResult = this.cache.getOrSet(ADMIN_KEYS.allShows(page, offset, limit), async () => {
        const [totalCount, shows] = await Promise.all([showsDb.getShowsCount(), showsDb.getAllShows(limit, offset)]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
          shows,
          pagination: {
            totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      });
      return allShowsResult;
    } catch (error) {
      throw errorService.handleError(error, `getAllShows(${page}, ${offset}, ${limit})`);
    }
  }

  /**
   * Get detailed information about a show for administrative purposes
   *
   * @param showId - ID of the show to retrieve
   * @returns Detailed show information
   */
  public async getShowDetails(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showDetails(showId),
        () => showsDb.getAdminShowDetails(showId),
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowDetails(${showId})`);
    }
  }

  /**
   * Get all seasons for a show
   *
   * @param showId - ID of the show to get seasons for
   * @returns Array of seasons belonging to the show
   */
  public async getShowSeasons(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showSeasons(showId),
        () => showsDb.getAdminShowSeasons(showId),
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowSeasons(${showId})`);
    }
  }

  /**
   * Get all seasons with their episodes for a show in a single efficient query
   *
   * @param showId - ID of the show to get seasons and episodes for
   * @returns Array of seasons with their episodes already populated
   */
  public async getShowSeasonsWithEpisodes(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showSeasonsWithEpisodes(showId),
        () => showsDb.getAdminShowSeasonsWithEpisodes(showId),
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowSeasonsWithEpisodes(${showId})`);
    }
  }

  /**
   * Get all episodes for a specific season
   *
   * @param seasonId - ID of the season to get episodes for
   * @returns Array of episodes belonging to the season
   */
  public async getSeasonEpisodes(seasonId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.seasonEpisodes(seasonId),
        () => showsDb.getAdminSeasonEpisodes(seasonId),
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getSeasonEpisodes(${seasonId})`);
    }
  }

  /**
   * Get all profiles that have this show in their favorites
   *
   * @param showId - ID of the show to get profiles for
   * @returns Array of profiles watching the show
   */
  public async getShowProfiles(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showProfiles(showId),
        () => showsDb.getAdminShowProfiles(showId),
        300, // 5 minutes TTL (shorter since this can change more frequently)
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowProfiles(${showId})`);
    }
  }

  /**
   * Get detailed watch progress stats for all profiles watching a show
   *
   * @param showId - ID of the show to get watch progress for
   * @returns Object with detailed watch progress by profile
   */
  public async getShowWatchProgress(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showWatchProgress(showId),
        () => showsDb.getAdminShowWatchProgress(showId),
        300, // 5 minutes TTL (shorter since this can change more frequently)
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowWatchProgress(${showId})`);
    }
  }

  /**
   * Get all information about a show for administrative display
   * This combines all the separate calls in a single method
   *
   * @param showId - ID of the show to get comprehensive information for
   * @returns Object containing all show information
   */
  public async getCompleteShowInfo(showId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.showComplete(showId),
        async () => {
          // Use the optimized method to get seasons with episodes in a single query
          const [details, seasonsWithEpisodes, profiles, watchProgress] = await Promise.all([
            showsDb.getAdminShowDetails(showId),
            showsDb.getAdminShowSeasonsWithEpisodes(showId),
            showsDb.getAdminShowProfiles(showId),
            showsDb.getAdminShowWatchProgress(showId),
          ]);

          return {
            details,
            seasons: seasonsWithEpisodes,
            profiles,
            watchProgress,
          };
        },
        300, // 5 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getCompleteShowInfo(${showId})`);
    }
  }

  public async updateShowById(
    showId: number,
    tmdbId: number,
    updateMode: 'all' | 'latest' = 'latest',
  ): Promise<boolean> {
    try {
      const tmdbService = getTMDBService();
      const showDetails = await tmdbService.getShowDetails(tmdbId);

      const updatedShow = showsDb.createShow(
        showDetails.id,
        showDetails.name,
        showDetails.overview,
        showDetails.first_air_date,
        showDetails.poster_path,
        showDetails.backdrop_path,
        showDetails.vote_average,
        getUSRating(showDetails.content_ratings),
        showId,
        getUSWatchProviders(showDetails, 9999),
        showDetails.number_of_seasons,
        showDetails.number_of_episodes,
        showDetails.genres.map((genre: { id: any }) => genre.id),
        showDetails.status,
        showDetails.type,
        getInProduction(showDetails),
        showDetails.last_air_date,
        getEpisodeToAirId(showDetails.last_episode_to_air),
        getEpisodeToAirId(showDetails.next_episode_to_air),
        getUSNetwork(showDetails.networks),
      );

      const showUpdated = await showsDb.updateShow(updatedShow);
      if (!showUpdated) {
        return false;
      }

      const seasons = showDetails.seasons || [];
      const validSeasons = seasons
        .filter((season: any) => season.season_number > 0)
        .sort((a: any, b: any) => b.season_number - a.season_number);
      const seasonsToUpdate = updateMode === 'latest' ? validSeasons.slice(0, 1) : validSeasons;

      const profileIds = await showsDb.getProfilesForShow(showId);

      for (const responseSeason of seasonsToUpdate) {
        await sleep(500);

        try {
          const responseData = await tmdbService.getSeasonDetails(showDetails.id, responseSeason.season_number);

          const season = await seasonsDb.updateSeason(
            seasonsDb.createSeason(
              showId,
              responseSeason.id,
              responseSeason.name,
              responseSeason.overview,
              responseSeason.season_number,
              responseSeason.air_date,
              responseSeason.poster_path,
              responseSeason.episode_count,
            ),
          );

          for (const profileId of profileIds) {
            await seasonsDb.saveFavorite(profileId, season.id!);
          }

          for (const responseEpisode of responseData.episodes) {
            const episode = await episodesDb.updateEpisode(
              episodesDb.createEpisode(
                responseEpisode.id,
                showId,
                season.id!,
                responseEpisode.episode_number,
                responseEpisode.episode_type || 'standard',
                responseEpisode.season_number,
                responseEpisode.name,
                responseEpisode.overview,
                responseEpisode.air_date,
                responseEpisode.runtime || 0,
                responseEpisode.still_path,
              ),
            );
            for (const profileId of profileIds) {
              await episodesDb.saveFavorite(profileId, episode.id!);
            }
          }

          for (const profileId of profileIds) {
            await seasonsService.updateSeasonWatchStatusForNewEpisodes(String(profileId), season.id!);
          }
        } catch (error) {
          cliLogger.error(`Error updating season ${responseSeason.season_number} for show ${showId}`, error);
        }
      }

      await showService.updateShowWatchStatusForNewContent(showId, profileIds);

      for (const profileId of profileIds) {
        this.cache.invalidate(SHOW_KEYS.detailsForProfile(profileId, showId));
        this.cache.invalidate(PROFILE_KEYS.shows(profileId));
        this.cache.invalidate(PROFILE_KEYS.nextUnwatchedEpisodes(profileId));
        this.cache.invalidatePattern('allShows_');
      }

      socketService.notifyShowsUpdate(`Show ${showDetails.name} has been updated`);

      return true;
    } catch (error) {
      appLogger.error(ErrorMessages.ShowChangeFail, { error, showId });
      throw errorService.handleError(error, `updateShowById(${showId})`);
    }
  }

  /**
   * Invalidate all cache entries related to a specific show
   *
   * @param showId - ID of the show to invalidate cache for
   */
  public invalidateShowCache(showId: number): void {
    this.cache.invalidate(ADMIN_KEYS.showDetails(showId));
    this.cache.invalidate(ADMIN_KEYS.showSeasons(showId));
    this.cache.invalidate(ADMIN_KEYS.showSeasonsWithEpisodes(showId));
    this.cache.invalidate(ADMIN_KEYS.showProfiles(showId));
    this.cache.invalidate(ADMIN_KEYS.showWatchProgress(showId));
    this.cache.invalidate(ADMIN_KEYS.showComplete(showId));
    this.cache.invalidatePattern(ADMIN_KEYS.showSeasonsPattern(showId));
  }
}

// Export a singleton instance for global use
export const adminShowService = new AdminShowService();
