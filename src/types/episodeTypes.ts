import {
  AdminEpisode,
  NextEpisode,
  ProfileEpisode,
  RecentUpcomingEpisode,
  SimpleWatchStatus,
  SimpleWatchStatusType,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface EpisodeReferenceRow extends RowDataPacket {
  id: number;
  air_date: string;
}

interface BaseEpisodeRow extends RowDataPacket {
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
}

export interface ProfileEpisodeRow extends BaseEpisodeRow {
  profile_id: number;
  episode_id: number;
  watch_status: SimpleWatchStatusType;
}

export interface AdminEpisodeRow extends BaseEpisodeRow {
  id: number;
  created_at: Date;
  updated_at: Date;
}

function transformBaseEpisode(episode: BaseEpisodeRow) {
  return {
    tmdbId: episode.tmdb_id,
    seasonId: episode.season_id,
    showId: episode.show_id,
    episodeNumber: episode.episode_number,
    episodeType: episode.episode_type,
    seasonNumber: episode.season_number,
    title: episode.title,
    overview: episode.overview,
    runtime: episode.runtime,
    airDate: episode.air_date,
    stillImage: episode.still_image,
  };
}

export function transformProfileEpisode(episode: ProfileEpisodeRow): ProfileEpisode {
  return {
    ...transformBaseEpisode(episode),
    profileId: episode.profile_id,
    id: episode.episode_id,
    watchStatus: episode.watch_status as SimpleWatchStatus,
  };
}

export function transformAdminEpisode(episode: AdminEpisodeRow): AdminEpisode {
  return {
    ...transformBaseEpisode(episode),
    id: episode.id,
    createdAt: episode.created_at.toISOString(),
    updatedAt: episode.updated_at.toISOString(),
  };
}

export interface NextUnwatchedEpisodesRow extends RowDataPacket {
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
  poser_image: string;
  network: string;
  streaming_services: string;
  profile_id: number;
  episode_rank: number;
}

export function transformNextUnwatchedEpisodes(episode: NextUnwatchedEpisodesRow): NextEpisode {
  return {
    episodeId: episode.episode_id,
    episodeTitle: episode.episode_title,
    overview: episode.overview,
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    episodeStillImage: episode.episode_still_image,
    airDate: episode.air_date,
    showId: episode.show_id,
    showName: episode.show_name,
    seasonId: episode.season_id,
    posterImage: episode.poser_image,
    network: episode.network,
    streamingServices: episode.streaming_services,
    profileId: episode.profile_id,
  };
}

export interface RecentUpcomingEpisodeRow extends RowDataPacket {
  profile_id: number;
  show_id: number;
  show_name: string;
  streaming_services: string;
  network: string;
  episode_title: string;
  air_date: string;
  episode_number: number;
  season_number: number;
  episode_still_image: string;
}

export function transformRecentUpcomingEpisode(episode: RecentUpcomingEpisodeRow): RecentUpcomingEpisode {
  return {
    profileId: episode.profile_id,
    showId: episode.show_id,
    showName: episode.show_name,
    streamingServices: episode.streaming_services,
    network: episode.network,
    episodeTitle: episode.episode_title,
    airDate: episode.air_date,
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    episodeStillImage: episode.episode_still_image,
  };
}
