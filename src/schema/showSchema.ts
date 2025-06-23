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

export type ShowWatchStatusBody = z.infer<typeof showWatchStatusBodySchema>;
export type AddShowFavoriteBody = z.infer<typeof addShowFavoriteBodySchema>;
export type ShowParams = z.infer<typeof showParamsSchema>;
