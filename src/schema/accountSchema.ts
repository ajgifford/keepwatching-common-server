import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const registerAccountBodySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name must be less than 50 characters').trim(),
  email: z.string().email('Invalid email format'),
  uid: z.string().min(1, 'UID cannot be empty'),
});

export const updateAccountBodySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name must be less than 50 characters').trim(),
  defaultProfileId: z.number().int().positive('Default Profile ID must be a positive integer'),
});

export const accountLoginBodySchema = z.object({
  uid: z.string().min(1, 'UID cannot be empty'),
});

export const googleLoginBodySchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  email: z.string().email('Invalid email format'),
  uid: z.string().min(1, 'UID cannot be empty'),
  photoURL: z.string().optional(),
});

export const accountIdParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
});

export const accountIdBodySchema = z.object({
  accountId: z.number().int().positive('Account ID must be a positive integer'),
});

export const accountAndProfileIdsParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
});

export const profileNameBodySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name must be less than 50 characters').trim(),
});

export const accountUIDParamSchema = z.object({
  accountUid: z.string().min(1, 'Account UID cannot be empty'),
});

export type RegisterAccountBody = z.infer<typeof registerAccountBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type AccountLoginBody = z.infer<typeof accountLoginBodySchema>;
export type GoogleLoginBody = z.infer<typeof googleLoginBodySchema>;
export type AccountIdParam = z.infer<typeof accountIdParamSchema>;
export type AccountIdBody = z.infer<typeof accountIdBodySchema>;
export type AccountAndProfileIdsParams = z.infer<typeof accountAndProfileIdsParamSchema>;
export type ProfileNameBody = z.infer<typeof profileNameBodySchema>;
export type AccountUIDParams = z.infer<typeof accountUIDParamSchema>;
