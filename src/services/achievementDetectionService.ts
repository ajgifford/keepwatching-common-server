import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import { getAllProfileIds, getProfileCreatedAt } from '../db/profilesDb';
import * as statisticsDb from '../db/statisticsDb';
import { getDbPool } from '../utils/db';
import { CacheService } from './cacheService';
import { AchievementType, MILESTONE_THRESHOLDS } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

/**
 * Detect and record episode milestone achievements
 */
async function detectEpisodeAchievements(profileId: number, currentCount: number): Promise<number> {
  let newAchievements = 0;

  // Get existing episode achievements
  const existingAchievements = await statisticsDb.getAchievementsByType(profileId, AchievementType.EPISODES_WATCHED);
  const existingThresholds = new Set(existingAchievements.map((a) => a.thresholdValue));

  // Check first episode
  if (currentCount >= 1 && !existingThresholds.has(1)) {
    const latestEpisode = await statisticsDb.getLatestWatchedEpisode(profileId);
    const achievementDate = latestEpisode?.watchedAt || new Date();
    const metadata = latestEpisode
      ? {
          showName: latestEpisode.showName,
          episodeName: latestEpisode.episodeName,
          seasonNumber: latestEpisode.seasonNumber,
          episodeNumber: latestEpisode.episodeNumber,
        }
      : undefined;
    const insertId = await statisticsDb.recordAchievement(
      profileId,
      AchievementType.FIRST_EPISODE,
      1,
      achievementDate,
      metadata,
    );
    if (insertId > 0) newAchievements++;
  }

  // Check milestone thresholds
  for (const threshold of MILESTONE_THRESHOLDS.episodes) {
    if (currentCount >= threshold && !existingThresholds.has(threshold)) {
      const latestEpisode = await statisticsDb.getLatestWatchedEpisode(profileId);
      const achievementDate = latestEpisode?.watchedAt || new Date();
      const metadata = latestEpisode
        ? {
            showName: latestEpisode.showName,
            episodeName: latestEpisode.episodeName,
            seasonNumber: latestEpisode.seasonNumber,
            episodeNumber: latestEpisode.episodeNumber,
          }
        : undefined;
      const insertId = await statisticsDb.recordAchievement(
        profileId,
        AchievementType.EPISODES_WATCHED,
        threshold,
        achievementDate,
        metadata,
      );
      if (insertId > 0) newAchievements++;
    }
  }

  return newAchievements;
}

/**
 * Detect and record movie milestone achievements
 */
async function detectMovieAchievements(profileId: number, currentCount: number): Promise<number> {
  let newAchievements = 0;

  // Get existing movie achievements
  const existingAchievements = await statisticsDb.getAchievementsByType(profileId, AchievementType.MOVIES_WATCHED);
  const existingThresholds = new Set(existingAchievements.map((a) => a.thresholdValue));

  // Check first movie
  if (currentCount >= 1 && !existingThresholds.has(1)) {
    const latestMovie = await statisticsDb.getLatestWatchedMovie(profileId);
    const achievementDate = latestMovie?.watchedAt || new Date();
    const metadata = latestMovie
      ? {
          movieName: latestMovie.movieTitle,
        }
      : undefined;
    const insertId = await statisticsDb.recordAchievement(
      profileId,
      AchievementType.FIRST_MOVIE,
      1,
      achievementDate,
      metadata,
    );
    if (insertId > 0) newAchievements++;
  }

  // Check milestone thresholds
  for (const threshold of MILESTONE_THRESHOLDS.movies) {
    if (currentCount >= threshold && !existingThresholds.has(threshold)) {
      const latestMovie = await statisticsDb.getLatestWatchedMovie(profileId);
      const achievementDate = latestMovie?.watchedAt || new Date();
      const metadata = latestMovie
        ? {
            movieName: latestMovie.movieTitle,
          }
        : undefined;
      const insertId = await statisticsDb.recordAchievement(
        profileId,
        AchievementType.MOVIES_WATCHED,
        threshold,
        achievementDate,
        metadata,
      );
      if (insertId > 0) newAchievements++;
    }
  }

  return newAchievements;
}

/**
 * Detect and record hours watched milestone achievements
 */
async function detectHoursAchievements(profileId: number, currentHours: number): Promise<number> {
  let newAchievements = 0;

  // Get existing hours achievements
  const existingAchievements = await statisticsDb.getAchievementsByType(profileId, AchievementType.HOURS_WATCHED);
  const existingThresholds = new Set(existingAchievements.map((a) => a.thresholdValue));

  // Check milestone thresholds
  for (const threshold of MILESTONE_THRESHOLDS.hours) {
    if (currentHours >= threshold && !existingThresholds.has(threshold)) {
      const achievementDate = await statisticsDb.getLatestWatchDate(profileId);
      const insertId = await statisticsDb.recordAchievement(
        profileId,
        AchievementType.HOURS_WATCHED,
        threshold,
        achievementDate,
      );
      if (insertId > 0) newAchievements++;
    }
  }

  return newAchievements;
}

/**
 * Detect and record profile anniversary achievements. Anniversary year is used directly as the
 * achievement's threshold value, which is what already dedups a repeat call for the same year
 * via `recordAchievement`'s existing `(profile_id, achievement_type, threshold_value)` check.
 */
