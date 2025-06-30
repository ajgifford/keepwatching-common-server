import { StreamingServiceReferenceRow } from '../types/contentTypes';
import { TMDBContent, TMDBMovie, TMDBShow } from '../types/tmdbTypes';
import pool from './db';

let cachedStreamingServiceIds: number[] = [];
export const getCachedStreamingServiceIds = (): number[] => cachedStreamingServiceIds;
export const setCachedStreamingServiceIds = (data: number[]): void => {
  cachedStreamingServiceIds = data;
};

const COMING_SOON = 9996;
const UNAVAILABLE = 9997;
const THEATER = 9998;
const UNKNOWN = 9999;

function getUSWatchProviders(content: TMDBContent): number[] {
  const watchProviders = content['watch/providers']?.results;
  const usWatchProvider = watchProviders.US;
  if (usWatchProvider && usWatchProvider.flatrate && usWatchProvider.flatrate.length > 0) {
    const streaming_service_ids: number[] = [];
    usWatchProvider.flatrate.forEach((item) => {
      const id = item.provider_id;
      if (cachedStreamingServiceIds.includes(id)) {
        streaming_service_ids.push(item.provider_id);
      }
    });
    if (streaming_service_ids.length > 0) {
      return streaming_service_ids;
    }
  }
  return [];
}

export function getUSWatchProvidersMovie(movie: TMDBMovie): number[] {
  const services = getUSWatchProviders(movie);
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

export function getUSWatchProvidersShow(show: TMDBShow): number[] {
  const services = getUSWatchProviders(show);
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
