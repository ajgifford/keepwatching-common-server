import { WatchStatus } from '@ajgifford/keepwatching-types';
import z from 'zod';

/**
 * Schema covering all the watch status values
 */
export const watchStatusSchema = z.enum(
  [WatchStatus.UNAIRED, WatchStatus.NOT_WATCHED, WatchStatus.WATCHING, WatchStatus.WATCHED, WatchStatus.UP_TO_DATE],
  {
    message: 'Status must be one of: UNAIRED, NOT_WATCHED, WATCHING, WATCHED, or UP_TO_DATE',
  },
);

/**
 * Schema for user-settable watch statuses on shows, movies, and episodes (NOT_WATCHED or WATCHED only)
 */
export const userWatchStatusSchema = z.enum([WatchStatus.NOT_WATCHED, WatchStatus.WATCHED], {
  message: 'Status must be either NOT_WATCHED or WATCHED',
});

/**
 * Schema for user-settable watch statuses on seasons, which additionally supports SKIPPED
 */
export const userSeasonWatchStatusSchema = z.enum([WatchStatus.NOT_WATCHED, WatchStatus.WATCHED, WatchStatus.SKIPPED], {
  message: 'Status must be one of: NOT_WATCHED, WATCHED, or SKIPPED',
});
