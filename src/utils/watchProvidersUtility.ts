import pool from './db';

interface ProviderInfo {
  link: string;
  flatrate: {
    logo_path: string;
    provider_id: number;
    provider_name: string;
    display_priority: number;
  }[];
}

interface WatchProviders {
  results: Record<string, ProviderInfo>;
}

interface ContentDetails {
  'watch/providers': WatchProviders;
}

let cachedStreamingServiceIds: number[] = [];
export const getCachedStreamingServiceIds = (): number[] => cachedStreamingServiceIds;
export const setCachedStreamingServiceIds = (data: number[]): void => {
  cachedStreamingServiceIds = data;
};

export function getUSWatchProviders(content: ContentDetails, defaultProvider: number): number[] {
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
  const [rows] = await pool.execute(query);
  const streamingServiceIds = rows as any[];
  setCachedStreamingServiceIds(streamingServiceIds.map((item) => item.id));
}
