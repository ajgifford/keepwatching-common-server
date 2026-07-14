import { getClientAppUrl } from '../config/config';
import * as profileTransferDb from '../db/profileTransferDb';
import { appLogger, cliLogger } from '../logger/logger';
import { BadRequestError, ConflictError, ForbiddenError, GoneError } from '../middleware/errorMiddleware';
import { accountService } from './accountService';
import { emailService } from './emailService';
import { errorService } from './errorService';
import { preferencesService } from './preferencesService';
import { profileService } from './profileService';
import { socketService } from './socketService';
import {
  Account,
  CreateProfileTransferInvitationRequest,
  ProfileTransferInvitation,
  ProfileTransferInvitationPreview,
} from '@ajgifford/keepwatching-types';
import crypto from 'crypto';

const INVITATION_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Service class for handling profile transfer invitation business logic
 */
export class ProfileTransferService {
  /**
   * Invites a profile to be transferred out of its current account into a brand-new,
   * independent account. No data moves until the invitation is claimed.
   *
   * @param sourceAccountId - ID of the account the profile currently belongs to
   * @param profileId - ID of the profile being transferred
   * @param request - Target email/name, and (when the profile is the account's current default) a replacement default
   * @returns The newly created invitation
   * @throws {NotFoundError} If the account or profile doesn't exist
   * @throws {BadRequestError} If the account has only one profile, or a default-profile replacement is required but missing/invalid
   * @throws {ConflictError} If the target email is already registered, or a pending invitation already exists for this profile
   */
  public async createInvitation(
    sourceAccountId: number,
    profileId: number,
    request: CreateProfileTransferInvitationRequest,
  ): Promise<ProfileTransferInvitation> {
    try {
      const account = await accountService.findAccountById(sourceAccountId);
      errorService.assertExists(account, 'Account', sourceAccountId);

      const profiles = await profileService.getProfilesByAccountId(sourceAccountId);
      const profile = profiles.find((p) => p.id === profileId);
      errorService.assertExists(profile, 'Profile', profileId);

      if (profiles.length <= 1) {
        throw new BadRequestError('The account must have at least one other profile to transfer this profile');
      }

      const isCurrentDefault = account.defaultProfileId === profileId;
      let newDefaultProfileId: number | null = null;
      if (isCurrentDefault) {
        const replacement = profiles.find((p) => p.id === request.newDefaultProfileId && p.id !== profileId);
        if (!replacement) {
          throw new BadRequestError(
            'This profile is the account default; choose another profile on the account to become the new default',
          );
        }
        newDefaultProfileId = replacement.id;
      }

      const existingPending = await profileTransferDb.findPendingInvitationByProfileId(profileId);
      if (existingPending) {
        throw new ConflictError('A pending transfer invitation already exists for this profile');
      }

      const existingAccount = await accountService.findAccountByEmail(request.targetEmail);
      errorService.assertNotExists(existingAccount, 'Account', 'email', request.targetEmail);

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invitationId = await profileTransferDb.createInvitation({
        profileId,
        sourceAccountId,
        targetEmail: request.targetEmail,
        targetName: request.targetName ?? null,
        newDefaultProfileId,
        tokenHash: hashToken(token),
        expiresAt,
      });

      const claimUrl = `${getClientAppUrl()}/claim/${token}`;

      try {
        await emailService.sendProfileTransferInvitation({
          to: request.targetEmail,
          profileName: profile.name,
          sourceAccountName: account.name,
          claimUrl,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (emailError) {
        await profileTransferDb.deleteInvitation(invitationId);
        appLogger.error('Failed to send profile transfer invitation email', {
          error: emailError,
          targetEmail: request.targetEmail,
        });
        throw new BadRequestError('Failed to send the invitation email; please try again');
      }

      cliLogger.info(`Profile transfer invitation sent: profile ${profileId} to ${request.targetEmail}`);
      appLogger.info('Profile transfer invitation created', {
        profileId,
        sourceAccountId,
        targetEmail: request.targetEmail,
      });

      const invitation = await profileTransferDb.findInvitationById(invitationId);
      errorService.assertExists(invitation, 'ProfileTransferInvitation', invitationId);

      return invitation;
    } catch (error) {
      throw errorService.handleError(error, `createInvitation(${sourceAccountId}, ${profileId})`);
    }
  }

  /**
   * Lists all transfer invitations created by an account, most recent first.
   */
  public async listInvitationsByAccount(accountId: number): Promise<ProfileTransferInvitation[]> {
    try {
      return await profileTransferDb.listInvitationsByAccountId(accountId);
    } catch (error) {
      throw errorService.handleError(error, `listInvitationsByAccount(${accountId})`);
    }
  }

  /**
   * Lists transfer invitations across all accounts, optionally filtered by status.
   * Used by admin tooling.
   */
  public async listAllInvitations(status?: string): Promise<ProfileTransferInvitation[]> {
    try {
      return await profileTransferDb.listInvitationsByStatus(status);
    } catch (error) {
      throw errorService.handleError(error, `listAllInvitations(${status})`);
    }
  }

  /**
   * Cancels a pending invitation. Callable by the source account owner or admin tooling.
   *
   * @throws {NotFoundError} If the invitation doesn't exist
   * @throws {ForbiddenError} If `accountId` is provided and doesn't own the invitation
   * @throws {BadRequestError} If the invitation is not pending
   */
  public async cancelInvitation(invitationId: number, accountId?: number): Promise<void> {
    try {
      const invitation = await profileTransferDb.findInvitationById(invitationId);
      errorService.assertExists(invitation, 'ProfileTransferInvitation', invitationId);

      if (accountId !== undefined && invitation.sourceAccountId !== accountId) {
        throw new ForbiddenError('This invitation does not belong to the specified account');
      }

      if (invitation.status !== 'pending') {
        throw new BadRequestError('Only pending invitations can be canceled');
      }

      const canceled = await profileTransferDb.cancelInvitation(invitationId, invitation.sourceAccountId);
      if (!canceled) {
        throw new BadRequestError('Failed to cancel the invitation');
      }

      cliLogger.info(`Profile transfer invitation canceled: ${invitationId}`);
    } catch (error) {
      throw errorService.handleError(error, `cancelInvitation(${invitationId})`);
    }
  }

  /**
   * Public, pre-authentication preview of a pending invitation for the claim page.
   *
   * @throws {NotFoundError} If the token doesn't match any invitation
   * @throws {GoneError} If the invitation has been claimed, canceled, or has expired
   */
  public async getInvitationPreview(token: string): Promise<ProfileTransferInvitationPreview> {
    try {
      const invitation = await profileTransferDb.findInvitationByTokenHash(hashToken(token));
      errorService.assertExists(invitation, 'ProfileTransferInvitation', token);

      this.assertClaimable(invitation);

      return {
        profileName: invitation.profileName,
        sourceAccountName: invitation.sourceAccountName,
        targetEmail: invitation.targetEmail,
        targetName: invitation.targetName,
        expiresAt: invitation.expiresAt,
      };
    } catch (error) {
      throw errorService.handleError(error, 'getInvitationPreview');
    }
  }

  /**
   * Claims a pending invitation, creating the new account and re-parenting the profile
   * (and everything keyed to it) in a single transaction.
   *
   * @param token - Raw claim token from the invitation link
   * @param uid - Firebase UID of the newly authenticated user
   * @param email - Verified email of the newly authenticated user
   * @param name - Optional display name for the new account
   * @throws {NotFoundError} If the token doesn't match any invitation
   * @throws {GoneError} If the invitation has been claimed, canceled, or has expired
   * @throws {ForbiddenError} If the authenticated email doesn't match the invited email
   * @throws {ConflictError} If an account already exists for this email
   */
  public async claimInvitation(token: string, uid: string, email: string, name?: string): Promise<Account> {
    try {
      const invitation = await profileTransferDb.findInvitationByTokenHash(hashToken(token));
      errorService.assertExists(invitation, 'ProfileTransferInvitation', token);

      this.assertClaimable(invitation);

      if (invitation.targetEmail.toLowerCase() !== email.toLowerCase()) {
        throw new ForbiddenError('Sign in with the email address the invitation was sent to');
      }

      const existingAccount = await accountService.findAccountByEmail(email);
      errorService.assertNotExists(existingAccount, 'Account', 'email', email);

      const resolvedName = name || invitation.targetName || invitation.profileName;

      const { account } = await profileTransferDb.claimInvitation(invitation.id, resolvedName, email, uid);

      await preferencesService.initializeDefaultPreferences(account.id);

      // Send welcome email asynchronously (don't await to avoid blocking the claim), matching
      // the register()/googleLogin() account-creation flows this effectively parallels.
      emailService.sendWelcomeEmail(email).catch((error) => {
        appLogger.error(`Failed to send welcome email to ${email}`, { error });
      });

      // Best-effort: let any of the source account's open sessions drop this profile from
      // local state immediately instead of showing it as still theirs until next login.
      socketService.notifyProfileTransferred(
        invitation.sourceAccountId,
        invitation.profileId,
        invitation.newDefaultProfileId ?? undefined,
      );

      cliLogger.info(`Profile transfer invitation claimed: profile ${invitation.profileId} -> account ${account.id}`);
      appLogger.info('Profile transfer invitation claimed', {
        invitationId: invitation.id,
        profileId: invitation.profileId,
        newAccountId: account.id,
      });

      return account;
    } catch (error) {
      throw errorService.handleError(error, 'claimInvitation');
    }
  }

  private assertClaimable(invitation: ProfileTransferInvitation): void {
    if (invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date()) {
      return;
    }

    if (invitation.status === 'pending') {
      throw new GoneError('This invitation has expired');
    }

    throw new GoneError(`This invitation has already been ${invitation.status}`);
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createProfileTransferService(): ProfileTransferService {
  return new ProfileTransferService();
}

/**
 * Singleton instance for production use
 */
let instance: ProfileTransferService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getProfileTransferService(): ProfileTransferService {
  if (!instance) {
    instance = createProfileTransferService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetProfileTransferService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { profileTransferService }` continues to work
 */
export const profileTransferService = getProfileTransferService();
