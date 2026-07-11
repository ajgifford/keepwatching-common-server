import {
  QueuedItemAge,
  RewatchedEpisode,
  RewatchedMovie,
  RewatchedShow,
  RewatchedShowEpisodeSummary,
  SkippedShow,
  WatchlistContentType,
} from '@ajgifford/keepwatching-types';
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

export interface ShowRewatchRow extends RowDataPacket {
  show_id: number;
  show_title: string;
  rewatch_count: number;
}

export interface MovieRewatchRow extends RowDataPacket {
  movie_id: number;
  movie_title: string;
  rewatch_count: number;
}

export interface ShowRewatchWithProfileRow extends ShowRewatchRow {
  profile_name: string;
}

export interface MovieRewatchWithProfileRow extends MovieRewatchRow {
  profile_name: string;
}

export interface EpisodeRewatchRow extends RowDataPacket {
  episode_id: number;
  show_id: number;
  show_title: string;
  season_number: number;
  episode_number: number;
  episode_title: string;
  rewatch_count: number;
}

export interface EpisodeRewatchWithProfileRow extends EpisodeRewatchRow {
  profile_name: string;
}

export interface RewatchTotalRow extends RowDataPacket {
  total: number;
}

export interface ShowEpisodeRewatchSummaryRow extends RowDataPacket {
  show_id: number;
  show_title: string;
  total_episodes_rewatched: number;
  total_rewatch_count: number;
}

export interface ShowEpisodeRewatchSummaryWithProfileRow extends ShowEpisodeRewatchSummaryRow {
  profile_name: string;
}

export function mapRowToRewatchedShow(row: ShowRewatchRow): RewatchedShow {
  return {
    showId: row.show_id,
    showTitle: row.show_title,
    rewatchCount: row.rewatch_count,
  };
}

export function mapRowToRewatchedMovie(row: MovieRewatchRow): RewatchedMovie {
  return {
    movieId: row.movie_id,
    movieTitle: row.movie_title,
    rewatchCount: row.rewatch_count,
  };
}

export function mapRowToRewatchedShowWithProfile(
  row: ShowRewatchWithProfileRow,
): RewatchedShow & { profileName: string } {
  return {
    ...mapRowToRewatchedShow(row),
    profileName: row.profile_name,
  };
}

export function mapRowToRewatchedMovieWithProfile(
  row: MovieRewatchWithProfileRow,
): RewatchedMovie & { profileName: string } {
  return {
    ...mapRowToRewatchedMovie(row),
    profileName: row.profile_name,
  };
}

export function mapRowToRewatchedEpisode(row: EpisodeRewatchRow): RewatchedEpisode {
  return {
    episodeId: row.episode_id,
    showId: row.show_id,
    showTitle: row.show_title,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    episodeTitle: row.episode_title,
    rewatchCount: row.rewatch_count,
  };
}

export function mapRowToRewatchedEpisodeWithProfile(
  row: EpisodeRewatchWithProfileRow,
): RewatchedEpisode & { profileName: string } {
  return {
    ...mapRowToRewatchedEpisode(row),
    profileName: row.profile_name,
  };
}

const TOP_EPISODES_PER_SHOW = 3;

export function mapRowsToRewatchedShowEpisodeSummaries(
  summaryRows: ShowEpisodeRewatchSummaryRow[],
  episodeRows: EpisodeRewatchRow[],
): RewatchedShowEpisodeSummary[] {
  const episodesByShow = new Map<number, EpisodeRewatchRow[]>();
  for (const row of episodeRows) {
    const episodes = episodesByShow.get(row.show_id);
    if (episodes) {
      episodes.push(row);
    } else {
      episodesByShow.set(row.show_id, [row]);
    }
  }

  return summaryRows.map((row) => ({
    showId: row.show_id,
    showTitle: row.show_title,
    totalEpisodesRewatched: row.total_episodes_rewatched,
    totalRewatchCount: row.total_rewatch_count,
    topEpisodes: (episodesByShow.get(row.show_id) ?? [])
      .slice()
      .sort((a, b) => b.rewatch_count - a.rewatch_count)
      .slice(0, TOP_EPISODES_PER_SHOW)
      .map(mapRowToRewatchedEpisode),
  }));
}

export function mapRowsToRewatchedShowEpisodeSummariesWithProfile(
  summaryRows: ShowEpisodeRewatchSummaryWithProfileRow[],
  episodeRows: EpisodeRewatchWithProfileRow[],
): Array<RewatchedShowEpisodeSummary & { profileName: string }> {
  const episodesByShowAndProfile = new Map<string, EpisodeRewatchWithProfileRow[]>();
  for (const row of episodeRows) {
    const key = `${row.show_id}:${row.profile_name}`;
    const episodes = episodesByShowAndProfile.get(key);
    if (episodes) {
      episodes.push(row);
    } else {
      episodesByShowAndProfile.set(key, [row]);
    }
  }

  return summaryRows.map((row) => ({
    showId: row.show_id,
    showTitle: row.show_title,
    profileName: row.profile_name,
    totalEpisodesRewatched: row.total_episodes_rewatched,
    totalRewatchCount: row.total_rewatch_count,
    topEpisodes: (episodesByShowAndProfile.get(`${row.show_id}:${row.profile_name}`) ?? [])
      .slice()
      .sort((a, b) => b.rewatch_count - a.rewatch_count)
      .slice(0, TOP_EPISODES_PER_SHOW)
      .map(mapRowToRewatchedEpisode),
  }));
}

export interface SeasonSkipTotalsRow extends RowDataPacket {
  total_seasons_tracked: number;
  total_seasons_skipped: number;
}

export interface ShowSkipRow extends RowDataPacket {
  show_id: number;
  show_title: string;
  skipped_season_count: number;
}

export interface ShowSkipWithProfileRow extends ShowSkipRow {
  profile_name: string;
}

export function mapRowToSkippedShow(row: ShowSkipRow): SkippedShow {
  return {
    showId: row.show_id,
    showTitle: row.show_title,
    skippedSeasonCount: row.skipped_season_count,
  };
}

export function mapRowToSkippedShowWithProfile(row: ShowSkipWithProfileRow): SkippedShow & { profileName: string } {
  return {
    ...mapRowToSkippedShow(row),
    profileName: row.profile_name,
  };
}

export interface CurrentQueueTotalsRow extends RowDataPacket {
  currently_queued_count: number;
  avg_current_queue_days: number;
}

export interface QueuedItemRow extends RowDataPacket {
  content_type: WatchlistContentType;
  content_id: number;
  title: string;
  days_in_queue: number;
}

export interface QueuedItemWithProfileRow extends QueuedItemRow {
  profile_name: string;
}

export interface ChurnCountRow extends RowDataPacket {
  event_type: 'added' | 'removed';
  cnt: number;
}

export interface CompletionCountsRow extends RowDataPacket {
  completed_count: number;
  abandoned_count: number;
  total_removed: number;
}

export interface AvgCompletionRow extends RowDataPacket {
  avg_days_to_completion: number | null;
}

export function mapRowToQueuedItemAge(row: QueuedItemRow): QueuedItemAge {
  return {
    contentId: row.content_id,
    contentType: row.content_type,
    title: row.title,
    daysInQueue: Number(row.days_in_queue),
  };
}

export function mapRowToQueuedItemAgeWithProfile(row: QueuedItemWithProfileRow): QueuedItemAge & {
  profileName: string;
} {
  return {
    ...mapRowToQueuedItemAge(row),
    profileName: row.profile_name,
  };
}
