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
