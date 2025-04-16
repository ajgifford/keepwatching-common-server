export interface DiscoverAndSearchResult {
  id: string;
  title: string;
  genres: string[];
  premiered: string;
  summary: string;
  image: string;
  rating: number;
  popularity?: number;
}

export interface DiscoverAndSearchResponse {
  message: string;
  results: DiscoverAndSearchResult[];
  total_results?: number;
  total_pages?: number;
  current_page?: number | string;
}

export type ShowType = 'movie' | 'series';

export type StreamingService = 'netflix' | 'disney' | 'hbo' | 'apple' | 'prime';

export type ChangeType = 'new' | 'upcoming' | 'expiring';

export interface DiscoverTopQuery {
  showType: ShowType;
  service: StreamingService;
}

export interface DiscoverChangesQuery {
  showType: ShowType;
  service: StreamingService;
  changeType: ChangeType;
}

export interface DiscoverTrendingQuery {
  showType: ShowType;
  page: string;
}
