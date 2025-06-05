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

export interface ChangeItem {
  id: string;
  action: string;
  time: string;
  iso_639_1: string;
  iso_3166_1: string;
  value: any;
  original_value: any;
}

export interface Change {
  key: string;
  items: ChangeItem[];
}
