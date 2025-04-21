import { z } from 'zod';

export const addShowFavoriteSchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
});

export const showParamsSchema = z.object({
  accountId: z.string().regex(/^\d+$/, 'Account ID must be a number'),
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number'),
  showId: z.string().regex(/^\d+$/, 'Show ID must be a number'),
});

export const showWatchStatusSchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  status: z.enum(['WATCHED', 'WATCHING', 'NOT_WATCHED'], {
    errorMap: () => ({ message: 'Status must be one of: WATCHED, WATCHING, or NOT_WATCHED' }),
  }),
  recursive: z.boolean().default(false).optional(),
});

export type ShowWatchStatusParams = z.infer<typeof showWatchStatusSchema>;
export type AddShowFavoriteParams = z.infer<typeof addShowFavoriteSchema>;
export type ShowParams = z.infer<typeof showParamsSchema>;
