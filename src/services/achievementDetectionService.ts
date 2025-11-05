import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as statisticsDb from '../db/statisticsDb';
import { CacheService } from './cacheService';
import { AchievementType, MILESTONE_THRESHOLDS } from '@ajgifford/keepwatching-types';

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
