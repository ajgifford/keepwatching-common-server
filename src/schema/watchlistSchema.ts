import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const watchlistParamsSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
});

export const watchlistItemParamsSchema = watchlistParamsSchema.extend({
  itemId: createPositiveIntegerSchema('Item ID'),
});

export const addWatchlistItemBodySchema = z.object({
  contentType: z.enum(['show', 'movie']),
  contentId: z.number().int().positive('Content ID must be a positive integer'),
});

export const updateWatchlistPrioritiesBodySchema = z.object({
  priorities: z
    .array(
      z.object({
        id: z.number().int().positive(),
        priority: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type WatchlistParams = z.infer<typeof watchlistParamsSchema>;
export type WatchlistItemParams = z.infer<typeof watchlistItemParamsSchema>;
export type AddWatchlistItemBody = z.infer<typeof addWatchlistItemBodySchema>;
export type UpdateWatchlistPrioritiesBody = z.infer<typeof updateWatchlistPrioritiesBodySchema>;
