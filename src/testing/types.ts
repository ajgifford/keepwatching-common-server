// Basic types needed for testing
// These are simplified versions that external projects can use

// Media Types
export enum MediaType {
  SHOW = 'tv',
  MOVIE = 'movie',
}

// Logger model types
export enum HTTPHeaders {
  ResponseTime = 'x-response-time',
  ForwardedFor = 'x-forwarded-for',
}

export enum HTTPMethods {
  HEAD = 'HEAD',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export enum SensitiveKeys {
  Password = 'password',
  NewPassword = 'new_password',
  OldPassword = 'old_password',
  RepeatPassword = 'repeat_password',
}

export enum LogIndentation {
  None = 0,
  SM = 2,
  MD = 4,
  LG = 6,
  XL = 8,
  XXL = 10,
  XXXL = 12,
}

export enum SuccessMessages {
  CreateSuccess = 'POST method executed successfully',
  GetSuccess = 'GET method executed successfully',
  UpdateSuccess = 'PUT/PATCH method executed successfully',
  DeleteSuccess = 'DELETE method executed successfully',
  GenericSuccess = 'Operation completed successfully',
}

export enum SpecialMessages {
  Redacted = '*****',
  DottedLine = '. . . . . . .',
}

export enum InfoMessages {
  DatabasesConnected = 'Databases connected successfully!',
}

export enum ErrorMessages {
  AppStartupFail = 'Unable to start the app',
  MoviesChangeFail = 'Unexpected error while updating movies',
  MovieChangeFail = 'Unexpected error while checking for movie changes',
  ShowsChangeFail = 'Unexpected error while updating shows',
  ShowChangeFail = 'Unexpected error while checking for show changes',
  SeasonChangeFail = 'Unexpected error while checking for season changes',
}

// Mock logger object
export const httpLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const cliLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Content Types
export interface WatchProviders {
  results: Record<string, any>;
}

export interface ContentDetails {
  'watch/providers': WatchProviders;
}

export interface ContentRating {
  descriptors: string[];
  iso_3166_1: string;
  rating: string;
}

export interface ContentRatings {
  results: ContentRating[];
}

export interface Network {
  id: string;
  logo_path: string;
  name: string;
  origin_country: string;
}

export interface ContentUpdates {
  id: number;
  title: string;
  tmdb_id: number;
  created_at: string;
  updated_at: string;
}

export interface Change {
  key: string;
  items: any[];
}

export interface Changes {
  changes: Change[];
}

// Simplified show/movie types for testing
export interface ProfileShow {
  profile_id: number;
  show_id: number;
  tmdb_id: number;
  title: string;
  description: string;
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED';
  [key: string]: any; // Allow other properties
}

export interface ProfileMovie {
  profile_id: number;
  movie_id: number;
  tmdb_id: number;
  title: string;
  description: string;
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED';
  [key: string]: any; // Allow other properties
}

export interface ProfileEpisode {
  profile_id: number;
  episode_id: number;
  tmdb_id: number;
  title: string;
  watch_status: 'WATCHED' | 'NOT_WATCHED' | 'WATCHING';
  [key: string]: any; // Allow other properties
}

// Basic account and profile types
export interface Account {
  id?: number;
  name: string;
  email: string;
  uid: string;
  image?: string;
  default_profile_id?: number;
}

export interface Profile {
  account_id: number;
  name: string;
  id?: number;
  image?: string;
}

// Discover and search types
export type ShowType = 'movie' | 'series';
export type StreamingService = 'netflix' | 'disney' | 'hbo' | 'apple' | 'prime';
export type ChangeType = 'new' | 'upcoming' | 'expiring';
