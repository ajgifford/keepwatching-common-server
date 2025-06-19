import { createPositiveIntegerSchema } from './schemaUtil';
import { simpleWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const addMovieFavoriteBodySchema = z.object({
  movieTMDBId: z.number().int().positive('Movie TMDB ID must be a positive integer'),
});

export const removeMovieFavoriteParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  movieId: createPositiveIntegerSchema('Movie ID'),
});

export const movieParamsSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  movieId: createPositiveIntegerSchema('Movie ID'),
});

export const movieWatchStatusBodySchema = z.object({
  movieId: z.number().int().positive('Movie ID must be a positive integer'),
  status: simpleWatchStatusSchema,
});

export type MovieWatchStatusBody = z.infer<typeof movieWatchStatusBodySchema>;
export type AddMovieFavoriteBody = z.infer<typeof addMovieFavoriteBodySchema>;
export type RemoveMovieFavoriteParams = z.infer<typeof removeMovieFavoriteParamSchema>;
export type MovieParams = z.infer<typeof movieParamsSchema>;
