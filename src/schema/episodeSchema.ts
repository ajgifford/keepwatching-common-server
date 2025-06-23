import { userWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const episodeWatchStatusBodySchema = z.object({
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: userWatchStatusSchema,
});

export type EpisodeWatchStatusBody = z.infer<typeof episodeWatchStatusBodySchema>;
