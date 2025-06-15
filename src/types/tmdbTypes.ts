export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompanies {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
}

export interface TMDBWatchProvider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

export interface TMDBCountryWatchProviders {
  link: string;
  flatrate?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
}

export interface TMDBWatchProviders {
  results: {
    [countryCode: string]: TMDBCountryWatchProviders;
  };
}

export interface TMDBReleaseDateInfo {
  certification: string;
  descriptors: string[];
  iso_639_1: string;
  note: string;
  release_date: Date;
  type: number;
}

export interface TMDBReleaseDates {
  results: {
    iso_3166_1: string;
    release_dates: TMDBReleaseDateInfo[];
  }[];
}

export interface TMDBContentRatings {
  results: { descriptors: string[]; iso_3166_1: string; rating: string }[];
}

export interface TMDBNetwork {
  id: string;
  logo_path: string;
  name: string;
  origin_country: string;
}

export interface TMDBCrewMember {
  id: number;
  department: string;
  job: string;
  name: string;
  credit_id: string;
  gender: number | null;
  profile_path: string | null;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  credit_id: string;
  gender: number | null;
  profile_path: string | null;
  cast_id: number;
}

export interface TMDBContent {
  id: number;
  'watch/providers': TMDBWatchProviders;
}

export interface TMDBMovie extends TMDBContent {
  adult: boolean;
  backdrop_path: string;
  budget: number;
  credits: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  genres: TMDBGenre[];
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: TMDBProductionCompanies[];
  release_date: string;
  release_dates: TMDBReleaseDates;
  revenue: number;
  runtime: number;
  title: string;
  vote_average: number;
  vote_count: number;
}

export interface TMDBShow extends TMDBContent {
  backdrop_path: string;
  first_air_date: string;
  genres: TMDBGenre[];
  in_production: boolean;
  last_air_date: string;
  last_episode_to_air: TMDBEpisodeToAir | null;
  name: string;
  next_episode_to_air: TMDBEpisodeToAir | null;
  networks: TMDBNetwork[];
  number_of_episodes: number;
  number_of_seasons: number;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: TMDBProductionCompanies[];
  seasons: TMDBShowSeason[];
  status: string;
  type: string;
  vote_average: number;
  content_ratings: TMDBContentRatings;
}

export interface TMDBShowSeason {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
  vote_average: number;
}

export interface TMDBEpisodeToAir {
  air_date: string;
  episode_number: number;
  id: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBSeasonDetails {
  air_date: string;
  episodes: TMDBEpisode[];
  id: number;
}

export interface TMDBEpisode {
  air_date: string;
  episode_number: number;
  episode_type: string;
  id: number;
  name: string;
  overview: string;
  runtime: number;
  season_number: number;
  show_id: number;
  still_path: string;
}

export interface TMDBTrendingBaseResult {
  id: number;
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  poster_path: string;
  genre_ids: number[];
  original_language: string;
  media_type: 'movie' | 'tv';
}

export interface TMDBTrendingMovieResult extends TMDBTrendingBaseResult {
  title: string;
  original_title: string;
  release_date: string;
  adult: boolean;
  video: boolean;
}

export interface TMDBTrendingShowResult extends TMDBTrendingBaseResult {
  name: string;
  original_name: string;
  first_air_date: string;
  origin_country: string[];
}

export type TMDBTrendingResult = TMDBTrendingMovieResult | TMDBTrendingShowResult;

export interface TMDBSearchTVParams {
  query: string;
  page?: number;
  include_adult?: boolean;
  language?: string;
  first_air_date_year?: string;
}

export interface TMDBSearchShowResult {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  name: string;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
}

export interface TMDBSearchMovieParams {
  query: string;
  page?: number;
  include_adult?: boolean;
  region?: string;
  language?: string;
  primary_release_year?: string;
}

export interface TMDBSearchMovieResult {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface TMDBRelatedShow {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  name: string;
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  origin_country: string[];
}

export interface TMDBRelatedMovie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBChangeItemValue {
  season_id: number;
  season_number: number;
}

export interface TMDBChangeItem {
  id?: string;
  action: 'added' | 'created' | 'updated' | 'deleted';
  time: string;
  iso_639_1: string;
  iso_3166_1: string;
  value?: TMDBChangeItemValue | string;
  original_value?: string;
}

export interface TMDBChange {
  key: string;
  items: TMDBChangeItem[];
}

export interface TMDBChangesResponse {
  changes: TMDBChange[];
}
