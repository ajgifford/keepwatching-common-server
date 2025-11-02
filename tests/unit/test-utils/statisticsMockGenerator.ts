import { MILESTONE_THRESHOLDS, Milestone } from '@ajgifford/keepwatching-types';
import { calculateMilestones } from '@utils/statisticsUtil';

export function createMilestones(episodes: number, movies: number, hours: number): Milestone[] {
  const episodeMilestones = calculateMilestones(episodes, MILESTONE_THRESHOLDS.episodes, 'episodes');
  const movieMilestones = calculateMilestones(movies, MILESTONE_THRESHOLDS.movies, 'movies');
  const hourMilestones = calculateMilestones(hours, MILESTONE_THRESHOLDS.hours, 'hours');

  return [...episodeMilestones, ...movieMilestones, ...hourMilestones];
}
