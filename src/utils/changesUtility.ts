import { ChangeItem } from '../types/contentTypes';

/**
 * List of content change keys we want to process
 * Changes with these keys will trigger an update
 */
export const SUPPORTED_CHANGE_KEYS = [
  'air_date',
  'episode',
  'episode_number',
  'episode_run_time',
  'general',
  'genres',
  'images',
  'name',
  'network',
  'overview',
  'runtime',
  'season',
  'season_number',
  'status',
  'title',
  'type',
];

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
export function filterUniqueSeasonIds(changes: ChangeItem[]): number[] {
  const uniqueSeasonIds = new Set<number>();

  for (const change of changes) {
    if (change.value && change.value.season_id) {
      uniqueSeasonIds.add(change.value.season_id);
    }
  }

  return Array.from(uniqueSeasonIds);
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
