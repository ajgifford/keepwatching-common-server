import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as profileTransferDb from '@db/profileTransferDb';
import { BadRequestError, DatabaseError, GoneError, NotFoundError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader } from 'mysql2';

describe('profileTransferDb Module', () => {
  let mockExecute: jest.Mock;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;

  const invitationRow = {
    invitation_id: 1,
    profile_id: 10,
    profile_name: "Jamie's Profile",
    source_account_id: 5,
    source_account_name: 'The Smith Family',
    target_email: 'jamie@example.com',
    target_name: 'Jamie',
    new_default_profile_id: null,
    status: 'pending',
    expires_at: new Date('2026-07-19T00:00:00.000Z'),
    claimed_at: null,
    created_at: new Date('2026-07-12T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockTransactionHelper = mocks.mockTransactionHelper;
  });

  describe('createInvitation()', () => {
    it('should insert an invitation and return its id', async () => {
      const insertResult: [ResultSetHeader, any] = [{ insertId: 1, affectedRows: 1 } as ResultSetHeader, undefined];
      mockExecute.mockResolvedValueOnce(insertResult);

      const id = await profileTransferDb.createInvitation({
        profileId: 10,
        sourceAccountId: 5,
        targetEmail: 'jamie@example.com',
        targetName: 'Jamie',
        newDefaultProfileId: null,
        tokenHash: 'hashed-token',
        expiresAt: new Date('2026-07-19T00:00:00.000Z'),
      });

      expect(id).toBe(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO profile_transfer_invitations'), [
        10,
        5,
        'jamie@example.com',
        'Jamie',
        null,
        'hashed-token',
        new Date('2026-07-19T00:00:00.000Z'),
      ]);
    });

    it('should throw DatabaseError when the insert fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('insert failed'));

      await expect(
        profileTransferDb.createInvitation({
          profileId: 10,
          sourceAccountId: 5,
          targetEmail: 'jamie@example.com',
          targetName: null,
          newDefaultProfileId: null,
          tokenHash: 'hashed-token',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('findInvitationById()', () => {
    it('should return a transformed invitation', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow]]);

      const invitation = await profileTransferDb.findInvitationById(1);

      expect(invitation).toEqual({
        id: 1,
        profileId: 10,
        profileName: "Jamie's Profile",
        sourceAccountId: 5,
        sourceAccountName: 'The Smith Family',
        targetEmail: 'jamie@example.com',
        targetName: 'Jamie',
        newDefaultProfileId: null,
        status: 'pending',
        expiresAt: '2026-07-19T00:00:00.000Z',
        claimedAt: null,
        createdAt: '2026-07-12T00:00:00.000Z',
      });
    });

    it('should return null when not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const invitation = await profileTransferDb.findInvitationById(999);
      expect(invitation).toBeNull();
    });
  });

  describe('findInvitationByTokenHash()', () => {
    it('should return a transformed invitation', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow]]);
      const invitation = await profileTransferDb.findInvitationByTokenHash('hashed-token');
      expect(invitation?.id).toBe(1);
    });

    it('should return null when not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const invitation = await profileTransferDb.findInvitationByTokenHash('unknown');
      expect(invitation).toBeNull();
    });
  });

  describe('findPendingInvitationByProfileId()', () => {
    it('should return the pending invitation for a profile', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow]]);
      const invitation = await profileTransferDb.findPendingInvitationByProfileId(10);
      expect(invitation?.profileId).toBe(10);
    });

    it('should return null when no pending invitation exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const invitation = await profileTransferDb.findPendingInvitationByProfileId(10);
      expect(invitation).toBeNull();
    });
  });

  describe('listInvitationsByAccountId()', () => {
    it('should return all invitations for an account', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow, { ...invitationRow, invitation_id: 2 }]]);
      const invitations = await profileTransferDb.listInvitationsByAccountId(5);
      expect(invitations).toHaveLength(2);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE pti.source_account_id = ?'), [5]);
    });
  });

  describe('listInvitationsByStatus()', () => {
    it('should filter by status when provided', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow]]);
      await profileTransferDb.listInvitationsByStatus('pending');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE pti.status = ?'), ['pending']);
    });

    it('should list all invitations when status is omitted', async () => {
      mockExecute.mockResolvedValueOnce([[invitationRow]]);
      await profileTransferDb.listInvitationsByStatus();
      expect(mockExecute).toHaveBeenCalledWith(expect.not.stringContaining('WHERE pti.status = ?'), []);
    });
  });

  describe('cancelInvitation()', () => {
    it('should return true when a pending invitation is canceled', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);
      const result = await profileTransferDb.cancelInvitation(1, 5);
      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"), [1, 5]);
    });

    it('should return false when nothing was canceled', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);
      const result = await profileTransferDb.cancelInvitation(1, 5);
      expect(result).toBe(false);
    });
  });

  describe('deleteInvitation()', () => {
    it('should return true when a row is deleted', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);
      const result = await profileTransferDb.deleteInvitation(1);
      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM profile_transfer_invitations WHERE invitation_id = ?', [1]);
    });
  });

  describe('claimInvitation()', () => {
    const pendingLockRow = {
      profile_id: 10,
      source_account_id: 5,
      new_default_profile_id: null,
      status: 'pending',
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
    };

    it('should claim without a default-profile reassignment', async () => {
      mockExecute
        .mockResolvedValueOnce([[pendingLockRow]]) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce([[{ count: 2 }]]) // profile count check
        .mockResolvedValueOnce([{ insertId: 99 } as ResultSetHeader]) // INSERT accounts
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // UPDATE profiles
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]) // UPDATE watchlist_items
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]) // UPDATE watchlist_item_events
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // UPDATE new account default_profile_id
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // UPDATE invitation status
        .mockResolvedValueOnce([[{ ...invitationRow, status: 'claimed' }]]); // final SELECT

      const result = await profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1');

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(result.account).toEqual({
        id: 99,
        name: 'Jamie',
        email: 'jamie@example.com',
        uid: 'firebase-uid-1',
        image: '',
        defaultProfileId: 10,
      });
      expect(result.invitation.status).toBe('claimed');
      expect(mockExecute).toHaveBeenCalledWith('UPDATE profiles SET account_id = ? WHERE profile_id = ?', [99, 10]);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE watchlist_items SET account_id = ? WHERE profile_id = ?',
        [99, 10],
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE watchlist_item_events SET account_id = ? WHERE profile_id = ?',
        [99, 10],
      );
      // Only one default_profile_id UPDATE call (for the new account); no reassignment on the source account
      const defaultUpdateCalls = mockExecute.mock.calls.filter(
        ([query]) => query === 'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?',
      );
      expect(defaultUpdateCalls).toHaveLength(1);
      expect(defaultUpdateCalls[0][1]).toEqual([10, 99]);
    });

    it('should also reassign the source account default when new_default_profile_id is set', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ ...pendingLockRow, new_default_profile_id: 11 }]])
        .mockResolvedValueOnce([[{ count: 2 }]])
        .mockResolvedValueOnce([{ insertId: 99 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader])
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // new account default
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // source account default reassignment
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // mark claimed
        .mockResolvedValueOnce([[{ ...invitationRow, status: 'claimed' }]]);

      await profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1');

      const defaultUpdateCalls = mockExecute.mock.calls.filter(
        ([query]) => query === 'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?',
      );
      expect(defaultUpdateCalls).toHaveLength(2);
      expect(defaultUpdateCalls[1][1]).toEqual([11, 5]);
    });

    it('should throw NotFoundError when the invitation does not exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await expect(
        profileTransferDb.claimInvitation(999, 'Jamie', 'jamie@example.com', 'firebase-uid-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw GoneError when the invitation is no longer pending', async () => {
      mockExecute.mockResolvedValueOnce([[{ ...pendingLockRow, status: 'claimed' }]]);

      await expect(
        profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1'),
      ).rejects.toThrow(GoneError);
    });

    it('should throw GoneError when the invitation has expired', async () => {
      mockExecute.mockResolvedValueOnce([[{ ...pendingLockRow, expires_at: new Date(Date.now() - 1000) }]]);

      await expect(
        profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1'),
      ).rejects.toThrow(GoneError);
    });

    it('should throw BadRequestError when the source account would be left with no profiles', async () => {
      mockExecute.mockResolvedValueOnce([[pendingLockRow]]).mockResolvedValueOnce([[{ count: 1 }]]);

      await expect(
        profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1'),
      ).rejects.toThrow(BadRequestError);
    });

    it('should propagate custom errors from the transaction as DatabaseError otherwise', async () => {
      mockTransactionHelper.executeInTransaction.mockRejectedValueOnce(new Error('connection lost'));

      await expect(
        profileTransferDb.claimInvitation(1, 'Jamie', 'jamie@example.com', 'firebase-uid-1'),
      ).rejects.toThrow(DatabaseError);
    });
  });

  it('sanity: getDbPool is used for non-transactional reads', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    await profileTransferDb.findInvitationById(1);
    expect(getDbPool).toHaveBeenCalled();
  });
});
