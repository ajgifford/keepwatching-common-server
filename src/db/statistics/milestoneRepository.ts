import { MilestoneCountsRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { calculateMilestones } from '../../utils/statisticsUtil';
import { getRecentAchievements } from './achievementRepository';
import { Achievement, AchievementType, MILESTONE_THRESHOLDS, MilestoneStats } from '@ajgifford/keepwatching-types';

/**
 * Get milestone statistics for a profile
 * Includes total counts, milestone progress, and recent achievements
 *
 * @param profileId - ID of the profile
 * @returns Milestone statistics
 */
export async function getMilestoneStats(profileId: number): Promise<MilestoneStats> {
  return await DbMonitor.getInstance().executeWithTiming('getMilestoneStats', async () => {
    // Get total counts and anniversary dates
    const [countRows] = await getDbPool().execute<MilestoneCountsRow[]>(
      `
      SELECT
        COALESCE(
          (SELECT COUNT(*)
           FROM episode_watch_status
           WHERE profile_id = ? AND status = 'WATCHED'),
          0
        ) as total_episodes_watched,
        COALESCE(
          (SELECT COUNT(*)
           FROM movie_watch_status
           WHERE profile_id = ? AND status = 'WATCHED'),
          0
        ) as total_movies_watched,
        COALESCE(
          (SELECT SUM(e.runtime)
           FROM episode_watch_status ews
           JOIN episodes e ON e.id = ews.episode_id
           WHERE ews.profile_id = ? AND ews.status = 'WATCHED'),
          0
        ) +
        COALESCE(
          (SELECT SUM(m.runtime)
           FROM movie_watch_status mws
           JOIN movies m ON m.id = mws.movie_id
           WHERE mws.profile_id = ? AND mws.status = 'WATCHED'),
          0
        ) as total_runtime_minutes,
        (SELECT created_at FROM profiles WHERE profile_id = ?) as profile_created_at,
        (SELECT MIN(updated_at) FROM episode_watch_status WHERE profile_id = ? AND status = 'WATCHED') as first_episode_watched_at,
        (SELECT MIN(updated_at) FROM movie_watch_status WHERE profile_id = ? AND status = 'WATCHED') as first_movie_watched_at
      `,
      [profileId, profileId, profileId, profileId, profileId, profileId, profileId],
    );

    const counts = countRows[0] || {
      total_episodes_watched: 0,
      total_movies_watched: 0,
      total_runtime_minutes: 0,
      profile_created_at: null,
      first_episode_watched_at: null,
      first_movie_watched_at: null,
    };

    const totalEpisodesWatched = counts.total_episodes_watched;
    const totalMoviesWatched = counts.total_movies_watched;
    const totalHoursWatched = Math.round(counts.total_runtime_minutes / 60);

    // Convert dates to ISO strings if they exist
    const createdAt = counts.profile_created_at ? new Date(counts.profile_created_at).toISOString() : undefined;

    // Get all achievements to find both recent ones and first episode/movie
    const allAchievements = await getRecentAchievements(profileId, 365 * 10); // Get all achievements

    // Filter recent achievements (last 30 days) for the response
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const achievementRecords = allAchievements.filter((a) => new Date(a.achievedAt) >= thirtyDaysAgo);

    // Find FIRST_EPISODE and FIRST_MOVIE achievements for richer metadata
    const firstEpisodeAchievement = allAchievements.find((a) => a.achievementType === AchievementType.FIRST_EPISODE);
    const firstMovieAchievement = allAchievements.find((a) => a.achievementType === AchievementType.FIRST_MOVIE);

    const firstEpisodeWatchedAt =
      firstEpisodeAchievement?.achievedAt ||
      (counts.first_episode_watched_at ? new Date(counts.first_episode_watched_at).toISOString() : undefined);
    const firstMovieWatchedAt =
      firstMovieAchievement?.achievedAt ||
      (counts.first_movie_watched_at ? new Date(counts.first_movie_watched_at).toISOString() : undefined);

    // Calculate milestones for each category
    const episodeMilestones = calculateMilestones(totalEpisodesWatched, MILESTONE_THRESHOLDS.episodes, 'episodes');
    const movieMilestones = calculateMilestones(totalMoviesWatched, MILESTONE_THRESHOLDS.movies, 'movies');
    const hourMilestones = calculateMilestones(totalHoursWatched, MILESTONE_THRESHOLDS.hours, 'hours');

    // Combine all milestones
    const allMilestones = [...episodeMilestones, ...movieMilestones, ...hourMilestones];

    // Format achievements for the response
    const recentAchievements: Achievement[] = achievementRecords.map((record) => {
      let description = '';

      switch (record.achievementType) {
        case AchievementType.EPISODES_WATCHED:
          description = `${record.thresholdValue} Episodes Watched`;
          break;
        case AchievementType.MOVIES_WATCHED:
          description = `${record.thresholdValue} Movies Watched`;
          break;
        case AchievementType.HOURS_WATCHED:
          description = `${record.thresholdValue} Hours Watched`;
          break;
        case AchievementType.FIRST_EPISODE:
          description = 'First Episode Watched';
          break;
        case AchievementType.FIRST_MOVIE:
          description = 'First Movie Watched';
          break;
        case AchievementType.SHOW_COMPLETED:
          description = `Completed: ${record.metadata?.showTitle || 'Show'}`;
          break;
        case AchievementType.WATCH_STREAK:
          description = `${record.thresholdValue} Day Watch Streak`;
          break;
        case AchievementType.BINGE_SESSION:
          description = `${record.thresholdValue} Episode Binge Session`;
          break;
        case AchievementType.PROFILE_ANNIVERSARY:
          description = `${record.thresholdValue} Year Anniversary`;
          break;
        default:
          description = `Achievement: ${record.thresholdValue}`;
      }

      return {
        description,
        achievedDate: record.achievedAt,
        metadata: record.metadata,
      };
    });

    // Include metadata for first episode and movie achievements
    const firstEpisodeMetadata = firstEpisodeAchievement?.metadata;
    const firstMovieMetadata = firstMovieAchievement?.metadata;

    return {
      totalEpisodesWatched,
      totalMoviesWatched,
      totalHoursWatched,
      createdAt,
      firstEpisodeWatchedAt,
      firstMovieWatchedAt,
      milestones: allMilestones,
      recentAchievements,
      firstEpisodeMetadata,
      firstMovieMetadata,
    };
  });
}
