import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const dismissParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  notificationId: createPositiveIntegerSchema('Notification ID'),
});

export type DismissParams = z.infer<typeof dismissParamSchema>;
