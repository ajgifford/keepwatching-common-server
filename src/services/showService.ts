import { PROFILE_KEYS, SHOW_KEYS } from '../constants/cacheKeys';
import * as episodesDb from '../db/episodesDb';
import * as seasonsDb from '../db/seasonsDb';
import * as showsDb from '../db/showsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { ContentUpdates } from '../types/contentTypes';
import { TMDBGenre, TMDBPaginatedResponse, TMDBRelatedShow, TMDBShow, TMDBShowSeason } from '../types/tmdbTypes';
import {
  GLOBAL_KEYS,
  LANGUAGE_SPECIFIC_KEYS,
  SUPPORTED_CHANGE_KEYS,
  SUPPORTED_LANGUAGE,
} from '../utils/changesUtility';
import { getEpisodeToAirId, getInProduction, getUSNetwork, getUSRating } from '../utils/contentUtility';
import { generateGenreArrayFromIds } from '../utils/genreUtility';
import { filterUSOrEnglishShows } from '../utils/usSearchFilter';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { profileService } from './profileService';
import { processSeasonChanges } from './seasonChangesService';
import { socketService } from './socketService';
import { getTMDBService } from './tmdbService';
import { watchStatusService } from './watchStatusService';
import {
  AddShowFavorite,
  ContentReference,
  CreateShowRequest,
  EpisodesForProfile,
  KeepWatchingShow,
  ProfileAccountMapping,
  ProfileSeason,
  ProfileShow,
  ProfileShowWithSeasons,
  ProfileWatchProgressResponse,
  RemoveShowFavorite,
  ShowReference,
  ShowStatisticsResponse,
  SimilarOrRecommendedShow,
  UpdateShowRequest,
  UserWatchStatus,
  WatchStatus,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for handling show-related business logic
 * This separates the business logic from the controller layer
 */
export class ShowService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Invalidate all caches related to a profile
   */
  public invalidateProfileCache(accountId: number, profileId: number): void {
    this.cache.invalidateProfileShows(accountId, profileId);
  }

  /**
   * Invalidate all caches related to an account by running through it's profiles
   */
  public async invalidateAccountCache(accountId: number): Promise<void> {
    const profiles = await profileService.getProfilesByAccountId(accountId);
    for (const profile of profiles) {
      this.invalidateProfileCache(accountId, profile.id);
    }

    this.cache.invalidateAccount(accountId);
  }

  /**
   * Invalidate the cache related to all shows
   */
  public invalidateAllShowsCache(): void {
    this.cache.invalidatePattern('allShows_');
  }

  /**
   * Gets a list of shows that may need metadata updates
   *
   * @returns Array of shows needing updates
   */
  public async getShowsForUpdates(): Promise<ContentUpdates[]> {
    try {
      return await showsDb.getShowsForUpdates();
    } catch (error) {
      throw errorService.handleError(error, `getShowsForUpdates()`);
    }
  }

  /**
   * Retrieves all shows for a specific profile with caching
   *
   * @param profileId - ID of the profile to get shows for
   * @returns Shows associated with the profile
   */
  public async getShowsForProfile(profileId: number): Promise<ProfileShow[]> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.shows(profileId),
        () => showsDb.getAllShowsForProfile(profileId),
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowsForProfile(${profileId})`);
    }
  }

  /**
   * Retrieves a show and all its details for a specific profile
   *
   * @param accountId - ID of the account to get the show for
   * @param profileId - ID of the profile to get the show for
   * @param showId - ID of the show to retrieve
   * @returns Detailed show information
   * @throws {NotFoundError} If the show isn't found
   */
  public async getShowDetailsForProfile(
    accountId: number,
    profileId: number,
    showId: number,
  ): Promise<ProfileShowWithSeasons> {
    try {
      watchStatusService.checkAndUpdateShowStatus(accountId, profileId, showId);
      const show = await this.cache.getOrSet(
        SHOW_KEYS.detailsForProfile(profileId, showId),
        () => showsDb.getShowWithSeasonsForProfile(profileId, showId),
        600,
      );

      errorService.assertExists(show, 'Show', showId);
      return show;
    } catch (error) {
      throw errorService.handleError(error, `getShowDetailsForProfile(${accountId}, ${profileId}, ${showId})`);
    }
  }

  /**
   * Retrieves recent, upcoming, and next unwatched episodes for a profile with caching
   *
   * @param profileId - ID of the profile to get episodes for
   * @returns Object containing recent, upcoming, and next unwatched episodes
   */
  public async getEpisodesForProfile(profileId: number): Promise<EpisodesForProfile> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.episodes(profileId),
        async () => {
          const [recentEpisodes, upcomingEpisodes, nextUnwatchedEpisodes] = await Promise.all([
            episodesDb.getRecentEpisodesForProfile(profileId),
            episodesDb.getUpcomingEpisodesForProfile(profileId),
            showsDb.getNextUnwatchedEpisodesForProfile(profileId),
          ]);

          return {
            recentEpisodes,
            upcomingEpisodes,
            nextUnwatchedEpisodes,
          };
        },
        300,
      );
    } catch (error) {
      throw errorService.handleError(error, `getEpisodesForProfile(${profileId})`);
    }
  }

  /**
   * Gets the next unwatched episodes for shows a profile has recently watched
   *
   * @param profileId - ID of the profile to get next unwatched episodes for
   * @returns Array of shows with their next unwatched episodes, ordered by most recently watched
   */
  public async getNextUnwatchedEpisodesForProfile(profileId: number): Promise<KeepWatchingShow[]> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.nextUnwatchedEpisodes(profileId),
        async () => {
          return await showsDb.getNextUnwatchedEpisodesForProfile(profileId);
        },
        300,
      );
    } catch (error) {
      throw errorService.handleError(error, `getNextUnwatchedEpisodesForProfile(${profileId})`);
    }
  }

  /**
   * Adds a show to a profile's favorites
   *
   * @param accountId - ID of the account to add the show for
   * @param profileId - ID of the profile to add the show for
   * @param showTMDBId - TMDB ID of the show to add
   * @returns Object containing the favorited show and updated episode lists
   */
  public async addShowToFavorites(accountId: number, profileId: number, showTMDBId: number): Promise<AddShowFavorite> {
    try {
      const existingShowToFavorite = await showsDb.findShowByTMDBId(showTMDBId);
      if (existingShowToFavorite) {
        return await this.favoriteExistingShow(existingShowToFavorite, accountId, profileId);
      }

      return await this.favoriteNewShow(showTMDBId, accountId, profileId);
    } catch (error) {
      throw errorService.handleError(error, `addShowToFavorites(${accountId}, ${profileId}, ${showTMDBId})`);
    }
  }

  /**
   * Adds an existing show to a profile's favorites
   *
   * @param showToFavorite - Show reference to add to favorites
   * @param accountId - ID of the account to add the show for
   * @param profileId - ID of the profile to add the show for
   * @returns Object containing the favorited show and updated episode lists
   */
  private async favoriteExistingShow(
    showToFavorite: ShowReference,
    accountId: number,
    profileId: number,
  ): Promise<AddShowFavorite> {
    const now = new Date();
    await showsDb.saveFavorite(
      profileId,
      showToFavorite.id,
      true,
      new Date(showToFavorite.releaseDate) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
    );

    this.invalidateProfileCache(accountId, profileId);

    const show = await showsDb.getShowForProfile(profileId, showToFavorite.id);
    const episodeData = await this.getEpisodesForProfile(profileId);

    return {
      favoritedShow: show,
      episodes: episodeData,
    };
  }

  /**
   * Adds a new show (not yet in the database) to a profile's favorites
   * Fetches show data from TMDB API, saves it to the database, and adds to favorites
   *
   * @param showId - TMDB ID of the show to add
   * @param accountId - ID of the account to add the show for
   * @param profileId - ID of the profile to add the show for
   * @returns Object containing the favorited show
   */
  private async favoriteNewShow(showId: number, accountId: number, profileId: number): Promise<AddShowFavorite> {
    const tmdbService = getTMDBService();
    const responseShow = await tmdbService.getShowDetails(showId);
    const now = new Date();

    const newShowToFavorite: CreateShowRequest = {
      tmdb_id: responseShow.id,
      title: responseShow.name,
      description: responseShow.overview,
      release_date: responseShow.first_air_date,
      poster_image: responseShow.poster_path,
      backdrop_image: responseShow.backdrop_path,
      user_rating: responseShow.vote_average,
      content_rating: getUSRating(responseShow.content_ratings),
      season_count: responseShow.number_of_seasons,
      episode_count: responseShow.number_of_episodes,
      streaming_service_ids: getUSWatchProviders(responseShow, 9999),
      genre_ids: responseShow.genres.map((genre: TMDBGenre) => genre.id),
      status: responseShow.status,
      type: responseShow.type,
      in_production: getInProduction(responseShow),
      last_air_date: responseShow.last_air_date,
      last_episode_to_air: getEpisodeToAirId(responseShow.last_episode_to_air),
      next_episode_to_air: getEpisodeToAirId(responseShow.next_episode_to_air),
      network: getUSNetwork(responseShow.networks),
    };

    const savedShowId = await showsDb.saveShow(newShowToFavorite);
    await showsDb.saveFavorite(
      profileId,
      savedShowId,
      false,
      new Date(responseShow.first_air_date) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
    );
    this.invalidateProfileCache(accountId, profileId);

    // Start background process to fetch seasons and episodes
    const show = await showsDb.getShowForProfile(profileId, savedShowId);
    this.fetchSeasonsAndEpisodes(responseShow, savedShowId, profileId);

    return { favoritedShow: show };
  }

  /**
   * Loads all seasons and episodes for a show from the TMDB API
   * This is a potentially long-running operation that runs in the background
   *
   * @param show - Show data from TMDB API
   * @param showId - ID of the show in the database
   * @param profileId - ID of the profile to add the show for
   */
  private async fetchSeasonsAndEpisodes(show: TMDBShow, showId: number, profileId: number): Promise<void> {
    try {
      const tmdbService = getTMDBService();
      const validSeasons = show.seasons.filter((season: TMDBShowSeason) => {
        return season.season_number > 0;
      });

      const now = new Date();

      for (const responseSeason of validSeasons) {
        const responseData = await tmdbService.getSeasonDetails(show.id, responseSeason.season_number);

        const seasonId = await seasonsDb.saveSeason({
          show_id: showId,
          tmdb_id: responseSeason.id,
          name: responseSeason.name,
          overview: responseSeason.overview,
          season_number: responseSeason.season_number,
          release_date: responseSeason.air_date,
          poster_image: responseSeason.poster_path,
          number_of_episodes: responseSeason.episode_count,
        });
        await seasonsDb.saveFavorite(
          Number(profileId),
          seasonId,
          new Date(responseSeason.air_date) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
        );

        for (const responseEpisode of responseData.episodes) {
          const episodeId = await episodesDb.saveEpisode({
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
          await episodesDb.saveFavorite(
            Number(profileId),
            episodeId,
            new Date(responseEpisode.air_date) > now ? WatchStatus.UNAIRED : WatchStatus.NOT_WATCHED,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const loadedShow = await showsDb.getShowForProfile(profileId, showId);
      await socketService.notifyShowDataLoaded(profileId, loadedShow);
    } catch (error) {
      cliLogger.error('Error fetching seasons and episodes:', error);
    }
  }

  /**
   * Removes a show from a profile's favorites
   *
   * @param accountId - ID of the account to remove the show from
   * @param profileId - ID of the profile to remove the show from
   * @param showId - ID of the show to remove
   * @returns Object containing information about the removed show and updated episode lists
   */
  public async removeShowFromFavorites(
    accountId: number,
    profileId: number,
    showId: number,
  ): Promise<RemoveShowFavorite> {
    try {
      const showToRemove = await showsDb.findShowById(showId);
      errorService.assertExists(showToRemove, 'Show', showId);

      await showsDb.removeFavorite(profileId, showId);

      this.invalidateProfileCache(accountId, profileId);

      const episodeData = await this.getEpisodesForProfile(profileId);

      return {
        removedShow: showToRemove,
        episodes: episodeData,
      };
    } catch (error) {
      throw errorService.handleError(error, `removeShowFromFavorites(${accountId}, ${profileId}, ${showId})`);
    }
  }

  /**
   * Updates the watch status of a show
   *
   * @param accountId - ID of the account to update the watch status for
   * @param profileId - ID of the profile to update the watch status for
   * @param showId - ID of the show to update
   * @param status - New watch status ('WATCHED' or 'NOT_WATCHED')
   * @returns Success state of the update operation
   */
  public async updateShowWatchStatus(
    accountId: number,
    profileId: number,
    showId: number,
    status: UserWatchStatus,
  ): Promise<KeepWatchingShow[]> {
    try {
      const result = await watchStatusService.updateShowWatchStatus(accountId, profileId, showId, status);

      appLogger.info(`Show ${showId} update: ${result.message}`);
      appLogger.info(`Affected entities: ${result.changes.length}`);

      this.cache.invalidate(SHOW_KEYS.detailsForProfile(profileId, showId));

      return this.getNextUnwatchedEpisodesForProfile(profileId);
    } catch (error) {
      throw errorService.handleError(error, `updateShowWatchStatus(${accountId}, ${profileId}, ${showId}, ${status})`);
    }
  }

  /**
   * Check and update watch status for a show when content could have been added or changed
   *
   * @param showId ID of the show in the database
   * @param profileAccountMappings Mapping of profile IDs and their account IDs that have this show in their favorites
   */
  public async checkAndUpdateShowStatus(
    showId: number,
    profileAccountMappings: ProfileAccountMapping[],
  ): Promise<void> {
    try {
      for (const mapping of profileAccountMappings) {
        watchStatusService.checkAndUpdateShowStatus(mapping.accountId, mapping.profileId, showId);
      }
    } catch (error) {
      throw errorService.handleError(error, `updateShowWatchStatusForNewContent(${showId}, profileAccountMappings...)`);
    }
  }

  /**
   * Gets recommendations for similar shows based on a given show
   *
   * @param profileId - ID of the profile requesting recommendations
   * @param showId - ID of the show to get recommendations for
   * @returns Array of recommended shows
   */
  public async getShowRecommendations(profileId: number, showId: number): Promise<SimilarOrRecommendedShow[]> {
    try {
      const showTMDBReference = await showsDb.findShowById(showId);
      errorService.assertExists(showTMDBReference, 'ShowTMDBReference', showId);

      return await this.cache.getOrSet(
        SHOW_KEYS.recommendations(showId),
        async () => {
          const tmdbService = getTMDBService();
          const response = await tmdbService.getShowRecommendations(showTMDBReference.tmdbId);
          return await this.populateSimilarOrRecommendedResult(response, profileId);
        },
        86400, // 24 hours TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowRecommendations(${profileId}, ${showId})`);
    }
  }

  /**
   * Gets similar shows based on a given show
   *
   * @param profileId - ID of the profile requesting similar shows
   * @param showId - ID of the show to get recommendations for
   * @returns Array of recommended shows
   */
  public async getSimilarShows(profileId: number, showId: number): Promise<SimilarOrRecommendedShow[]> {
    try {
      const show = await showsDb.findShowById(showId);
      errorService.assertExists(show, 'Show', showId);

      return await this.cache.getOrSet(
        SHOW_KEYS.similar(showId),
        async () => {
          const tmdbService = getTMDBService();
          const response = await tmdbService.getSimilarShows(show.tmdbId);
          return await this.populateSimilarOrRecommendedResult(response, profileId);
        },
        86400, // 24 hours TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getSimilarShows(${profileId}, ${showId})`);
    }
  }

  private async populateSimilarOrRecommendedResult(
    response: TMDBPaginatedResponse<TMDBRelatedShow>,
    profileId: number,
  ): Promise<SimilarOrRecommendedShow[]> {
    const responseShows = filterUSOrEnglishShows(response.results);
    const userShows = await showsDb.getAllShowsForProfile(profileId);
    const userShowIds = new Set(userShows.map((s) => s.tmdbId));
    return responseShows.map((rec: TMDBRelatedShow) => ({
      id: rec.id,
      title: rec.name,
      genres: generateGenreArrayFromIds(rec.genre_ids),
      premiered: rec.first_air_date,
      summary: rec.overview,
      image: rec.poster_path,
      rating: rec.vote_average,
      popularity: rec.popularity,
      country: 'US',
      language: rec.original_language,
      inFavorites: userShowIds.has(rec.id),
    }));
  }

  /**
   * Get trending shows for discovery emails
   */
  public async getTrendingShows(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await showsDb.getTrendingShows(limit);
    } catch (error) {
      throw errorService.handleError(error, `getTrendingShows(${limit})`);
    }
  }

  /**
   * Get newly added shows
   */
  public async getNewlyAddedShows(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await showsDb.getNewlyAddedShows(limit);
    } catch (error) {
      throw errorService.handleError(error, `getNewlyAddedShows(${limit})`);
    }
  }

  /**
   * Get top rated shows
   */
  public async getTopRatedShows(limit: number = 10): Promise<ContentReference[]> {
    try {
      return await showsDb.getTopRatedShows(limit);
    } catch (error) {
      throw errorService.handleError(error, `getTopRatedShows(${limit})`);
    }
  }

  /**
   * Check for changes to a specific show and updates if necessary
   * @param content Show to check for changes
   * @param pastDate Date past date used as the start of the change window
   * @param currentDate Date current date used as the end of the change window
   */
  public async checkShowForChanges(content: ContentUpdates, pastDate: string, currentDate: string) {
    const tmdbService = getTMDBService();

    try {
      const changesData = await tmdbService.getShowChanges(content.tmdb_id, pastDate, currentDate);
      const changes = changesData.changes || [];
      const hasRelevantChange = changes.some((change) => {
        if (!SUPPORTED_CHANGE_KEYS.includes(change.key)) return false;

        if (LANGUAGE_SPECIFIC_KEYS.has(change.key)) {
          return change.items.some((item) =>
            Array.isArray(item.value)
              ? item.value.some((val) => val.iso_639_1 === SUPPORTED_LANGUAGE)
              : item.iso_639_1 === SUPPORTED_LANGUAGE,
          );
        }

        return GLOBAL_KEYS.has(change.key);
      });
      const seasonChange = changes.find((item) => item.key === 'season');

      if (hasRelevantChange || seasonChange) {
        const showDetails = await tmdbService.getShowDetails(content.tmdb_id);

        const updatedShow: UpdateShowRequest = {
          id: content.id,
          tmdb_id: showDetails.id,
          title: showDetails.name,
          description: showDetails.overview,
          release_date: showDetails.first_air_date,
          poster_image: showDetails.poster_path,
          backdrop_image: showDetails.backdrop_path,
          user_rating: showDetails.vote_average,
          content_rating: getUSRating(showDetails.content_ratings),
          streaming_service_ids: getUSWatchProviders(showDetails, 9999),
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

        await showsDb.updateShow(updatedShow);

        const profilesForShow = await showsDb.getProfilesForShow(updatedShow.id);

        if (seasonChange) {
          await processSeasonChanges(
            seasonChange,
            showDetails,
            content,
            profilesForShow.profileAccountMappings,
            pastDate,
            currentDate,
          );
          await this.checkAndUpdateShowStatus(updatedShow.id, profilesForShow.profileAccountMappings);
        }
      }
    } catch (error) {
      appLogger.error(ErrorMessages.ShowChangeFail, { error, showId: content.id });
      throw errorService.handleError(error, `checkShowForChanges(${content.id})`);
    }
  }

  /**
   * Get statistics about a profile's shows
   *
   * @param profileId - ID of the profile to get statistics for
   * @returns Object containing various watch statistics
   */
  public async getProfileShowStatistics(profileId: number): Promise<ShowStatisticsResponse> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.showStatistics(profileId),
        async () => {
          const shows = await showsDb.getAllShowsForProfile(profileId);

          const total = shows.length;
          const unaired = shows.filter((s) => s.watchStatus === WatchStatus.UNAIRED).length;
          const watched = shows.filter((s) => s.watchStatus === WatchStatus.WATCHED).length;
          const watching = shows.filter((s) => s.watchStatus === WatchStatus.WATCHING).length;
          const notWatched = shows.filter((s) => s.watchStatus === WatchStatus.NOT_WATCHED).length;
          const upToDate = shows.filter((s) => s.watchStatus === WatchStatus.UP_TO_DATE).length;

          const genreCounts: Record<string, number> = {};
          shows.forEach((show) => {
            if (show.genres && typeof show.genres === 'string') {
              const genreArray = show.genres.split(',').map((genre) => genre.trim());
              genreArray.forEach((genre: string) => {
                if (genre) {
                  genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                }
              });
            }
          });

          const serviceCounts: Record<string, number> = {};
          shows.forEach((show) => {
            if (show.streamingServices && typeof show.streamingServices === 'string') {
              const serviceArray = show.streamingServices.split(',').map((service) => service.trim());
              serviceArray.forEach((service: string) => {
                if (service) {
                  serviceCounts[service] = (serviceCounts[service] || 0) + 1;
                }
              });
            }
          });

          return {
            total: total,
            watchStatusCounts: { unaired, watched, watching, notWatched, upToDate },
            genreDistribution: genreCounts,
            serviceDistribution: serviceCounts,
            watchProgress: total > 0 ? Math.round((watched / total) * 100) : 0,
          };
        },
        1800, // 30 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getShowStatistics(${profileId})`);
    }
  }

  /**
   * Get detailed watch progress for a profile including episode counts
   *
   * @param profileId - ID of the profile to get watch progress for
   * @returns Detailed watch progress statistics
   */
  public async getProfileWatchProgress(profileId: number): Promise<ProfileWatchProgressResponse> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.watchProgress(profileId),
        async () => {
          const shows = await showsDb.getAllShowsForProfile(profileId);

          let totalEpisodes = 0;
          let watchedEpisodes = 0;

          const showsProgress = await Promise.all(
            shows.map(async (show) => {
              const seasons = await seasonsDb.getSeasonsForShow(profileId, show.id);

              const showEpisodeCount = seasons.reduce((sum, season: ProfileSeason) => sum + season.episodes.length, 0);
              const showWatchedCount = seasons.reduce((sum, season: ProfileSeason) => {
                return sum + season.episodes.filter((ep) => ep.watchStatus === WatchStatus.WATCHED).length;
              }, 0);

              totalEpisodes += showEpisodeCount;
              watchedEpisodes += showWatchedCount;

              return {
                showId: show.id,
                title: show.title,
                status: show.watchStatus,
                totalEpisodes: showEpisodeCount,
                watchedEpisodes: showWatchedCount,
                percentComplete: showEpisodeCount > 0 ? Math.round((showWatchedCount / showEpisodeCount) * 100) : 0,
              };
            }),
          );

          return {
            totalEpisodes,
            watchedEpisodes,
            overallProgress: totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0,
            showsProgress: showsProgress,
          };
        },
        3600, // 1 hour TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getWatchProgress(${profileId})`);
    }
  }
}

export const showService = new ShowService();
