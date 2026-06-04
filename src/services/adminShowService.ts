import { ADMIN_KEYS, SHOW_KEYS } from '../constants/cacheKeys';
import * as episodesDb from '../db/episodesDb';
import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { ShowFilterOptions } from '../db/showsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBGenre, TMDBShowSeason } from '../types/tmdbTypes';
import { sleep } from '../utils/changesUtility';
import { getEpisodeToAirId, getInProduction, getUSNetwork, getUSRating } from '../utils/contentUtility';
import { createNewSeasonNotifications } from '../utils/notificationUtility';
import { getUSWatchProvidersShow } from '../utils/watchProvidersUtility';
import { BaseShowService } from './baseShowService';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { showService } from './showService';
import { socketService } from './socketService';
import { getTMDBService } from './tmdbService';
import { UpdateShowRequest, WatchStatus } from '@ajgifford/keepwatching-types';

/**
 * Service for handling admin-specific show operations
 * Provides caching and error handling on top of the repository layer
 */
export class AdminShowService extends BaseShowService {
  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    super(dependencies);
  }

  /**
   * Get all shows with pagination for administrative purposes
   *
   * @param page - Current page number
   * @param offset - Number of items to skip
   * @param limit - Maximum number of items to return
   * @returns Paginated shows data with pagination metadata
   */
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

  /**
   * Get all shows with optional filtering by type, status, network, or streaming service
   *
   * This method extends getAllShows by allowing optional filters to narrow down results.
   * Note: This method does not fetch total count with filters applied, so pagination
   * metadata reflects the unfiltered total. For accurate counts with filters, consider
   * adding a separate count method with filter support.
   *
   * @param filters - Optional filters (type, status, network, streamingService)
   * @param page - Current page number
   * @param offset - Number of items to skip
   * @param limit - Maximum number of items to return
   * @returns Paginated shows data with pagination metadata
   *
   * @example
   * ```typescript
   * // Get ended shows on page 1
   * const result = await adminShowService.getAllShowsFiltered(
   *   { status: 'Ended' },
   *   1,
   *   0,
   *   50
   * );
   * ```
   */
  public async getAllShowsFiltered(
    filters: {
      type?: string;
      status?: string;
      network?: string;
      streamingService?: string;
    },
    page: number,
    offset: number,
    limit: number,
  ): Promise<{
    shows: Awaited<ReturnType<typeof showsDb.getAllShowsFiltered>>;
    pagination: {
      totalCount: number;
      totalPages: number;
      currentPage: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    filters: ShowFilterOptions;
  }> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.allShowsFiltered(
          page,
          offset,
          limit,
          filters.type,
          filters.status,
          filters.network,
          filters.streamingService,
        ),
        async () => {
          const hasFilters = filters.type || filters.status || filters.network || filters.streamingService;
          const [totalCount, shows, filterOptions] = await Promise.all([
            hasFilters ? showsDb.getShowsCountFiltered(filters) : showsDb.getShowsCount(),
            showsDb.getAllShowsFiltered(filters, limit, offset),
            showsDb.getShowFilterOptions(),
          ]);
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
            filters: filterOptions,
          };
        },
      );
    } catch (error) {
      throw errorService.handleError(
        error,
        `getAllShowsFiltered(${JSON.stringify(filters)}, ${page}, ${offset}, ${limit})`,
      );
    }
  }

  /**
   * Get all shows with pagination for administrative purposes for a specific profile
   *
   * @param profileId - Profile id to get the shows for
   * @param page - Current page number
   * @param offset - Number of items to skip
   * @param limit - Maximum number of items to return
   * @returns Paginated shows data with pagination metadata
   */
  public async getAllShowsByProfile(profileId: number, page: number, offset: number, limit: number) {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.allShowsByProfile(profileId, page, offset, limit), async () => {
        const [totalCount, shows] = await Promise.all([
          showsDb.getShowsCountByProfile(profileId),
          showsDb.getAllShowsByProfile(profileId, limit, offset),
        ]);
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
      throw errorService.handleError(error, `getAllShowsByProfile(${profileId}, ${page}, ${offset}, ${limit})`);
    }
  }

  /**
   * Get all show references (id and tmdbId pairs) for batch operations
   *
   * @returns Array of show references containing id and tmdbId
   */
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
   * Get all shows that have potential duplicate episodes across the entire catalog
   *
   * @returns Array of shows with duplicate group and extra episode counts
   */
  public async getShowsWithDuplicates() {
    try {
      return await showsDb.getShowsWithDuplicateEpisodes();
    } catch (error) {
      throw errorService.handleError(error, 'getShowsWithDuplicates()');
    }
  }

  /**
   * Get all episodes that are potential duplicates (same episode_number within the same season) for a show
   *
   * @param showId - ID of the show to check for duplicate episodes
   * @returns Array of episodes that have duplicates within their season
   */
  public async getDuplicateEpisodes(showId: number) {
    try {
      return await showsDb.getDuplicateEpisodesForShow(showId);
    } catch (error) {
      throw errorService.handleError(error, `getDuplicateEpisodes(${showId})`);
    }
  }

  /**
   * Get all shows that have potential duplicate seasons (same season_number within the same show)
   *
   * @returns Array of shows with duplicate season counts
   */
  public async getShowsWithDuplicateSeasons() {
    try {
      return await showsDb.getShowsWithDuplicateSeasons();
    } catch (error) {
      throw errorService.handleError(error, 'getShowsWithDuplicateSeasons()');
    }
  }

  /**
   * Get all seasons that are potential duplicates (same season_number) for a show
   *
   * @param showId - ID of the show to check for duplicate seasons
   * @returns Array of seasons that have duplicates within the show
   */
  public async getDuplicateSeasons(showId: number) {
    try {
      return await showsDb.getDuplicateSeasonsForShow(showId);
    } catch (error) {
      throw errorService.handleError(error, `getDuplicateSeasons(${showId})`);
    }
  }

  /**
   * Delete an episode and all its associated watch data, then invalidate show cache
   *
   * @param episodeId - ID of the episode to delete
   * @param showId - ID of the parent show (used for cache invalidation)
   */
  public async deleteEpisode(episodeId: number, showId: number) {
    try {
      await episodesDb.deleteEpisodeById(episodeId);
      this.invalidateShowCache(showId);
    } catch (error) {
      throw errorService.handleError(error, `deleteEpisode(${episodeId})`);
    }
  }

  /**
   * Delete a season and all its associated episodes and watch data, then invalidate show cache
   *
   * @param seasonId - ID of the season to delete
   * @param showId - ID of the parent show (used for cache invalidation)
   */
  public async deleteSeason(seasonId: number, showId: number) {
    try {
      await seasonsDb.deleteSeasonById(seasonId);
      this.invalidateShowCache(showId);
      this.cache.invalidate(ADMIN_KEYS.seasonEpisodes(seasonId));
    } catch (error) {
      throw errorService.handleError(error, `deleteSeason(${seasonId})`);
    }
  }

  /**
   * Get all show_cast rows that are part of a duplicate group across the entire catalog
   *
   * @returns Array of duplicate cast groups ready for resolution
   */
  public async getDuplicateCastCredits() {
    try {
      return await showsDb.getDuplicateCastCredits();
    } catch (error) {
      throw errorService.handleError(error, 'getDuplicateCastCredits()');
    }
  }

  /**
   * Delete a single show_cast row by credit_id
   *
   * @param creditId - The TMDB credit ID of the row to delete
   */
  public async deleteCastCredit(creditId: string) {
    try {
      await showsDb.deleteCastCredit(creditId);
    } catch (error) {
      throw errorService.handleError(error, `deleteCastCredit(${creditId})`);
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

  /**
   * Update all shows in the database by fetching latest data from TMDB
   * This method processes all shows sequentially to avoid rate limiting
   */
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

  /**
   * Update a specific show by fetching latest data from TMDB
   * Includes updating show details, cast, seasons, and episodes
   *
   * @param showId - Database ID of the show to update
   * @param tmdbId - TMDB ID of the show
   * @param updateMode - Whether to update 'all' seasons or just the 'latest' season
   * @returns Promise that resolves to true if update was successful, false otherwise
   */
  public async updateShowById(
    showId: number,
    tmdbId: number,
    updateMode: 'all' | 'latest' = 'latest',
  ): Promise<boolean> {
    try {
      // Get current show details to track season count changes
      const currentShow = await showsDb.getAdminShowDetails(showId);
      const previousSeasonCount = currentShow.seasonCount;

      const tmdbService = getTMDBService();
      const showDetails = await tmdbService.getShowDetails(tmdbId);
      const newSeasonCount = showDetails.number_of_seasons;

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
        streaming_service_ids: await getUSWatchProvidersShow(showDetails),
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
      const now = new Date();

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
              await episodesDb.saveFavorite(
                mapping.profileId,
                episodeId,
                !responseEpisode.air_date || new Date(responseEpisode.air_date) > now
                  ? WatchStatus.UNAIRED
                  : WatchStatus.NOT_WATCHED,
              );
            }
          }
        } catch (error) {
          cliLogger.error(`Error updating season ${responseSeason.season_number} for show ${showId}`, error);
        }
      }

      await showService.checkAndUpdateShowStatus(showId, profileForShow.profileAccountMappings);

      // Create notifications if new seasons were added
      if (newSeasonCount > previousSeasonCount) {
        await createNewSeasonNotifications(showDetails.name, newSeasonCount, profileForShow.profileAccountMappings);
      }

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

  /**
   * Invalidate all cached show data across the application
   */
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

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createAdminShowService(dependencies?: { cacheService?: CacheService }): AdminShowService {
  return new AdminShowService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: AdminShowService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getAdminShowService(): AdminShowService {
  if (!instance) {
    instance = createAdminShowService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetAdminShowService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { adminShowService }` continues to work
 */
export const adminShowService = getAdminShowService();
