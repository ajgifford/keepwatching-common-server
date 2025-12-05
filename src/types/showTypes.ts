import { AdminShow, ProfileShow, ShowReference, WatchStatus, WatchStatusType } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ShowReferenceRow extends RowDataPacket {
  id: number;
  tmdb_id: number;
  title: string;
  release_date: string;
}

export function transformShowReferenceRow(show: ShowReferenceRow): ShowReference {
  return {
    id: show.id,
    tmdbId: show.tmdb_id,
    title: show.title,
    releaseDate: show.release_date,
  };
}

export interface ProfileForShowRow extends RowDataPacket {
  profile_id: number;
  account_id: number;
}

interface BaseShowRow extends RowDataPacket {
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  poster_image: string;
  backdrop_image: string;
  season_count: number;
  episode_count: number;
  user_rating: number;
  content_rating: string;
  status: string;
  type: string;
  in_production: 0 | 1;
  last_air_date: string;
  network: string;
  genres: string;
  streaming_services: string;
}

export interface AdminShowRow extends BaseShowRow {
  id: number;
  updated_at: Date;
}

export interface ProfileShowRow extends BaseShowRow {
  profile_id: number;
  show_id: number;
  watch_status: WatchStatusType;
  last_episode_title: string;
  last_episode_air_date: string;
  last_episode_number: number;
  last_episode_season: number;
  next_episode_title: string;
  next_episode_air_date: string;
  next_episode_number: number;
  next_episode_season: number;
}

function transformBaseShowRow(show: BaseShowRow) {
  return {
    tmdbId: show.tmdb_id,
    title: show.title,
    description: show.description,
    releaseDate: show.release_date,
    posterImage: show.poster_image,
    backdropImage: show.backdrop_image,
    network: show.network,
    seasonCount: show.season_count,
    episodeCount: show.episode_count,
    userRating: show.user_rating,
    contentRating: show.content_rating,
    status: show.status,
    type: show.type,
    inProduction: Boolean(show.in_production),
    lastAirDate: show.last_air_date,
    streamingServices: show.streaming_services,
    genres: show.genres,
  };
}

export function transformProfileShow(show: ProfileShowRow): ProfileShow {
  return {
    ...transformBaseShowRow(show),
    profileId: show.profile_id,
    id: show.show_id,
    lastEpisode: show.last_episode_title
      ? {
          title: show.last_episode_title,
          airDate: show.last_episode_air_date,
          seasonNumber: show.last_episode_season,
          episodeNumber: show.last_episode_number,
        }
      : null,
    nextEpisode: show.next_episode_title
      ? {
          title: show.next_episode_title,
          airDate: show.next_episode_air_date,
          seasonNumber: show.next_episode_season,
          episodeNumber: show.next_episode_number,
        }
      : null,
    watchStatus: show.watch_status as WatchStatus,
  };
}

export function transformAdminShow(show: AdminShowRow): AdminShow {
  return {
    ...transformBaseShowRow(show),
    id: show.id,
    lastUpdated: show.updated_at.toISOString(),
  };
}

export interface ProfileShowWatchProgressRow extends RowDataPacket {
  profile_id: number;
  show_id: number;
  title: string;
  watch_status: WatchStatusType;
  total_episodes: number;
  watched_episodes: number;
  unaired_episodes: number;
}

export function transformProfileShowWatchProgress(row: ProfileShowWatchProgressRow) {
  const totalEpisodes = Number(row.total_episodes) || 0;
  const watchedEpisodes = Number(row.watched_episodes) || 0;
  const unairedEpisodes = Number(row.unaired_episodes) || 0;
  
  return {
    showId: row.show_id,
    title: row.title,
    status: row.watch_status as WatchStatus,
    totalEpisodes,
    watchedEpisodes,
    unairedEpisodes,
    percentComplete:
      totalEpisodes > 0
        ? Math.round((watchedEpisodes / (totalEpisodes - unairedEpisodes)) * 100)
        : 0,
  };
}
