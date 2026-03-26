import { WatchHistoryItem } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface WatchHistoryRow extends RowDataPacket {
  historyId: number;
  contentType: 'episode' | 'movie';
  contentId: number;
  title: string;
  parentTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  posterImage: string;
  watchedAt: string;
  watchNumber: number;
  isPriorWatch: number | boolean;
  runtime: number;
}

export function transformWatchHistoryRow(row: WatchHistoryRow): WatchHistoryItem {
  return {
    historyId: row.historyId,
    contentType: row.contentType,
    contentId: row.contentId,
    title: row.title,
    parentTitle: row.parentTitle,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    posterImage: row.posterImage,
    watchedAt: row.watchedAt,
    watchNumber: row.watchNumber,
    isPriorWatch: Boolean(row.isPriorWatch),
    runtime: row.runtime,
  };
}
