import { createPositiveIntegerSchema } from './schemaUtil';
import { userWatchStatusSchema } from './watchStatusSchema';
import { z } from 'zod';

export const seasonWatchStatusBodySchema = z.object({
  seasonId: z.number().int().positive('Season ID must be a positive integer'),
  status: userWatchStatusSchema,
});

export const profileSeasonIdsParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  seasonId: createPositiveIntegerSchema('Season ID'),
});

export type SeasonWatchStatusBody = z.infer<typeof seasonWatchStatusBodySchema>;
export type ProfileSeasonIdsParams = z.infer<typeof profileSeasonIdsParamSchema>;
