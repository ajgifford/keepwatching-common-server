import { z } from 'zod';

export const seasonWatchStatusSchema = z.object({
  seasonId: z.number().int().positive('Season ID must be a positive integer'),
  status: z.enum(['NOT_WATCHED', 'WATCHING', 'WATCHED', 'UP_TO_DATE'], {
    errorMap: () => ({ message: 'Status must be one of: NOT_WATCHED, WATCHING, WATCHED, or UP_TO_DATE' }),
  }),
  recursive: z.boolean().default(false).optional(),
});

export type SeasonWatchStatusParams = z.infer<typeof seasonWatchStatusSchema>;
