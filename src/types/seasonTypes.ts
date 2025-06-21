import {
  AdminEpisode,
  AdminSeason,
  AdminSeasonWithEpisodes,
  ProfileEpisode,
  ProfileSeason,
  WatchStatus,
  WatchStatusType,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface SeasonReferenceRow extends RowDataPacket {
  id: number;
  release_date: string;
}

export interface SeasonShowReferenceRow extends RowDataPacket {
  show_id: number;
}

interface BaseSeasonRow extends RowDataPacket {
  show_id: number;
  tmdb_id: number;
  name: string;
  overview: string;
  season_number: number;
  release_date: string;
  poster_image: string;
  number_of_episodes: number;
}

export interface ProfileSeasonRow extends BaseSeasonRow {
  profile_id: number;
  season_id: number;
  watch_status: WatchStatusType;
}

export interface AdminSeasonRow extends BaseSeasonRow {
  id: number;
  created_at: Date;
  updated_at: Date;
}

function transformBaseSeasonRow(season: BaseSeasonRow) {
  return {
    showId: season.show_id,
    tmdbId: season.tmdb_id,
    name: season.name,
    overview: season.overview,
    seasonNumber: season.season_number,
    releaseDate: season.release_date,
    posterImage: season.poster_image,
    numberOfEpisodes: season.number_of_episodes,
    watchStatus: season.watch_status,
  };
}

export function transformProfileSeason(season: ProfileSeasonRow, episodes: ProfileEpisode[]): ProfileSeason {
  return {
    ...transformBaseSeasonRow(season),
    profileId: season.profile_id,
    id: season.season_id,
    watchStatus: season.watch_status as WatchStatus,
    episodes,
  };
}

export function transformAdminSeason(season: AdminSeasonRow): AdminSeason {
  return {
    ...transformBaseSeasonRow(season),
    id: season.id,
    createdAt: season.created_at.toISOString(),
    updatedAt: season.updated_at.toISOString(),
  };
}

export function transformAdminSeasonWithEpisodes(
  season: AdminSeasonRow,
  episodesBySeason: Record<number, AdminEpisode[]>,
): AdminSeasonWithEpisodes {
  return {
    ...transformAdminSeason(season),
    episodes: episodesBySeason[season.id] || [],
  };
}
