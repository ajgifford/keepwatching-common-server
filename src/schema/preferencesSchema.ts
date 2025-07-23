import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

const preferenceTypeSchema = z.enum(['email', 'notification', 'display', 'privacy']);

export const emailPreferencesSchema = z.object({
  weeklyDigest: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

export const notificationPreferencesSchema = z.object({
  newSeasonAlerts: z.boolean().optional(),
  newEpisodeAlerts: z.boolean().optional(),
});

export const displayPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
});

export const privacyPreferencesSchema = z.object({
  allowRecommendations: z.boolean().optional(),
  dataCollection: z.boolean().optional(),
});

const accountIdParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
});

const preferenceTypeParamSchema = z.object({
  preferenceType: preferenceTypeSchema,
});

export const preferenceRouteParamsSchema = accountIdParamSchema.merge(preferenceTypeParamSchema);

export const getPreferenceBodySchema = (preferenceType: string) => {
  switch (preferenceType) {
    case 'email':
      return emailPreferencesSchema.partial();
    case 'notification':
      return notificationPreferencesSchema.partial();
    case 'display':
      return displayPreferencesSchema.partial();
    case 'privacy':
      return privacyPreferencesSchema.partial();
    default:
      return z.object({}).passthrough();
  }
};

export const multiplePreferencesUpdateSchema = z
  .object({
    email: emailPreferencesSchema.partial().optional(),
    notification: notificationPreferencesSchema.partial().optional(),
    display: displayPreferencesSchema.partial().optional(),
    privacy: privacyPreferencesSchema.partial().optional(),
  })
  .refine((data) => Object.values(data).some((pref) => pref !== undefined), {
    message: 'At least one preference type must be provided',
  });

export type PreferenceRouteParams = z.infer<typeof preferenceRouteParamsSchema>;
export type PreferenceType = z.infer<typeof preferenceTypeSchema>;
export type EmailPreferences = z.infer<typeof emailPreferencesSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;
export type PrivacyPreferences = z.infer<typeof privacyPreferencesSchema>;
export type MultiplePreferencesUpdate = z.infer<typeof multiplePreferencesUpdateSchema>;
