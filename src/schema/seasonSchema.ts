import { z } from 'zod';

export const seasonWatchStatusSchema = z.object({
  seasonId: z.number().int().positive('Season ID must be a positive integer'),
  status: z.enum(['WATCHED', 'WATCHING', 'NOT_WATCHED'], {
    errorMap: () => ({ message: 'Status must be one of: WATCHED, WATCHING, or NOT_WATCHED' }),
  }),
  recursive: z.boolean().default(false).optional(),
});

export type SeasonWatchStatusParams = z.infer<typeof seasonWatchStatusSchema>;
