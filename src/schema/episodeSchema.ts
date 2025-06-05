import { binaryWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const episodeWatchStatusBodySchema = z.object({
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: binaryWatchStatusSchema,
});

export const nextEpisodeWatchStatusBodySchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  seasonId: z.number().int().positive('Season ID must be a positive integer'),
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: binaryWatchStatusSchema,
});

export type EpisodeWatchStatusBody = z.infer<typeof episodeWatchStatusBodySchema>;
export type NextEpisodeWatchStatusBody = z.infer<typeof nextEpisodeWatchStatusBodySchema>;
