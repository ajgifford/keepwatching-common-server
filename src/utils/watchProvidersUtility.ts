import { StreamingServiceReferenceRow } from '../types/contentTypes';
import { TMDBContent } from '../types/tmdbTypes';
import pool from './db';

let cachedStreamingServiceIds: number[] = [];
export const getCachedStreamingServiceIds = (): number[] => cachedStreamingServiceIds;
export const setCachedStreamingServiceIds = (data: number[]): void => {
  cachedStreamingServiceIds = data;
};

export function getUSWatchProviders(content: TMDBContent, defaultProvider: number): number[] {
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
    return [defaultProvider];
  }
  return [defaultProvider];
}

export async function loadStreamingService() {
  const query = `SELECT id FROM streaming_services`;
  const [rows] = await pool.execute<StreamingServiceReferenceRow[]>(query);
  setCachedStreamingServiceIds(rows.map((item) => item.id));
}
