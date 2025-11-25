import { StreamingServiceReferenceRow } from '../types/contentTypes';
import { TMDBContent, TMDBMovie, TMDBShow } from '../types/tmdbTypes';
import pool from './db';

let cachedStreamingServiceIds: number[] = [];
let cacheInitialized = false;
let cacheLoadPromise: Promise<void> | null = null;

export const getCachedStreamingServiceIds = (): number[] => cachedStreamingServiceIds;
export const setCachedStreamingServiceIds = (data: number[]): void => {
  console.log('SETTING CACHED SERVICE IDS');
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
  console.log('CACHED STREAMING ID', cachedStreamingServiceIds);
  console.log('US WATCH PROVIDER', usWatchProvider);
  if (usWatchProvider && usWatchProvider.flatrate && usWatchProvider.flatrate.length > 0) {
    console.log('HAS VALID US WATCH PROVIDERS');
    const streaming_service_ids: number[] = [];
    usWatchProvider.flatrate.forEach((item) => {
      console.log('US WATCH PROVIDER > FLATRATE', item);
      const id = item.provider_id;
      if (cachedStreamingServiceIds.includes(id)) {
        console.log('US WATCH PROVIDER ID IN CACHE');
        streaming_service_ids.push(item.provider_id);
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
  console.log('LOADING STREAMING SERVICES', rows);
  setCachedStreamingServiceIds(rows.map((item) => item.id));
  console.log('CACHED STREAMING SERVICE IDS', cachedStreamingServiceIds);
}
