import { getProfileImage } from '../utils/imageUtility';
import {
  AdminProfile,
  AdminSeasonWatchProgress,
  ContentProfiles,
  Profile,
  WatchStatus,
  WatchStatusType,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ProfileAccountReferenceRow extends RowDataPacket {
  account_id: number;
}

export interface ProfileRow extends RowDataPacket {
  profile_id: number;
  account_id: number;
  name: string;
  image: string;
}

export interface AdminProfileRow extends ProfileRow {
  created_at: Date;
  favorited_shows: number;
  favorited_movies: number;
}

export function transformProfile(profile: ProfileRow): Profile {
  return {
    id: profile.profile_id,
    accountId: profile.account_id,
    name: profile.name,
    image: profile.image,
  };
}

export function transformAdminProfile(profile: AdminProfileRow): AdminProfile {
  return {
    ...transformProfile(profile),
    createdAt: profile.created_at.toISOString(),
    favoritedShows: profile.favorited_shows,
    favoritedMovies: profile.favorited_movies,
  };
}

export function transformProfileForImage(profile: Profile) {
  return {
    ...profile,
    image: getProfileImage(profile.image, profile.name),
  };
}

export function transformAdminProfileForImage(profile: AdminProfile) {
  return {
    ...profile,
    image: getProfileImage(profile.image, profile.name),
  };
}

export interface ContentProfilesRow extends RowDataPacket {
  profile_id: number;
  name: string;
  image: string;
  account_id: number;
  account_name: string;
  watch_status: WatchStatusType;
  added_date: Date;
  status_updated_date: Date;
}

export function transformContentProfiles(profile: ContentProfilesRow): ContentProfiles {
  return {
    profileId: profile.profile_id,
    name: profile.name,
    image: profile.image,
    accountId: profile.account_id,
    accountName: profile.account_name,
    watchStatus: profile.watch_status as WatchStatus,
    addedDate: profile.added_date.toISOString(),
    lastUpdated: profile.status_updated_date.toISOString(),
  };
}

export interface ProfileShowStatusRow extends RowDataPacket {
  profile_id: number;
  name: string;
  show_status: WatchStatusType;
}

export interface AdminSeasonWatchProgressRow extends RowDataPacket {
  show_id: number;
  profile_id: number;
  season_id: number;
  name: string;
  season_number: number;
  number_of_episodes: number;
  season_status: WatchStatusType;
  watched_episodes: number;
}

export function transformAdminSeasonWatchProgress(season: AdminSeasonWatchProgressRow): AdminSeasonWatchProgress {
  const seasonPercentComplete =
    season.number_of_episodes > 0 ? Math.round((season.watched_episodes / season.number_of_episodes) * 100) : 0;

  return {
    seasonId: season.season_id,
    seasonNumber: season.season_number,
    name: season.name,
    status: season.season_status as WatchStatus,
    episodeCount: season.number_of_episodes,
    watchedEpisodes: season.watched_episodes,
    percentComplete: seasonPercentComplete,
  };
}

export interface RecentShowsWithUnwatchedRow extends RowDataPacket {
  show_id: number;
  show_title: string;
  poster_image: string;
  profile_id: number;
  last_watched_date: Date;
}
