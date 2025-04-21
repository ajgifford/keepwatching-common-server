import { z } from 'zod';

export const episodeWatchStatusSchema = z.object({
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: z.enum(['WATCHED', 'WATCHING', 'NOT_WATCHED'], {
    errorMap: () => ({ message: 'Status must be one of: WATCHED, WATCHING, or NOT_WATCHED' }),
  }),
});

export const nextEpisodeWatchStatusSchema = z.object({
  showId: z.number().int().positive('Show ID must be a positive integer'),
  seasonId: z.number().int().positive('Season ID must be a positive integer'),
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: z.enum(['WATCHED', 'WATCHING', 'NOT_WATCHED'], {
    errorMap: () => ({ message: 'Status must be one of: WATCHED, WATCHING, or NOT_WATCHED' }),
  }),
});

export type EpisodeWatchStatusParams = z.infer<typeof episodeWatchStatusSchema>;
export type NextEpisodeWatchStatusParams = z.infer<typeof nextEpisodeWatchStatusSchema>;
