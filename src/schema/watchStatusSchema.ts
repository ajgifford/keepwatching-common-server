import { WatchStatus } from '@ajgifford/keepwatching-types';
import z from 'zod';

/**
 * Schema covering all the watch status values
 */
export const watchStatusSchema = z.enum(
  [WatchStatus.UNAIRED, WatchStatus.NOT_WATCHED, WatchStatus.WATCHING, WatchStatus.WATCHED, WatchStatus.UP_TO_DATE],
  {
    errorMap: () => ({
      message: 'Status must be one of: UNAIRED, NOT_WATCHED, WATCHING, WATCHED, or UP_TO_DATE',
    }),
  },
);

/**
 * Schema specifically for user based actions that change the watch statuses of content, which can only be NOT_WATCHED or WATCHED
 */
export const userWatchStatusSchema = z.enum([WatchStatus.NOT_WATCHED, WatchStatus.WATCHED], {
  errorMap: () => ({
    message: 'Status must be either NOT_WATCHED or WATCHED',
  }),
});
