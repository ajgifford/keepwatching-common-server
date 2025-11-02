import { Milestone } from '@ajgifford/keepwatching-types';

/**
 * Calculate milestone progress for a specific metric
 *
 * @param current - Current value
 * @param thresholds - Array of threshold values
 * @param type - Type of milestone
 * @returns Array of milestone objects
 * @private
 */
export function calculateMilestones(
  current: number,
  thresholds: number[],
  type: 'episodes' | 'movies' | 'hours',
): Milestone[] {
  return thresholds.map((threshold) => {
    const achieved = current >= threshold;
    const progress = Math.min((current / threshold) * 100, 100);

    return {
      type,
      threshold,
      achieved,
      progress: Math.round(progress * 10) / 10, // Round to 1 decimal place
    };
  });
}
