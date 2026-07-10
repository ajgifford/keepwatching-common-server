import { MilestoneCountsRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { calculateMilestones } from '../../utils/statisticsUtil';
import { getRecentAchievements } from './achievementRepository';
import { Achievement, AchievementType, MILESTONE_THRESHOLDS, MilestoneStats } from '@ajgifford/keepwatching-types';

function elapsedAnniversaryYears(profileCreatedAt: Date | null): number {
  if (!profileCreatedAt) {
    return 0;
  }
  const now = new Date();
  let years = now.getFullYear() - profileCreatedAt.getFullYear();
  const anniversaryPassedThisYear =
    now.getMonth() > profileCreatedAt.getMonth() ||
    (now.getMonth() === profileCreatedAt.getMonth() && now.getDate() >= profileCreatedAt.getDate());
  if (!anniversaryPassedThisYear) {
    years -= 1;
  }
  return Math.max(years, 0);
}

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

    // Shows completed and profile anniversary counts, for their own tiered milestones
    const totalShowsCompleted = allAchievements.filter(
      (a) => a.achievementType === AchievementType.SHOW_COMPLETED,
    ).length;
    const elapsedYears = elapsedAnniversaryYears(
      counts.profile_created_at ? new Date(counts.profile_created_at) : null,
    );

    // Calculate milestones for each category
    const episodeMilestones = calculateMilestones(totalEpisodesWatched, MILESTONE_THRESHOLDS.episodes, 'episodes');
    const movieMilestones = calculateMilestones(totalMoviesWatched, MILESTONE_THRESHOLDS.movies, 'movies');
    const hourMilestones = calculateMilestones(totalHoursWatched, MILESTONE_THRESHOLDS.hours, 'hours');
    const showsCompletedMilestones = calculateMilestones(
      totalShowsCompleted,
      MILESTONE_THRESHOLDS.showsCompleted,
      'showsCompleted',
    );
    const anniversaryMilestones = calculateMilestones(elapsedYears, MILESTONE_THRESHOLDS.anniversary, 'anniversary');

    // Combine all milestones
    const allMilestones = [
      ...episodeMilestones,
      ...movieMilestones,
      ...hourMilestones,
      ...showsCompletedMilestones,
      ...anniversaryMilestones,
    ];

    const describeAchievement = (record: (typeof allAchievements)[number]): string => {
      switch (record.achievementType) {
        case AchievementType.EPISODES_WATCHED:
          return `${record.thresholdValue} Episodes Watched`;
        case AchievementType.MOVIES_WATCHED:
          return `${record.thresholdValue} Movies Watched`;
        case AchievementType.HOURS_WATCHED:
          return `${record.thresholdValue} Hours Watched`;
        case AchievementType.FIRST_EPISODE:
          return 'First Episode Watched';
        case AchievementType.FIRST_MOVIE:
          return 'First Movie Watched';
        case AchievementType.SHOW_COMPLETED:
          return `Completed: ${record.metadata?.showTitle || 'Show'}`;
        case AchievementType.WATCH_STREAK:
          return `${record.thresholdValue} Day Watch Streak`;
        case AchievementType.BINGE_SESSION:
          return `${record.thresholdValue} Episode Binge Session`;
        case AchievementType.PROFILE_ANNIVERSARY:
          return `${record.thresholdValue} Year Anniversary`;
        default:
          return `Achievement: ${record.thresholdValue}`;
      }
    };

    const toAchievement = (record: (typeof allAchievements)[number]): Achievement => ({
      description: describeAchievement(record),
      achievedDate: record.achievedAt,
      achievementType: record.achievementType,
      thresholdValue: record.thresholdValue,
      metadata: record.metadata,
    });

    // Format achievements for the response
    const recentAchievements: Achievement[] = achievementRecords.map(toAchievement);
    const formattedAllAchievements: Achievement[] = allAchievements.map(toAchievement);

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
      allAchievements: formattedAllAchievements,
      firstEpisodeMetadata,
      firstMovieMetadata,
    };
  });
}
