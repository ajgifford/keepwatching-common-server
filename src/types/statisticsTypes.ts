import { RowDataPacket } from 'mysql2/promise';

export interface VelocityDataRow extends RowDataPacket {
  watch_date: string;
  episode_count: number;
  show_count: number;
  watch_hour: number;
  day_of_week: number;
}

export interface EpisodeWatchEvent extends RowDataPacket {
  show_id: number;
  show_title: string;
  episode_id: number;
  watched_at: Date;
}

export interface ShowTimeData extends RowDataPacket {
  show_id: number;
  show_title: string;
  created_at: Date;
  first_watched: Date | null;
  last_watched: Date | null;
  days_to_start: number | null;
  days_to_complete: number | null;
}

export interface MonthlyViewingData extends RowDataPacket {
  month: number;
  month_name: string;
  episode_count: number;
}

export interface MilestoneCountsRow extends RowDataPacket {
  total_episodes_watched: number;
  total_movies_watched: number;
  total_runtime_minutes: number;
  profile_created_at: Date | null;
  first_episode_watched_at: Date | null;
  first_movie_watched_at: Date | null;
}

export interface ContentDepthDataRow extends RowDataPacket {
  total_shows: number;
  total_episodes: number;
  total_movies: number;
  total_movie_runtime: number;
}

export interface ReleaseYearDataRow extends RowDataPacket {
  release_year: number;
  content_count: number;
}

export interface ContentRatingDataRow extends RowDataPacket {
  content_rating: string | null;
  content_count: number;
}

export interface ContentAdditionDataRow extends RowDataPacket {
  last_content_added: Date | null;
  shows_added_30_days: number;
  movies_added_30_days: number;
}

export interface WatchCompletionDataRow extends RowDataPacket {
  shows_completed_30_days: number;
  movies_completed_30_days: number;
}

export interface AbandonmentRiskDataRow extends RowDataPacket {
  show_id: number;
  show_title: string;
  days_since_last_watch: number;
  unwatched_episodes: number;
  status: string;
}

export interface AbandonmentRateDataRow extends RowDataPacket {
  total_started_shows: number;
  abandoned_shows: number;
}

export interface UnairedContentDataRow extends RowDataPacket {
  unaired_show_count: number;
  unaired_season_count: number;
  unaired_episode_count: number;
  unaired_movie_count: number;
}
