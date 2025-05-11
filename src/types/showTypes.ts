import { RowDataPacket } from 'mysql2';

export interface Show {
  id?: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  poster_image: string;
  backdrop_image: string;
  user_rating: number;
  content_rating: string;
  streaming_services?: number[];
  season_count?: number;
  episode_count?: number;
  genreIds?: number[];
  status?: string;
  type?: string;
  in_production?: 0 | 1;
  last_air_date?: string | null;
  last_episode_to_air?: number | null;
  next_episode_to_air?: number | null;
  network?: string | null;
}

export interface ProfileEpisode {
  profile_id: number;
  episode_id: number;
  tmdb_id: number;
  season_id: number;
  show_id: number;
  episode_number: number;
  episode_type: string;
  season_number: number;
  title: string;
  overview: string;
  runtime: number;
  air_date: string;
  still_image: string;
  watch_status: 'WATCHED' | 'NOT_WATCHED' | 'WATCHING';
}

export interface ProfileSeason {
  profile_id: number;
  season_id: number;
  show_id: number;
  tmdb_id: number;
  name: string;
  overview: string;
  season_number: number;
  release_date: string;
  poster_image: string;
  number_of_episodes: number;
  watch_status: 'WATCHED' | 'NOT_WATCHED' | 'WATCHING' | 'UP_TO_DATE';
  episodes: ProfileEpisode[];
}

export interface ProfileShow {
  profile_id: number;
  show_id: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  poster_image: string;
  backdrop_image: string;
  user_rating: number;
  content_rating: string;
  season_count: number;
  episode_count: number;
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED' | 'UP_TO_DATE';
  status: string;
  type: string;
  in_production: 0 | 1;
  genres: string;
  streaming_services: string;
  network: string | null;
  last_episode?: {
    title: string;
    air_date: string;
    episode_number: number;
    season_number: number;
  } | null;
  next_episode?: {
    title: string;
    air_date: string;
    episode_number: number;
    season_number: number;
  } | null;
}

export interface ProfileShowWithSeasons extends ProfileShow {
  seasons?: ProfileSeason[];
}

export interface NextEpisode {
  episode_id: number;
  episode_title: string;
  overview: string;
  episode_number: number;
  season_number: number;
  episode_still_image: string;
  air_date: string;
  show_id: number;
  show_name: string;
  season_id: number;
  poster_image: string;
  network: string;
  streaming_services: string;
  profile_id: number;
}

export interface ContinueWatchingShow {
  show_id: number;
  show_title: string;
  poster_image: string;
  last_watched: string;
  episodes: NextEpisode[];
}

export interface AdminShow {
  id: number;
  tmdbId: number;
  title: string;
  description: string;
  releaseDate: string;
  posterImage: string;
  backdropImage: string;
  network: string;
  seasonCount: number;
  episodeCount: number;
  userRating: number;
  contentRating: string;
  streamingServices: string;
  genres: string;
  status: string;
  type: string;
  inProduction: boolean;
  lastAirDate: string;
  lastUpdated: string;
}

export interface AdminShowRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  poster_image: string;
  backdrop_image: string;
  network: string;
  season_count: number;
  episode_count: number;
  user_rating: number;
  content_rating: string;
  status: string;
  type: string;
  in_production: number;
  last_air_date: string;
  created_at: Date;
  updated_at: Date;
  genres: string;
  streaming_services: string;
}
