import { z } from 'zod';

export const addMovieFavoriteSchema = z.object({
  movieId: z.number().int().positive('Movie ID must be a positive integer'),
});

export const removeMovieFavoriteParamSchema = z.object({
  accountId: z.string().regex(/^\d+$/, 'Account ID must be a number'),
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number'),
  movieId: z.string().regex(/^\d+$/, 'Movie ID must be a number'),
});

export const movieWatchStatusSchema = z.object({
  movieId: z.number().int().positive('Movie ID must be a positive integer'),
  status: z.enum(['WATCHED', 'WATCHING', 'NOT_WATCHED'], {
    errorMap: () => ({ message: 'Status must be one of: WATCHED, WATCHING, or NOT_WATCHED' }),
  }),
});

export type MovieWatchStatusParams = z.infer<typeof movieWatchStatusSchema>;
export type AddMovieFavoriteParams = z.infer<typeof addMovieFavoriteSchema>;
export type RemoveMovieFavoriteParams = z.infer<typeof removeMovieFavoriteParamSchema>;
