import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const personIdParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  personId: createPositiveIntegerSchema('Person ID'),
});

export type PersonIdParams = z.infer<typeof personIdParamSchema>;
