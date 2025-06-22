import { SimpleWatchStatus, WatchStatus } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

export type EntityType = 'episode' | 'season' | 'show';

export interface StatusChange {
  entityType: EntityType;
  entityId: number;
  from: WatchStatus;
  to: WatchStatus;
  timestamp: Date;
  reason: string;
}

export interface StatusUpdateResult {
  success: boolean;
  changes: StatusChange[];
  affectedRows: number;
  message?: string;
}

export interface BaseEntity {
  id: number;
  airDate: Date;
}

export interface WatchStatusEpisode extends BaseEntity {
  seasonId: number;
  watchStatus: SimpleWatchStatus;
}

export interface WatchStatusExtendedEpisode extends WatchStatusEpisode {
  seasonWatchStatus: WatchStatus;
  seasonAirDate: Date;
  showId: number;
  showInProduction: boolean;
  showWatchStatus: WatchStatus;
  showAirDate: Date;
}

export interface WatchStatusSeason extends BaseEntity {
  showId: number;
  episodes: WatchStatusEpisode[];
  watchStatus: WatchStatus;
}

export interface WatchStatusExtendedSeason extends WatchStatusSeason {
  showInProduction: boolean;
  showWatchStatus: WatchStatus;
  showAirDate: Date;
}

export interface WatchStatusShow extends BaseEntity {
  seasons: WatchStatusSeason[];
  inProduction: boolean;
  watchStatus: WatchStatus;
}

export interface WatchStatusEpisodeRow extends RowDataPacket {
  id: number;
  season_id: number;
  air_date: string;
  status: SimpleWatchStatus;
}

export interface WatchStatusExtendedEpisodeRow extends WatchStatusEpisodeRow {
  season_status: WatchStatus;
  season_air_date: string;
  show_id: number;
  show_in_production: number;
  show_status: WatchStatus;
  show_air_date: string;
}

export interface WatchStatusSeasonRow extends RowDataPacket {
  id: number;
  show_id: number;
  release_date: string;
  status: WatchStatus;
}

export interface WatchStatusExtendedSeasonRow extends WatchStatusSeasonRow {
  show_in_production: number;
  show_status: WatchStatus;
  show_air_date: string;
}

export interface WatchStatusShowRow extends RowDataPacket {
  id: number;
  release_date: string;
  in_production: number;
  status: WatchStatus;
}

export function transformWatchStatusEpisode(episodeRow: WatchStatusEpisodeRow): WatchStatusEpisode {
  return {
    id: episodeRow.id,
    seasonId: episodeRow.season_id,
    airDate: new Date(episodeRow.air_date),
    watchStatus: episodeRow.status,
  };
}

export function transformWatchStatusExtendedEpisode(
  episodeRow: WatchStatusExtendedEpisodeRow,
): WatchStatusExtendedEpisode {
  return {
    id: episodeRow.id,
    airDate: new Date(episodeRow.air_date),
    watchStatus: episodeRow.status,
    seasonId: episodeRow.season_id,
    seasonWatchStatus: episodeRow.season_status,
    seasonAirDate: new Date(episodeRow.season_air_date),
    showId: episodeRow.show_id,
    showInProduction: episodeRow.show_in_production === 1,
    showWatchStatus: episodeRow.show_status,
    showAirDate: new Date(episodeRow.show_air_date),
  };
}

export function transformWatchStatusSeason(
  seasonRow: WatchStatusSeasonRow,
  episodes: WatchStatusEpisode[],
): WatchStatusSeason {
  return {
    id: seasonRow.id,
    showId: seasonRow.show_id,
    airDate: new Date(seasonRow.release_date),
    episodes,
    watchStatus: seasonRow.status,
  };
}

export function transformWatchStatusExtendedSeason(
  seasonRow: WatchStatusExtendedSeasonRow,
  episodes: WatchStatusEpisode[],
): WatchStatusExtendedSeason {
  return {
    id: seasonRow.id,
    showId: seasonRow.show_id,
    airDate: new Date(seasonRow.release_date),
    episodes,
    watchStatus: seasonRow.status,
    showAirDate: new Date(seasonRow.show_air_date),
    showInProduction: seasonRow.show_in_production === 1,
    showWatchStatus: seasonRow.show_status,
  };
}

export function transformWatchStatusShow(showRow: WatchStatusShowRow, seasons: WatchStatusSeason[]): WatchStatusShow {
  return {
    id: showRow.id,
    airDate: new Date(showRow.release_date),
    inProduction: showRow.in_production === 1,
    watchStatus: showRow.status,
    seasons,
  };
}
