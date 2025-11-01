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
