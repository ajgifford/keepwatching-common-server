import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const createProfileTransferInvitationBodySchema = z.object({
  targetEmail: z.string().email('Invalid email format'),
  targetName: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(50, 'Name must be less than 50 characters')
    .trim()
    .optional(),
  newDefaultProfileId: z.number().int().positive('New default profile ID must be a positive integer').optional(),
});

export const accountAndInvitationIdsParamSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  invitationId: createPositiveIntegerSchema('Invitation ID'),
});

export const invitationIdParamSchema = z.object({
  invitationId: createPositiveIntegerSchema('Invitation ID'),
});

export const claimTokenParamSchema = z.object({
  token: z.string().min(1, 'Token cannot be empty'),
});

export const claimProfileTransferBodySchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(50, 'Name must be less than 50 characters').trim().optional(),
});

export const profileTransferStatusQuerySchema = z.object({
  status: z.enum(['pending', 'claimed', 'canceled', 'expired']).optional(),
});

export type CreateProfileTransferInvitationBody = z.infer<typeof createProfileTransferInvitationBodySchema>;
export type AccountAndInvitationIdsParams = z.infer<typeof accountAndInvitationIdsParamSchema>;
export type InvitationIdParam = z.infer<typeof invitationIdParamSchema>;
export type ClaimTokenParam = z.infer<typeof claimTokenParamSchema>;
export type ClaimProfileTransferBody = z.infer<typeof claimProfileTransferBodySchema>;
export type ProfileTransferStatusQuery = z.infer<typeof profileTransferStatusQuerySchema>;
