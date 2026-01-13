import { StreamingServiceReferenceRow } from '../types/contentTypes';
import { TMDBContent, TMDBMovie, TMDBShow } from '../types/tmdbTypes';
import pool from './db';

let cachedStreamingServiceIds: number[] = [];
let cacheInitialized = false;
let cacheLoadPromise: Promise<void> | null = null;

// Maps TMDB provider IDs to canonical streaming service IDs in our database
// This handles cases where TMDB splits a single service into multiple provider variants
const PROVIDER_ID_MAPPING: Record<number, number> = {
  // Paramount+ variants -> Paramount+ (531)
  582: 531, // Paramount+ Amazon Channel
  633: 531, // Paramount+ Roku Premium Channel
  1770: 531, // Paramount+ with Showtime
  1853: 531, // Paramount Plus Apple TV Channel
  2303: 531, // Paramount Plus Premium
  2474: 531, // Paramount+ Originals Amazon Channel
  2475: 531, // Paramount+ MTV Amazon Channel
  2616: 531, // Paramount Plus Essential
  // Netflix
  175: 8, // Netflix Kids
  1796: 8, // Netflix Standard with Ads
  // Apple TV
  350: 2, // Apple TV
  // HBO Max
  1825: 1899, // HBO Max Amazon Channel
  2472: 1899, // HBO Max Amazon Channel
  // Peacock
  387: 386, // Peacock Premium Plus
};

export const getCachedStreamingServiceIds = (): number[] => cachedStreamingServiceIds;
export const setCachedStreamingServiceIds = (data: number[]): void => {
  cachedStreamingServiceIds = data;
  cacheInitialized = true;
};

async function ensureCacheLoaded(): Promise<void> {
  if (cacheInitialized) {
    return;
  }

  // If already loading, wait for that promise
  if (cacheLoadPromise) {
    return cacheLoadPromise;
  }

  // Start loading
  cacheLoadPromise = loadStreamingService();
  await cacheLoadPromise;
  cacheLoadPromise = null;
}

const COMING_SOON = 9996;
const UNAVAILABLE = 9997;
const THEATER = 9998;
const UNKNOWN = 9999;

async function getUSWatchProviders(content: TMDBContent): Promise<number[]> {
  await ensureCacheLoaded();

  const watchProviders = content['watch/providers']?.results;
  const usWatchProvider = watchProviders.US;
  if (usWatchProvider && usWatchProvider.flatrate && usWatchProvider.flatrate.length > 0) {
    const streaming_service_ids: number[] = [];
    usWatchProvider.flatrate.forEach((item) => {
      const tmdbProviderId = item.provider_id;
      // Map TMDB provider ID to canonical database ID (handles provider variants)
      const canonicalId = PROVIDER_ID_MAPPING[tmdbProviderId] ?? tmdbProviderId;

      if (cachedStreamingServiceIds.includes(canonicalId)) {
        // Only add if not already in the list (prevents duplicates from multiple variants)
        if (!streaming_service_ids.includes(canonicalId)) {
          streaming_service_ids.push(canonicalId);
        }
      }
    });
    if (streaming_service_ids.length > 0) {
      return streaming_service_ids;
    }
  }
  return [];
}

export async function getUSWatchProvidersMovie(movie: TMDBMovie): Promise<number[]> {
  const services = await getUSWatchProviders(movie);
  if (services.length > 0) {
    return services;
  }
  const now = new Date();
  const release = new Date(movie.release_date);
  const daysSinceRelease = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);

  if (release > now) {
    return [COMING_SOON];
  }
  if (daysSinceRelease <= 90) {
    return [THEATER];
  }
  return [UNAVAILABLE];
}

export async function getUSWatchProvidersShow(show: TMDBShow): Promise<number[]> {
  const services = await getUSWatchProviders(show);
  if (services.length > 0) {
    return services;
  }
  return [UNKNOWN];
}

export async function loadStreamingService() {
  const query = `SELECT id FROM streaming_services`;
  const [rows] = await pool.execute<StreamingServiceReferenceRow[]>(query);
  setCachedStreamingServiceIds(rows.map((item) => item.id));
}
