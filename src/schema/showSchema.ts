import { createPositiveIntegerSchema } from './schemaUtil';
import { userWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const addShowFavoriteBodySchema = z.object({
  showTMDBId: z.number().int().positive('Show TMDB ID must be a positive integer'),
});

export const showParamsSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  showId: createPositiveIntegerSchema('Show ID'),
});

export const showWatchStatusBodySchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  status: userWatchStatusSchema,
});

export const showPriorWatchBodySchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  upToSeasonNumber: z.number().int().positive('Season number must be a positive integer').optional(),
});

export const watchHistoryMarkAsPriorBodySchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  seasonIds: z.array(z.number().int().positive()).optional(),
});

export const watchHistoryDismissBodySchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
});

export const watchHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  contentType: z.enum(['episode', 'movie', 'all']).optional().default('all'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  isPriorWatchOnly: z.coerce.boolean().optional().default(false),
  excludePriorWatch: z.coerce.boolean().optional().default(false),
  searchQuery: z.string().max(200).optional(),
});

export type ShowWatchStatusBody = z.infer<typeof showWatchStatusBodySchema>;
export type AddShowFavoriteBody = z.infer<typeof addShowFavoriteBodySchema>;
export type ShowParams = z.infer<typeof showParamsSchema>;
export type ShowPriorWatchBody = z.infer<typeof showPriorWatchBodySchema>;
export type WatchHistoryMarkAsPriorBody = z.infer<typeof watchHistoryMarkAsPriorBodySchema>;
export type WatchHistoryDismissBody = z.infer<typeof watchHistoryDismissBodySchema>;
export type WatchHistoryQuery = z.infer<typeof watchHistoryQuerySchema>;
