import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const notificationActionParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  notificationId: createPositiveIntegerSchema('Notification ID'),
});

export const dismissedQuerySchema = z.object({
  includeDismissed: z.coerce.boolean().optional(),
});

export type DismissedQuery = z.infer<typeof dismissedQuerySchema>;
export type NotificationActionParams = z.infer<typeof notificationActionParamSchema>;
