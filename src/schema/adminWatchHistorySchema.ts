import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const adminWatchHistoryContentTypeSchema = z.enum(['episode', 'movie', 'season', 'show'], {
  message: 'contentType must be one of: episode, movie, season, or show',
});

export const watchHistoryDetailParamsSchema = z.object({
  contentType: adminWatchHistoryContentTypeSchema,
  profileId: createPositiveIntegerSchema('Profile ID'),
  contentId: createPositiveIntegerSchema('Content ID'),
});

export const updateWatchHistoryEntryParamsSchema = z.object({
  contentType: adminWatchHistoryContentTypeSchema,
  historyId: createPositiveIntegerSchema('History ID'),
});

export const updateWatchDateBodySchema = z.object({
  watchedAt: z.string().datetime({ message: 'watchedAt must be an ISO datetime string' }),
});

export type WatchHistoryDetailParams = z.infer<typeof watchHistoryDetailParamsSchema>;
export type UpdateWatchHistoryEntryParams = z.infer<typeof updateWatchHistoryEntryParamsSchema>;
export type UpdateWatchDateBody = z.infer<typeof updateWatchDateBodySchema>;
