import { ContentReference } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ContentUpdatesRow extends RowDataPacket {
  id: number;
  title: string;
  tmdb_id: number;
  created_at: string;
  updated_at: string;
}

export function transformContentUpdates(update: ContentUpdatesRow): ContentUpdates {
  return {
    id: update.id,
    title: update.title,
    tmdb_id: update.tmdb_id,
    created_at: update.created_at,
    updated_at: update.updated_at,
  };
}

export interface ContentCountRow extends RowDataPacket {
  total: number;
}

export interface ContentUpdates {
  id: number;
  title: string;
  tmdb_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Show-specific content updates that includes season count
 */
export interface ShowContentUpdates extends ContentUpdates {
  season_count: number;
}

/**
 * Database row structure for show content updates
 */
export interface ShowContentUpdatesRow extends RowDataPacket {
  id: number;
  title: string;
  tmdb_id: number;
  season_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Transforms a ShowContentUpdatesRow from the database to ShowContentUpdates
 */
export function transformShowContentUpdates(update: ShowContentUpdatesRow): ShowContentUpdates {
  return {
    id: update.id,
    title: update.title,
    tmdb_id: update.tmdb_id,
    season_count: update.season_count,
    created_at: update.created_at,
    updated_at: update.updated_at,
  };
}

export interface StreamingServiceReferenceRow extends RowDataPacket {
  id: number;
}

export interface ContentReferenceRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  title: string;
  release_date: string;
}

export function transformContentReferenceRow(content: ContentReferenceRow): ContentReference {
  return {
    id: content.id,
    tmdbId: content.tmdb_id,
    title: content.title,
    releaseDate: content.release_date,
  };
}
