import { createPositiveIntegerSchema } from './schemaUtil';
import { userWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const episodeWatchStatusBodySchema = z.object({
  episodeId: z.number().int().positive('Episode ID must be a positive integer'),
  status: userWatchStatusSchema,
});

export const profileEpisodeIdsParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  episodeId: createPositiveIntegerSchema('Episode ID'),
});

export type EpisodeWatchStatusBody = z.infer<typeof episodeWatchStatusBodySchema>;
export type ProfileEpisodeIdsParams = z.infer<typeof profileEpisodeIdsParamSchema>;
