import {
  AdminMovie,
  MovieReference,
  ProfileMovie,
  ProfileMovieWithDetails,
  SimpleWatchStatus,
  SimpleWatchStatusType,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface MovieReferenceRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  title: string;
  release_date: string;
}

export function transformMovieReferenceRow(movie: MovieReferenceRow): MovieReference {
  return {
    id: movie.id,
    title: movie.title,
    tmdbId: movie.tmdb_id,
    releaseDate: movie.release_date,
  };
}

export interface ProfileMovieRow extends RowDataPacket {
  profile_id: number;
  movie_id: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  runtime: number;
  poster_image: string;
  backdrop_image: string;
  user_rating: number;
  mpa_rating: string;
  genres: string;
  streaming_services: string;
  watch_status: SimpleWatchStatusType;
}

export function transformProfileMovie(movie: ProfileMovieRow): ProfileMovie {
  return {
    profileId: movie.profile_id,
    id: movie.movie_id,
    tmdbId: movie.tmdb_id,
    title: movie.title,
    description: movie.description,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    posterImage: movie.poster_image,
    backdropImage: movie.backdrop_image,
    userRating: movie.user_rating,
    mpaRating: movie.mpa_rating,
    genres: movie.genres,
    streamingServices: movie.streaming_services,
    watchStatus: movie.watch_status as SimpleWatchStatus,
  };
}

export interface ProfileMovieDetailsRow extends ProfileMovieRow {
  budget: number;
  revenue: number;
  director: string;
  production_companies: string;
}

export function transformProfileMovieWithDetails(movie: ProfileMovieDetailsRow): ProfileMovieWithDetails {
  return {
    profileId: movie.profile_id,
    id: movie.movie_id,
    tmdbId: movie.tmdb_id,
    title: movie.title,
    description: movie.description,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    posterImage: movie.poster_image,
    backdropImage: movie.backdrop_image,
    userRating: movie.user_rating,
    mpaRating: movie.mpa_rating,
    genres: movie.genres,
    streamingServices: movie.streaming_services,
    watchStatus: movie.watch_status as SimpleWatchStatus,
    director: movie.director,
    productionCompanies: movie.production_companies,
    budget: movie.budget,
    revenue: movie.revenue,
  };
}

export interface AdminMovieRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  runtime: number;
  poster_image: string;
  backdrop_image: string;
  user_rating: number;
  mpa_rating: string;
  created_at: Date;
  updated_at: Date;
  genres: string;
  streaming_services: string;
}

export function transformAdminMovie(movie: AdminMovieRow): AdminMovie {
  return {
    id: movie.id,
    tmdbId: movie.tmdb_id,
    title: movie.title,
    description: movie.description,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    posterImage: movie.poster_image,
    backdropImage: movie.backdrop_image,
    userRating: movie.user_rating,
    mpaRating: movie.mpa_rating,
    streamingServices: movie.streaming_services,
    genres: movie.genres,
    lastUpdated: movie.updated_at.toISOString(),
  };
}
