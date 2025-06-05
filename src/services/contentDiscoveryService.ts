import { DISCOVER_KEYS, SEARCH_KEYS } from '../constants/cacheKeys';
import { DiscoverChangesQuery, DiscoverTopQuery, DiscoverTrendingQuery } from '../schema/discoverSchema';
import { getStreamingPremieredDate, getTMDBItemName, getTMDBPremieredDate, stripPrefix } from '../utils/contentUtility';
import { generateGenreArrayFromIds } from '../utils/genreUtility';
import { buildTMDBImagePath } from '../utils/imageUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { StreamingAvailabilityService } from './streamingAvailabilityService';
import { getTMDBService } from './tmdbService';
import { DiscoverAndSearchResponse, DiscoverAndSearchResult, MediaType } from '@ajgifford/keepwatching-types';

export class ContentDiscoveryService {
  private cache: CacheService;
  private streamingAvailability: StreamingAvailabilityService;

  /**
   * Creates a new ContentDiscoveryService instance
   */
  constructor() {
    this.cache = CacheService.getInstance();
    this.streamingAvailability = StreamingAvailabilityService.getInstance();
  }

  public async discoverTopContent(
    showType: DiscoverTopQuery['showType'],
    service: DiscoverTopQuery['service'],
  ): Promise<DiscoverAndSearchResponse> {
    try {
      const topContent = this.cache.getOrSet(DISCOVER_KEYS.top(showType, service), async () => {
        const data = await this.streamingAvailability.getClient().showsApi.getTopShows({
          country: 'us',
          service: service,
          showType: showType,
        });
        const contentItems: DiscoverAndSearchResult[] = data.map((result): DiscoverAndSearchResult => {
          return {
            id: stripPrefix(result.tmdbId),
            title: result.title,
            genres: result.genres.map((genre: { name: any }) => genre.name),
            premiered: getStreamingPremieredDate(showType, result),
            summary: result.overview,
            image: result.imageSet.verticalPoster.w240,
            rating: result.rating,
          };
        });

        const response: DiscoverAndSearchResponse = {
          message: `Found top ${showType} for ${service}`,
          results: contentItems,
          totalResults: contentItems.length,
          totalPages: 1,
          currentPage: 1,
        };
        return response;
      });
      return topContent;
    } catch (error) {
      throw errorService.handleError(error, `discoverTopContent(${showType}, ${service})`);
    }
  }

  public async discoverChangesContent(
    showType: DiscoverChangesQuery['showType'],
    service: DiscoverChangesQuery['service'],
    changeType: DiscoverChangesQuery['changeType'],
  ): Promise<DiscoverAndSearchResponse> {
    try {
      const changesContent = this.cache.getOrSet(DISCOVER_KEYS.changes(showType, service, changeType), async () => {
        const data = await this.streamingAvailability.getClient().changesApi.getChanges({
          changeType: changeType,
          itemType: 'show',
          country: 'us',
          catalogs: [service],
          showType: showType,
          orderDirection: 'asc',
          includeUnknownDates: false,
        });

        const showsData = data.shows || {};
        const showIds = Object.keys(showsData);
        const contentItems: DiscoverAndSearchResult[] = [];
        for (const id of showIds) {
          const show = showsData[id];
          if (!show || !show.title) continue;

          contentItems.push({
            id: stripPrefix(show.tmdbId),
            title: show.title,
            genres: (show.genres || []).map((genre: { name: string }) => genre.name),
            premiered: getStreamingPremieredDate(showType, show),
            summary: show.overview || '',
            image: show.imageSet?.verticalPoster?.w240 || '',
            rating: show.rating || 0,
          });
        }

        const response: DiscoverAndSearchResponse = {
          message: `Found ${changeType} ${showType} for ${service}`,
          results: contentItems,
          totalResults: contentItems.length,
          totalPages: 1,
          currentPage: 1,
        };
        return response;
      });
      return changesContent;
    } catch (error) {
      throw errorService.handleError(error, `discoverChangesContent(${showType}, ${service}, ${changeType})`);
    }
  }

  public async discoverTrendingContent(
    showType: DiscoverTrendingQuery['showType'],
    page: DiscoverTrendingQuery['page'],
  ): Promise<DiscoverAndSearchResponse> {
    try {
      const trendingContent = this.cache.getOrSet(DISCOVER_KEYS.trending(showType, page), async () => {
        const mediaType = showType === 'movie' ? 'movie' : 'tv';
        const tmdbService = getTMDBService();
        const tmdbResponse = await tmdbService.getTrending(mediaType, String(page));

        const apiResults: any[] = tmdbResponse.results;
        const usResults =
          showType === 'movie'
            ? apiResults.filter((movie) => movie.original_language === 'en')
            : apiResults.filter((show) => show.origin_country && show.origin_country.includes('US'));

        const contentItems: DiscoverAndSearchResult[] = usResults.map((result): DiscoverAndSearchResult => {
          return {
            id: result.id,
            title: getTMDBItemName(showType, result),
            genres: generateGenreArrayFromIds(result.genre_ids),
            premiered: getTMDBPremieredDate(showType, result),
            summary: result.overview,
            image: buildTMDBImagePath(result.poster_path),
            rating: result.vote_average,
            popularity: result.popularity,
          };
        });

        const response: DiscoverAndSearchResponse = {
          message: `Found trending ${showType}`,
          results: contentItems,
          totalResults: tmdbResponse.total_results,
          totalPages: tmdbResponse.total_pages,
          currentPage: page,
        };
        return response;
      });
      return trendingContent;
    } catch (error) {
      throw errorService.handleError(error, `discoverChangesContent(${showType}, ${page}`);
    }
  }

  public async searchMedia(
    mediaType: MediaType,
    searchString: string,
    year: string | undefined,
    page: number,
  ): Promise<DiscoverAndSearchResponse> {
    try {
      const searchResults = this.cache.getOrSet(SEARCH_KEYS.results(mediaType, searchString, year, page), async () => {
        const tmdbService = getTMDBService();
        const response =
          mediaType === MediaType.SHOW
            ? await tmdbService.searchShows(searchString, page, year)
            : await tmdbService.searchMovies(searchString, page, year);

        const results: any[] = response.results;
        const searchResult = results.map((result) => {
          return {
            id: result.id,
            title: getTMDBItemName(mediaType, result),
            genres: generateGenreArrayFromIds(result.genre_ids),
            premiered: getTMDBPremieredDate(mediaType, result),
            summary: result.overview,
            image: result.poster_path,
            rating: result.vote_average,
            popularity: result.popularity,
          } as DiscoverAndSearchResult;
        });

        const searchResponse: DiscoverAndSearchResponse = {
          message: `Search results for '${searchString}' of type: ${mediaType}`,
          results: searchResult,
          totalResults: response.total_results,
          totalPages: response.total_pages,
          currentPage: page,
        };
        return searchResponse;
      });
      return searchResults;
    } catch (error) {
      throw errorService.handleError(error, `searchMedia(${mediaType}, ${searchString}, ${year || 'no year'}, ${page}`);
    }
  }
}

export const contentDiscoveryService = new ContentDiscoveryService();
