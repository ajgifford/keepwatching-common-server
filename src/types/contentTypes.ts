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
