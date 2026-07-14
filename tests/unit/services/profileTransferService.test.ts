import { ProfileTransferInvitation } from '@ajgifford/keepwatching-types';
import * as profileTransferDb from '@db/profileTransferDb';
import { cliLogger } from '@logger/logger';
import { BadRequestError, ConflictError, ForbiddenError, GoneError } from '@middleware/errorMiddleware';
import { accountService } from '@services/accountService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { preferencesService } from '@services/preferencesService';
import { profileService } from '@services/profileService';
import { createProfileTransferService } from '@services/profileTransferService';
import { socketService } from '@services/socketService';

jest.mock('@logger/logger', () => ({
  cliLogger: { info: jest.fn(), error: jest.fn() },
  appLogger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('@db/profileTransferDb');
jest.mock('@services/accountService');
jest.mock('@services/profileService');
jest.mock('@services/emailService');
jest.mock('@services/preferencesService');
jest.mock('@services/errorService');
jest.mock('@services/socketService', () => ({
  socketService: { notifyProfileTransferred: jest.fn() },
}));

describe('ProfileTransferService', () => {
  let profileTransferService: ReturnType<typeof createProfileTransferService>;

  const account = {
    id: 5,
    name: 'The Smith Family',
    email: 'parent@example.com',
    uid: 'parent-uid',
    image: '',
    defaultProfileId: 100,
  };

  const profiles = [
    { id: 10, accountId: 5, name: "Jamie's Profile", image: undefined },
    { id: 11, accountId: 5, name: 'Other Profile', image: undefined },
  ];

  const invitation: ProfileTransferInvitation = {
    id: 1,
    profileId: 10,
    profileName: "Jamie's Profile",
    sourceAccountId: 5,
    sourceAccountName: 'The Smith Family',
    targetEmail: 'jamie@example.com',
    targetName: 'Jamie',
    newDefaultProfileId: null,
    status: 'pending',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    claimedAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    profileTransferService = createProfileTransferService();

    (errorService.assertExists as jest.Mock).mockImplementation((entity) => {
      if (!entity) throw new Error('Entity not found');
      return true;
    });
    (errorService.assertNotExists as jest.Mock).mockImplementation((entity, entityName, field, value) => {
      if (entity) throw new Error(`${entityName} with ${field} ${value} already exists`);
      return true;
    });
    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    (accountService.findAccountById as jest.Mock).mockResolvedValue(account);
    (accountService.findAccountByEmail as jest.Mock).mockResolvedValue(null);
    (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
    (profileTransferDb.findPendingInvitationByProfileId as jest.Mock).mockResolvedValue(null);
    (profileTransferDb.createInvitation as jest.Mock).mockResolvedValue(1);
    (profileTransferDb.findInvitationById as jest.Mock).mockResolvedValue(invitation);
    (profileTransferDb.findInvitationByTokenHash as jest.Mock).mockResolvedValue(invitation);
    (emailService.sendProfileTransferInvitation as jest.Mock).mockResolvedValue(undefined);
    (emailService.sendWelcomeEmail as jest.Mock).mockResolvedValue(undefined);
    (preferencesService.initializeDefaultPreferences as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createInvitation()', () => {
    it('creates an invitation for a non-default profile', async () => {
      const result = await profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' });

      expect(profileTransferDb.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 10,
          sourceAccountId: 5,
          targetEmail: 'jamie@example.com',
          newDefaultProfileId: null,
        }),
      );
      expect(emailService.sendProfileTransferInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jamie@example.com',
          profileName: "Jamie's Profile",
          sourceAccountName: 'The Smith Family',
          claimUrl: expect.stringContaining('/claim/'),
        }),
      );
      expect(result).toEqual(invitation);
    });

    it('requires and applies a replacement default profile when transferring the account default', async () => {
      (accountService.findAccountById as jest.Mock).mockResolvedValue({ ...account, defaultProfileId: 10 });

      await profileTransferService.createInvitation(5, 10, {
        targetEmail: 'jamie@example.com',
        newDefaultProfileId: 11,
      });

      expect(profileTransferDb.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ newDefaultProfileId: 11 }),
      );
    });

    it('throws BadRequestError when transferring the default profile without a replacement', async () => {
      (accountService.findAccountById as jest.Mock).mockResolvedValue({ ...account, defaultProfileId: 10 });

      await expect(
        profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' }),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when the account only has one profile', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([profiles[0]]);

      await expect(
        profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' }),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws ConflictError when a pending invitation already exists for the profile', async () => {
      (profileTransferDb.findPendingInvitationByProfileId as jest.Mock).mockResolvedValue(invitation);

      await expect(
        profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' }),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when the target email is already registered', async () => {
      (accountService.findAccountByEmail as jest.Mock).mockResolvedValue({ id: 99, email: 'jamie@example.com' });
      (errorService.assertNotExists as jest.Mock).mockImplementation(() => {
        throw new ConflictError('Account with email jamie@example.com already exists');
      });

      await expect(
        profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' }),
      ).rejects.toThrow(ConflictError);
    });

    it('rolls back the invitation and throws BadRequestError when the email fails to send', async () => {
      (emailService.sendProfileTransferInvitation as jest.Mock).mockRejectedValue(new Error('smtp down'));

      await expect(
        profileTransferService.createInvitation(5, 10, { targetEmail: 'jamie@example.com' }),
      ).rejects.toThrow(BadRequestError);

      expect(profileTransferDb.deleteInvitation).toHaveBeenCalledWith(1);
    });
  });

  describe('listInvitationsByAccount()', () => {
    it('delegates to the db layer', async () => {
      (profileTransferDb.listInvitationsByAccountId as jest.Mock).mockResolvedValue([invitation]);

      const result = await profileTransferService.listInvitationsByAccount(5);

      expect(profileTransferDb.listInvitationsByAccountId).toHaveBeenCalledWith(5);
      expect(result).toEqual([invitation]);
    });
  });

  describe('cancelInvitation()', () => {
    beforeEach(() => {
      (profileTransferDb.findInvitationById as jest.Mock).mockResolvedValue(invitation);
      (profileTransferDb.cancelInvitation as jest.Mock).mockResolvedValue(true);
    });

    it('cancels a pending invitation owned by the given account', async () => {
      await profileTransferService.cancelInvitation(1, 5);

      expect(profileTransferDb.cancelInvitation).toHaveBeenCalledWith(1, 5);
      expect(cliLogger.info).toHaveBeenCalled();
    });

    it('throws ForbiddenError when the invitation belongs to a different account', async () => {
      await expect(profileTransferService.cancelInvitation(1, 999)).rejects.toThrow(ForbiddenError);
    });

    it('throws BadRequestError when the invitation is not pending', async () => {
      (profileTransferDb.findInvitationById as jest.Mock).mockResolvedValue({ ...invitation, status: 'claimed' });

      await expect(profileTransferService.cancelInvitation(1, 5)).rejects.toThrow(BadRequestError);
    });

    it('allows admin-style cancellation without an account scope', async () => {
      await profileTransferService.cancelInvitation(1);

      expect(profileTransferDb.cancelInvitation).toHaveBeenCalledWith(1, 5);
    });
  });

  describe('getInvitationPreview()', () => {
    it('returns a preview for a pending invitation', async () => {
      const preview = await profileTransferService.getInvitationPreview('raw-token');

      expect(preview).toEqual({
        profileName: "Jamie's Profile",
        sourceAccountName: 'The Smith Family',
        targetEmail: 'jamie@example.com',
        targetName: 'Jamie',
        expiresAt: invitation.expiresAt,
      });
    });

    it('throws GoneError when the invitation has expired', async () => {
      (profileTransferDb.findInvitationByTokenHash as jest.Mock).mockResolvedValue({
        ...invitation,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      await expect(profileTransferService.getInvitationPreview('raw-token')).rejects.toThrow(GoneError);
    });

    it('throws GoneError when the invitation was already claimed', async () => {
      (profileTransferDb.findInvitationByTokenHash as jest.Mock).mockResolvedValue({
        ...invitation,
        status: 'claimed',
      });

      await expect(profileTransferService.getInvitationPreview('raw-token')).rejects.toThrow(GoneError);
    });
  });

  describe('claimInvitation()', () => {
    const claimedAccount = {
      id: 99,
      name: 'Jamie',
      email: 'jamie@example.com',
      uid: 'jamie-uid',
      image: '',
      defaultProfileId: 10,
    };

    beforeEach(() => {
      (profileTransferDb.claimInvitation as jest.Mock).mockResolvedValue({
        account: claimedAccount,
        invitation: { ...invitation, status: 'claimed' },
      });
    });

    it('claims the invitation and initializes preferences for the new account', async () => {
      const result = await profileTransferService.claimInvitation(
        'raw-token',
        'jamie-uid',
        'jamie@example.com',
        'Jamie',
      );

      expect(profileTransferDb.claimInvitation).toHaveBeenCalledWith(1, 'Jamie', 'jamie@example.com', 'jamie-uid');
      expect(preferencesService.initializeDefaultPreferences).toHaveBeenCalledWith(99);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('jamie@example.com');
      expect(socketService.notifyProfileTransferred).toHaveBeenCalledWith(5, 10, undefined);
      expect(result).toEqual(claimedAccount);
    });

    it('includes the replacement default profile id when notifying the source account', async () => {
      (profileTransferDb.findInvitationByTokenHash as jest.Mock).mockResolvedValue({
        ...invitation,
        newDefaultProfileId: 11,
      });

      await profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'jamie@example.com', 'Jamie');

      expect(socketService.notifyProfileTransferred).toHaveBeenCalledWith(5, 10, 11);
    });

    it('falls back to the invitation target name when no name is provided', async () => {
      await profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'jamie@example.com');

      expect(profileTransferDb.claimInvitation).toHaveBeenCalledWith(1, 'Jamie', 'jamie@example.com', 'jamie-uid');
    });

    it('throws ForbiddenError when the authenticated email does not match the invitation', async () => {
      await expect(
        profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'someone-else@example.com'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('is case-insensitive when matching the authenticated email', async () => {
      await profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'JAMIE@EXAMPLE.COM');

      expect(profileTransferDb.claimInvitation).toHaveBeenCalled();
    });

    it('throws GoneError when the invitation is no longer pending', async () => {
      (profileTransferDb.findInvitationByTokenHash as jest.Mock).mockResolvedValue({
        ...invitation,
        status: 'canceled',
      });

      await expect(
        profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'jamie@example.com'),
      ).rejects.toThrow(GoneError);
    });

    it('throws ConflictError when an account already exists for the email', async () => {
      (accountService.findAccountByEmail as jest.Mock).mockResolvedValue({ id: 42, email: 'jamie@example.com' });
      (errorService.assertNotExists as jest.Mock).mockImplementation(() => {
        throw new ConflictError('Account with email jamie@example.com already exists');
      });

      await expect(
        profileTransferService.claimInvitation('raw-token', 'jamie-uid', 'jamie@example.com'),
      ).rejects.toThrow(ConflictError);
    });
  });
});
