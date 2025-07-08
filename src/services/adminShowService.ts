import { ADMIN_KEYS, SHOW_KEYS } from '../constants/cacheKeys';
import * as episodesDb from '../db/episodesDb';
import * as personsDb from '../db/personsDb';
import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBGenre, TMDBShow, TMDBShowCastMember, TMDBShowSeason } from '../types/tmdbTypes';
import { sleep } from '../utils/changesUtility';
import { getEpisodeToAirId, getInProduction, getUSNetwork, getUSRating } from '../utils/contentUtility';
import { getUSWatchProvidersShow } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { showService } from './showService';
import { socketService } from './socketService';
import { getTMDBService } from './tmdbService';
import { CreateShowCast, UpdateShowRequest } from '@ajgifford/keepwatching-types';

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
      return await this.cache.getOrSet(ADMIN_KEYS.allShows(page, offset, limit), async () => {
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
    } catch (error) {
      throw errorService.handleError(error, `getAllShows(${page}, ${offset}, ${limit})`);
    }
  }

  public async getAllShowReferences() {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.allShowReferences(), async () => {
        return await showsDb.getAllShowReferences();
      });
    } catch (error) {
      throw errorService.handleError(error, `getAllShowReferences()`);
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

  public async updateAllShows() {
    try {
      cliLogger.info('updateAllShows -- Started');
      const showReferences = await this.getAllShowReferences();
      for (const reference of showReferences) {
        this.updateShowById(reference.id, reference.tmdbId);
      }
      cliLogger.info('updateAllShows -- Ended');
    } catch (error) {
      cliLogger.info('updateAllShows -- Error');
      throw errorService.handleError(error, `updateAllShows()`);
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

      const updatedShow: UpdateShowRequest = {
        id: showId,
        tmdb_id: showDetails.id,
        title: showDetails.name,
        description: showDetails.overview,
        release_date: showDetails.first_air_date,
        poster_image: showDetails.poster_path,
        backdrop_image: showDetails.backdrop_path,
        user_rating: showDetails.vote_average,
        content_rating: getUSRating(showDetails.content_ratings),
        streaming_service_ids: getUSWatchProvidersShow(showDetails),
        season_count: showDetails.number_of_seasons,
        episode_count: showDetails.number_of_episodes,
        genre_ids: showDetails.genres.map((genre: TMDBGenre) => genre.id),
        status: showDetails.status,
        type: showDetails.type,
        in_production: getInProduction(showDetails),
        last_air_date: showDetails.last_air_date,
        last_episode_to_air: getEpisodeToAirId(showDetails.last_episode_to_air),
        next_episode_to_air: getEpisodeToAirId(showDetails.next_episode_to_air),
        network: getUSNetwork(showDetails.networks),
      };

      const showUpdated = await showsDb.updateShow(updatedShow);
      if (!showUpdated) {
        return false;
      }

      this.processShowCast(showDetails, showId);

      this.invalidateAllShows();
      this.invalidateShowCache(showId);

      const seasons = showDetails.seasons || [];
      const validSeasons = seasons
        .filter((season: TMDBShowSeason) => season.season_number > 0)
        .sort((a: TMDBShowSeason, b: TMDBShowSeason) => b.season_number - a.season_number);
      const seasonsToUpdate = updateMode === 'latest' ? validSeasons.slice(0, 1) : validSeasons;

      const profileForShow = await showsDb.getProfilesForShow(showId);

      for (const responseSeason of seasonsToUpdate) {
        await sleep(500);

        try {
          const responseData = await tmdbService.getSeasonDetails(showDetails.id, responseSeason.season_number);

          const seasonId = await seasonsDb.updateSeason({
            show_id: showId,
            tmdb_id: responseSeason.id,
            name: responseSeason.name,
            overview: responseSeason.overview,
            season_number: responseSeason.season_number,
            release_date: responseSeason.air_date,
            poster_image: responseSeason.poster_path,
            number_of_episodes: responseSeason.episode_count,
          });

          for (const mapping of profileForShow.profileAccountMappings) {
            await seasonsDb.saveFavorite(mapping.profileId, seasonId);
          }

          for (const responseEpisode of responseData.episodes) {
            const episodeId = await episodesDb.updateEpisode({
              tmdb_id: responseEpisode.id,
              show_id: showId,
              season_id: seasonId,
              episode_number: responseEpisode.episode_number,
              episode_type: responseEpisode.episode_type,
              season_number: responseEpisode.season_number,
              title: responseEpisode.name,
              overview: responseEpisode.overview,
              air_date: responseEpisode.air_date,
              runtime: responseEpisode.runtime,
              still_image: responseEpisode.still_path,
            });
            for (const mapping of profileForShow.profileAccountMappings) {
              await episodesDb.saveFavorite(mapping.profileId, episodeId);
            }
          }
        } catch (error) {
          cliLogger.error(`Error updating season ${responseSeason.season_number} for show ${showId}`, error);
        }
      }

      await showService.checkAndUpdateShowStatus(showId, profileForShow.profileAccountMappings);

      for (const mapping of profileForShow.profileAccountMappings) {
        this.cache.invalidate(SHOW_KEYS.detailsForProfile(mapping.profileId, showId));
        this.cache.invalidateProfileShows(mapping.accountId, mapping.profileId);
        this.cache.invalidatePattern('allShows_');
      }

      socketService.notifyShowsUpdate(`Show ${showDetails.name} has been updated`);

      return true;
    } catch (error) {
      appLogger.error(ErrorMessages.ShowChangeFail, { error, showId });
      throw errorService.handleError(error, `updateShowById(${showId})`);
    }
  }

  private async processShowCast(show: TMDBShow, showId: number) {
    try {
      const activeCast = show.credits.cast ?? [];
      const activeCreditIds = activeCast.map((member) => member.credit_id);
      const allCast = show.aggregate_credits.cast ?? [];
      const filteredCast = this.filterShowCastMembers(allCast, showId, activeCreditIds);

      for (const castMember of filteredCast) {
        const person = await personsDb.findPersonByTMDBId(castMember.person_id);
        let personId = null;
        if (person) {
          personId = person.id;
        } else {
          const tmdbPerson = await getTMDBService().getPersonDetails(castMember.person_id);
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
        personsDb.saveShowCast({
          content_id: showId,
          person_id: personId,
          character_name: castMember.character_name,
          credit_id: castMember.credit_id,
          cast_order: castMember.cast_order,
          total_episodes: castMember.total_episodes,
          active: castMember.active,
        });

        this.cache.invalidatePerson(personId);
      }
    } catch (error) {
      cliLogger.error('Error fetching show cast:', error);
    }
  }

  private filterShowCastMembers(
    showCastMembers: TMDBShowCastMember[],
    contentId: number,
    activeCreditIds: string[],
  ): CreateShowCast[] {
    const activeCreditIdSet = new Set(activeCreditIds);

    return showCastMembers.flatMap((showMember) =>
      showMember.roles
        .filter((role) => role.episode_count >= 2)
        .map((role) => ({
          content_id: contentId,
          person_id: showMember.id,
          character_name: role.character,
          credit_id: role.credit_id,
          cast_order: showMember.order,
          total_episodes: role.episode_count,
          active: activeCreditIdSet.has(role.credit_id) ? 1 : 0,
        })),
    );
  }

  public invalidateAllShows(): void {
    this.cache.invalidatePattern('allShows_');
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