async function detectProfileAnniversary(profileId: number): Promise<number> {
  const createdAt = await getProfileCreatedAt(profileId);
  if (!createdAt) {
    return 0;
  }

  const now = new Date();
  let elapsedYears = now.getFullYear() - createdAt.getFullYear();
  const anniversaryPassedThisYear =
    now.getMonth() > createdAt.getMonth() ||
    (now.getMonth() === createdAt.getMonth() && now.getDate() >= createdAt.getDate());
  if (!anniversaryPassedThisYear) {
    elapsedYears -= 1;
  }

  if (elapsedYears < 1) {
    return 0;
  }

  const existingAchievements = await statisticsDb.getAchievementsByType(profileId, AchievementType.PROFILE_ANNIVERSARY);
  const existingThresholds = new Set(existingAchievements.map((a) => a.thresholdValue));

  let newAchievements = 0;
  for (const year of MILESTONE_THRESHOLDS.anniversary) {
    if (elapsedYears >= year && !existingThresholds.has(year)) {
      const insertId = await statisticsDb.recordAchievement(profileId, AchievementType.PROFILE_ANNIVERSARY, year, now);
      if (insertId > 0) newAchievements++;
    }
  }

  return newAchievements;
}

/**
 * Detect and record show completion achievement
 */
export async function detectShowCompletion(profileId: number, showId: number, showTitle: string): Promise<boolean> {
  try {
    const achievementDate = new Date();
    const metadata = {
      showId,
      showTitle,
    };

    const insertId = await statisticsDb.recordAchievement(
      profileId,
      AchievementType.SHOW_COMPLETED,
      showId, // Use showId as threshold for uniqueness
      achievementDate,
      metadata,
    );

    return insertId > 0;
  } catch (error) {
    console.error('Error detecting show completion achievement:', error);
    return false;
  }
}

/**
 * Main function to check and record all achievements for a profile
 * Call this after watch status updates
 *
 * @param profileId - ID of the profile to check
 * @param accountId - Optional account ID for cache invalidation
 * @returns Number of new achievements recorded
 */
export async function checkAndRecordAchievements(profileId: number, accountId?: number): Promise<number> {
  try {
    // Get current counts
    const counts = await statisticsDb.getWatchCounts(profileId);

    let totalNewAchievements = 0;

    // Check episode achievements
    totalNewAchievements += await detectEpisodeAchievements(profileId, counts.episodes);

    // Check movie achievements
    totalNewAchievements += await detectMovieAchievements(profileId, counts.movies);

    // Check hours achievements
    totalNewAchievements += await detectHoursAchievements(profileId, counts.hours);

    // Check profile anniversary achievements
    totalNewAchievements += await detectProfileAnniversary(profileId);

    // Clear milestone cache if new achievements were recorded
    if (totalNewAchievements > 0) {
      const cacheService = CacheService.getInstance();
      cacheService.invalidate(PROFILE_KEYS.milestoneStats(profileId));
      if (accountId) {
        cacheService.invalidate(ACCOUNT_KEYS.milestoneStats(accountId));
      }
    }

    return totalNewAchievements;
  } catch (error) {
    console.error('Error checking achievements for profile', profileId, error);
    return 0;
  }
}

/**
 * Batch check achievements for multiple profiles
 * Useful for periodic batch processing
 */
export async function batchCheckAchievements(profileIds: number[]): Promise<Map<number, number>> {
  const results = new Map<number, number>();

  for (const profileId of profileIds) {
    const newAchievements = await checkAndRecordAchievements(profileId);
    results.set(profileId, newAchievements);
  }

  return results;
}

interface WatchedShowRow extends RowDataPacket {
  id: number;
  title: string;
}

/**
 * One-off backfill for `SHOW_COMPLETED` achievements a profile should already have earned.
 * `detectShowCompletion` is only ever called from a status-update flow going forward (see
 * `watchStatusService.ts`), so a show that was already WATCHED before that wiring existed has no
 * achievement record for it. This scans a profile's currently-WATCHED shows and detects each one
 * individually -- safe to re-run, since `detectShowCompletion`/`recordAchievement` already dedup
 * per (profile, show).
 *
 * @param profileId - ID of the profile to backfill
 * @returns Number of new achievements recorded
 */
export async function backfillShowCompletionAchievements(profileId: number): Promise<number> {
  const [rows] = await getDbPool().execute<WatchedShowRow[]>(
    `SELECT sh.id, sh.title
     FROM show_watch_status sws
     JOIN shows sh ON sh.id = sws.show_id
     WHERE sws.profile_id = ? AND sws.status = 'WATCHED'`,
    [profileId],
  );

  let newAchievements = 0;
  for (const row of rows) {
    const recorded = await detectShowCompletion(profileId, row.id, row.title);
    if (recorded) {
      newAchievements++;
    }
  }

  if (newAchievements > 0) {
    const cacheService = CacheService.getInstance();
    cacheService.invalidate(PROFILE_KEYS.milestoneStats(profileId));
  }

  return newAchievements;
}

/**
 * Runs `backfillShowCompletionAchievements` across every profile in the system.
 */
export async function backfillShowCompletionAchievementsForAllProfiles(): Promise<Map<number, number>> {
  const profileIds = await getAllProfileIds();
  const results = new Map<number, number>();

  for (const profileId of profileIds) {
    try {
      results.set(profileId, await backfillShowCompletionAchievements(profileId));
    } catch (error) {
      console.error('Error backfilling show completion achievements for profile', profileId, error);
      results.set(profileId, 0);
    }
  }

  return results;
}
