import { MilestoneCountsRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { calculateMilestones } from '../../utils/statisticsUtil';
import { Achievement, MILESTONE_THRESHOLDS, MilestoneStats } from '@ajgifford/keepwatching-types';

/**
 * Get milestone statistics for a profile
 * Includes total counts, milestone progress, and recent achievements
 *
 * @param profileId - ID of the profile
 * @returns Milestone statistics
 */
export async function getMilestoneStats(profileId: number): Promise<MilestoneStats> {
  return await DbMonitor.getInstance().executeWithTiming('getMilestoneStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get total counts and anniversary dates
      const [countRows] = await connection.query<MilestoneCountsRow[]>(
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
      const profileCreatedAt = counts.profile_created_at
        ? new Date(counts.profile_created_at).toISOString()
        : undefined;
      const firstEpisodeWatchedAt = counts.first_episode_watched_at
        ? new Date(counts.first_episode_watched_at).toISOString()
        : undefined;
      const firstMovieWatchedAt = counts.first_movie_watched_at
        ? new Date(counts.first_movie_watched_at).toISOString()
        : undefined;

      // Calculate milestones for each category
      const episodeMilestones = calculateMilestones(totalEpisodesWatched, MILESTONE_THRESHOLDS.episodes, 'episodes');
      const movieMilestones = calculateMilestones(totalMoviesWatched, MILESTONE_THRESHOLDS.movies, 'movies');
      const hourMilestones = calculateMilestones(totalHoursWatched, MILESTONE_THRESHOLDS.hours, 'hours');

      // Combine all milestones
      const allMilestones = [...episodeMilestones, ...movieMilestones, ...hourMilestones];

      // Determine recent achievements (milestones that were recently achieved)
      const recentAchievements: Achievement[] = [];
      const achievementDate = new Date().toISOString();

      // Check for recently achieved episode milestones
      const recentlyAchievedEpisodes = episodeMilestones.filter((m) => m.achieved);
      if (recentlyAchievedEpisodes.length > 0) {
        const latest = recentlyAchievedEpisodes[recentlyAchievedEpisodes.length - 1];
        if (latest && totalEpisodesWatched >= latest.threshold && totalEpisodesWatched < latest.threshold + 10) {
          recentAchievements.push({
            description: `${latest.threshold} Episodes Watched`,
            achievedDate: achievementDate,
          });
        }
      }

      // Check for recently achieved movie milestones
      const recentlyAchievedMovies = movieMilestones.filter((m) => m.achieved);
      if (recentlyAchievedMovies.length > 0) {
        const latest = recentlyAchievedMovies[recentlyAchievedMovies.length - 1];
        if (latest && totalMoviesWatched >= latest.threshold && totalMoviesWatched < latest.threshold + 5) {
          recentAchievements.push({
            description: `${latest.threshold} Movies Watched`,
            achievedDate: achievementDate,
          });
        }
      }

      // Check for recently achieved hour milestones
      const recentlyAchievedHours = hourMilestones.filter((m) => m.achieved);
      if (recentlyAchievedHours.length > 0) {
        const latest = recentlyAchievedHours[recentlyAchievedHours.length - 1];
        if (latest && totalHoursWatched >= latest.threshold && totalHoursWatched < latest.threshold + 10) {
          recentAchievements.push({
            description: `${latest.threshold} Hours Watched`,
            achievedDate: achievementDate,
          });
        }
      }

      return {
        totalEpisodesWatched,
        totalMoviesWatched,
        totalHoursWatched,
        profileCreatedAt,
        firstEpisodeWatchedAt,
        firstMovieWatchedAt,
        milestones: allMilestones,
        recentAchievements,
      };
    } finally {
      connection.release();
    }
  });
}
