import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const notificationActionParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  notificationId: createPositiveIntegerSchema('Notification ID'),
});

export const dismissedQuerySchema = z.object({
  includeDismissed: z.coerce.boolean().optional(),
});

const booleanFromString = z.union([
  z.boolean(),
  z.string().transform((val) => {
    const lower = val.toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lower)) return true;
    if (['false', '0', 'no', 'off', ''].includes(lower)) return false;
    throw new Error(`Invalid boolean value: ${val}`);
  }),
]);

export const readStatusQuerySchema = z.object({
  hasBeenRead: booleanFromString.optional().default(true),
  includeDismissed: booleanFromString.optional(),
});

export type DismissedQuery = z.infer<typeof dismissedQuerySchema>;
export type NotificationActionParams = z.infer<typeof notificationActionParamSchema>;
export type ReadStatusQuery = z.infer<typeof readStatusQuerySchema>;
