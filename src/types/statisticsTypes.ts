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

export interface ProfileComparisonRow extends RowDataPacket {
  profile_id: number;
  profile_name: string;
  total_shows: number;
  total_movies: number;
  episodes_watched: number;
  movies_watched: number;
  total_hours_watched: number;
  show_watch_progress: number;
  movie_watch_progress: number;
  last_activity_date: string | null;
  currently_watching_count: number;
  completed_shows_count: number;
}

export interface ProfileGenreRow extends RowDataPacket {
  profile_id: number;
  genre_name: string;
  genre_count: number;
}

export interface ProfileServiceRow extends RowDataPacket {
  profile_id: number;
  service_name: string;
  service_count: number;
}

export interface ProfileVelocityRow extends RowDataPacket {
  profile_id: number;
  episodes_per_week: number;
  most_active_day: string;
}

export interface AccountSummaryRow extends RowDataPacket {
  total_unique_shows: number;
  total_unique_movies: number;
  most_watched_show_id: number | null;
  most_watched_show_title: string | null;
  most_watched_show_count: number | null;
  most_watched_movie_id: number | null;
  most_watched_movie_title: string | null;
  most_watched_movie_count: number | null;
}

export interface AccountRankingRow extends RowDataPacket {
  account_id: number;
  account_email: string;
  account_name: string;
  profile_count: number;
  total_episodes_watched: number;
  total_movies_watched: number;
  total_hours_watched: number;
  engagement_score: number;
  last_activity_date: string | null;
}

export interface AccountHealthRow extends RowDataPacket {
  account_id: number;
  account_email: string;
  uid: string;
  email_verified: boolean;
  account_created_at: string;
  profile_count: number;
  total_episodes_watched: number;
  recent_episodes_watched: number;
  last_activity_date: string | null;
  days_since_last_activity: number;
}

export interface LatestEpisodeRow extends RowDataPacket {
  episode_id: number;
  show_name: string;
  episode_name: string;
  season_number: number;
  episode_number: number;
  updated_at: Date;
}

export interface LatestMovieRow extends RowDataPacket {
  movie_id: number;
  movie_title: string;
  updated_at: Date;
}

export interface MilestoneAchievementRow extends RowDataPacket {
  id: number;
  profile_id: number;
  achievement_type: string;
  threshold_value: number;
  achieved_at: Date;
  created_at: Date;
  metadata: string | null;
}

export interface PlatformOverviewRow extends RowDataPacket {
  total_accounts: number;
  active_accounts: number;
  total_profiles: number;
  total_shows: number;
  total_movies: number;
  total_episodes_watched: number;
  total_movies_watched: number;
  total_hours_watched: number;
}

export interface PlatformTrendsRow extends RowDataPacket {
  activity_date: string;
  active_accounts: number;
  episodes_watched: number;
  movies_watched: number;
}

export interface NewAccountsRow extends RowDataPacket {
  new_accounts: number;
}

export interface ContentPopularityRow extends RowDataPacket {
  content_id: number;
  title: string;
  content_type: 'show' | 'movie';
  account_count: number;
  profile_count: number;
  total_watch_count: number;
  completion_rate: number;
  release_year: number | null;
}

export interface TrendingContentRow extends RowDataPacket {
  content_id: number;
  title: string;
  content_type: 'show' | 'movie';
  new_additions: number;
  recent_watch_count: number;
  previous_watch_count: number;
}

export interface ContentEngagementRow extends RowDataPacket {
  content_id: number;
  title: string;
  total_profiles: number;
  completed_profiles: number;
  watching_profiles: number;
  not_started_profiles: number;
  abandoned_profiles: number;
  avg_days_to_complete: number;
  avg_progress: number;
}

export interface WatchCountRow extends RowDataPacket {
  total_episodes_watched: number;
  total_movies_watched: number;
  total_runtime_minutes: number;
}

export interface LatestWatchRow extends RowDataPacket {
  latest_watch_date: Date;
}
