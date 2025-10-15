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

export const getAllNotificationsQuerySchema = z.object({
  expired: booleanFromString.default(false),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sendToAll: booleanFromString.optional(),
  sortBy: z.enum(['startDate', 'endDate', 'type', 'sendToAll']).optional().default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Admin notification schemas
const baseNotificationBodySchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long'),
  message: z.string().min(5, 'Message must be at least 5 characters long'),
  type: z.enum(['tv', 'movie', 'issue', 'general', 'feature'], {
    errorMap: () => ({ message: 'Type must be one of: tv, movie, issue, general, feature' }),
  }),
  startDate: z.string().datetime({ message: 'Start date must be ISO format' }),
  endDate: z.string().datetime({ message: 'End date must be ISO format' }),
  sendToAll: z.boolean(),
  accountId: z.nullable(z.number()),
});

const commonValidation = (
  data: z.infer<typeof baseNotificationBodySchema>,
  ctx: z.RefinementCtx,
  requireFutureStartDate: boolean = true,
) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const now = new Date();

  if (requireFutureStartDate && startDate <= now) {
    ctx.addIssue({
      path: ['startDate'],
      code: z.ZodIssueCode.custom,
      message: 'Start date must be in the future',
    });
  }

  if (endDate <= startDate) {
    ctx.addIssue({
      path: ['endDate'],
      code: z.ZodIssueCode.custom,
      message: 'End date must be after start date',
    });
  }

  if (data.sendToAll && data.accountId !== null) {
    ctx.addIssue({
      path: ['accountId'],
      code: z.ZodIssueCode.custom,
      message: 'Account ID must be null if sendToAll is true',
    });
  }

  if (!data.sendToAll && (data.accountId === null || typeof data.accountId !== 'number')) {
    ctx.addIssue({
      path: ['accountId'],
      code: z.ZodIssueCode.custom,
      message: 'Account ID must be a number if sendToAll is false',
    });
  }
};

export const notificationBodySchema = baseNotificationBodySchema.superRefine((data, ctx) => {
  commonValidation(data, ctx, true);
});

export const updateNotificationBodySchema = baseNotificationBodySchema.superRefine((data, ctx) => {
  commonValidation(data, ctx, false);
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().regex(/^\d+$/, 'Notification ID must be numeric').transform(Number),
});

export type DismissedQuery = z.infer<typeof dismissedQuerySchema>;
export type NotificationActionParams = z.infer<typeof notificationActionParamSchema>;
export type ReadStatusQuery = z.infer<typeof readStatusQuerySchema>;
export type GetAllNotificationsQuery = z.infer<typeof getAllNotificationsQuerySchema>;
export type NotificationBody = z.infer<typeof notificationBodySchema>;
export type UpdateNotificationBody = z.infer<typeof updateNotificationBodySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
