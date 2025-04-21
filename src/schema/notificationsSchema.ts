import { z } from 'zod';

export const dismissParamSchema = z.object({
  accountId: z.string().regex(/^\d+$/, 'Account ID must be numeric'),
  notificationId: z.string().regex(/^\d+$/, 'Notification ID must be numeric'),
});

export type DismissParams = z.infer<typeof dismissParamSchema>;
