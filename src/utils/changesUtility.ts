import { TMDBChange } from '../types/tmdbTypes';

/**
 * List of content change keys we want to process
 * Changes with these keys will trigger an update
 */
export const SUPPORTED_CHANGE_KEYS = [
  'air_date',
  'budget',
  'cast',
  'episode',
  'episode_number',
  'episode_run_time',
  'general',
  'genres',
  'images',
  'name',
  'network',
  'overview',
  'revenue',
  'runtime',
  'season',
  'season_number',
  'status',
  'title',
  'type',
];

export const LANGUAGE_SPECIFIC_KEYS = new Set(['name', 'overview', 'title']);

export const GLOBAL_KEYS = new Set([
  'air_date',
  'budget',
  'cast',
  'episode',
  'episode_number',
  'episode_run_time',
  'general',
  'genres',
  'images',
  'network',
  'revenue',
  'runtime',
  'season_number',
  'status',
  'type',
]);

export const SUPPORTED_LANGUAGE = 'en';

/**
 * Helper function to delay execution
 * @param ms Milliseconds to delay
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract unique season IDs from change items
 * @param changes Change items from TMDB
 * @returns Array of unique season IDs
 */
export function filterUniqueSeasonIds(change: TMDBChange): number[] {
  const uniqueIds = new Set<number>();

  for (const item of change.items) {
    if (typeof item.value === 'object' && item.value !== null && 'season_id' in item.value) {
      uniqueIds.add((item.value as { season_id: number }).season_id);
    }
  }

  return Array.from(uniqueIds);
}

/**
 * Generate a date range for querying changes
 * @param lookBackDays Number of days to look back
 * @returns Object containing formatted current date and past date
 */
export function generateDateRange(lookBackDays: number): { currentDate: string; pastDate: string } {
  const currentDate = new Date();
  const pastDate = new Date();

  pastDate.setDate(currentDate.getDate() - lookBackDays);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    currentDate: formatDate(currentDate),
    pastDate: formatDate(pastDate),
  };
}
