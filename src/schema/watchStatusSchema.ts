import { WatchStatus } from '@ajgifford/keepwatching-types';
import z from 'zod';

export const watchStatusSchema = z.enum(
  [WatchStatus.NOT_WATCHED, WatchStatus.WATCHING, WatchStatus.WATCHED, WatchStatus.UP_TO_DATE],
  {
    errorMap: () => ({
      message: 'Status must be one of: NOT_WATCHED, WATCHING, WATCHED, or UP_TO_DATE',
    }),
  },
);

/**
 * Schema specifically for Shows and Seasons which can have all statuses
 */
export const fullWatchStatusSchema = watchStatusSchema;

/**
 * Schema specifically for Movies and Episodes which can only be NOT_WATCHED or WATCHED
 */
export const binaryWatchStatusSchema = z.enum([WatchStatus.NOT_WATCHED, WatchStatus.WATCHED], {
  errorMap: () => ({
    message: 'Status must be either NOT_WATCHED or WATCHED',
  }),
});
