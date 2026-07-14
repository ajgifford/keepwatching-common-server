import { BadRequestError, GoneError, NotFoundError } from '../middleware/errorMiddleware';
import { ProfileTransferInvitationRow, transformProfileTransferInvitation } from '../types/profileTransferTypes';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { Account, ProfileTransferInvitation } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const INVITATION_SELECT = `
  SELECT
    pti.invitation_id,
    pti.profile_id,
    p.name AS profile_name,
    pti.source_account_id,
    a.account_name AS source_account_name,
    pti.target_email,
    pti.target_name,
    pti.new_default_profile_id,
    pti.status,
    pti.expires_at,
    pti.claimed_at,
    pti.created_at
  FROM profile_transfer_invitations pti
  JOIN profiles p ON p.profile_id = pti.profile_id
  JOIN accounts a ON a.account_id = pti.source_account_id
`;

export interface CreateProfileTransferInvitationData {
  profileId: number;
  sourceAccountId: number;
  targetEmail: string;
  targetName: string | null;
  newDefaultProfileId: number | null;
  tokenHash: string;
  expiresAt: Date;
}

export async function createInvitation(data: CreateProfileTransferInvitationData): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('createProfileTransferInvitation', async () => {
      const query = `
        INSERT INTO profile_transfer_invitations
          (profile_id, source_account_id, target_email, target_name, new_default_profile_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await getDbPool().execute<ResultSetHeader>(query, [
        data.profileId,
        data.sourceAccountId,
        data.targetEmail,
        data.targetName,
        data.newDefaultProfileId,
        data.tokenHash,
        data.expiresAt,
      ]);

      return result.insertId;
    });
  } catch (error) {
    handleDatabaseError(error, 'creating a profile transfer invitation');
  }
}

export async function findInvitationById(invitationId: number): Promise<ProfileTransferInvitation | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('findProfileTransferInvitationById', async () => {
      const query = `${INVITATION_SELECT} WHERE pti.invitation_id = ?`;
      const [rows] = await getDbPool().execute<ProfileTransferInvitationRow[]>(query, [invitationId]);

      if (rows.length === 0) return null;

      return transformProfileTransferInvitation(rows[0]);
    });
  } catch (error) {
    handleDatabaseError(error, 'finding a profile transfer invitation by id');
  }
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<ProfileTransferInvitation | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('findProfileTransferInvitationByTokenHash', async () => {
      const query = `${INVITATION_SELECT} WHERE pti.token_hash = ?`;
      const [rows] = await getDbPool().execute<ProfileTransferInvitationRow[]>(query, [tokenHash]);

      if (rows.length === 0) return null;

      return transformProfileTransferInvitation(rows[0]);
    });
  } catch (error) {
    handleDatabaseError(error, 'finding a profile transfer invitation by token');
  }
}

export async function findPendingInvitationByProfileId(profileId: number): Promise<ProfileTransferInvitation | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'findPendingProfileTransferInvitationByProfileId',
      async () => {
        const query = `${INVITATION_SELECT} WHERE pti.profile_id = ? AND pti.status = 'pending'`;
        const [rows] = await getDbPool().execute<ProfileTransferInvitationRow[]>(query, [profileId]);

        if (rows.length === 0) return null;

        return transformProfileTransferInvitation(rows[0]);
      },
    );
  } catch (error) {
    handleDatabaseError(error, 'finding a pending profile transfer invitation by profile id');
  }
}

export async function listInvitationsByAccountId(accountId: number): Promise<ProfileTransferInvitation[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('listProfileTransferInvitationsByAccountId', async () => {
      const query = `${INVITATION_SELECT} WHERE pti.source_account_id = ? ORDER BY pti.created_at DESC`;
      const [rows] = await getDbPool().execute<ProfileTransferInvitationRow[]>(query, [accountId]);

      return rows.map(transformProfileTransferInvitation);
    });
  } catch (error) {
    handleDatabaseError(error, 'listing profile transfer invitations by account id');
  }
}

export async function listInvitationsByStatus(status?: string): Promise<ProfileTransferInvitation[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('listProfileTransferInvitationsByStatus', async () => {
      const query = status
        ? `${INVITATION_SELECT} WHERE pti.status = ? ORDER BY pti.created_at DESC`
        : `${INVITATION_SELECT} ORDER BY pti.created_at DESC`;
      const params = status ? [status] : [];
      const [rows] = await getDbPool().execute<ProfileTransferInvitationRow[]>(query, params);

      return rows.map(transformProfileTransferInvitation);
    });
  } catch (error) {
    handleDatabaseError(error, 'listing profile transfer invitations by status');
  }
}

export async function cancelInvitation(invitationId: number, sourceAccountId: number): Promise<boolean> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('cancelProfileTransferInvitation', async () => {
      const query = `
        UPDATE profile_transfer_invitations
        SET status = 'canceled'
        WHERE invitation_id = ? AND source_account_id = ? AND status = 'pending'
      `;
      const [result] = await getDbPool().execute<ResultSetHeader>(query, [invitationId, sourceAccountId]);

      return result.affectedRows > 0;
    });
  } catch (error) {
    handleDatabaseError(error, 'canceling a profile transfer invitation');
  }
}

/**
 * Deletes an invitation outright. Used to roll back invitation creation when the
 * follow-up email send fails, so a broken invitation isn't left dangling.
 */
export async function deleteInvitation(invitationId: number): Promise<boolean> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('deleteProfileTransferInvitation', async () => {
      const query = 'DELETE FROM profile_transfer_invitations WHERE invitation_id = ?';
      const [result] = await getDbPool().execute<ResultSetHeader>(query, [invitationId]);

      return result.affectedRows > 0;
    });
  } catch (error) {
    handleDatabaseError(error, 'deleting a profile transfer invitation');
  }
}

export interface ClaimInvitationResult {
  account: Account;
  invitation: ProfileTransferInvitation;
}

/**
 * Atomically claims a pending invitation: creates the new account, re-parents the
 * profile and its denormalized watchlist rows, fixes up default_profile_id on both
 * accounts, and marks the invitation claimed.
 *
 * Re-validates the invitation's status/expiry/profile-count inside the transaction
 * (via SELECT ... FOR UPDATE) to guard against races with cancellation or other
 * profile deletions that may have happened between the service-layer pre-check and now.
 */
export async function claimInvitation(
  invitationId: number,
  newAccountName: string,
  newAccountEmail: string,
  newAccountUid: string,
): Promise<ClaimInvitationResult> {
  const transactionHelper = new TransactionHelper();

  try {
    return await DbMonitor.getInstance().executeWithTiming('claimProfileTransferInvitation', async () => {
      return await transactionHelper.executeInTransaction(async (connection) => {
        const [invitationRows] = await connection.execute<RowDataPacket[]>(
          `SELECT profile_id, source_account_id, new_default_profile_id, status, expires_at
           FROM profile_transfer_invitations WHERE invitation_id = ? FOR UPDATE`,
          [invitationId],
        );

        if (invitationRows.length === 0) {
          throw new NotFoundError('Profile transfer invitation not found');
        }

        const invitationRow = invitationRows[0];
        if (invitationRow.status !== 'pending' || new Date(invitationRow.expires_at) <= new Date()) {
          throw new GoneError('Profile transfer invitation is no longer available');
        }

        const profileId = invitationRow.profile_id as number;
        const sourceAccountId = invitationRow.source_account_id as number;
        const newDefaultProfileId = invitationRow.new_default_profile_id as number | null;

        const [profileCountRows] = await connection.execute<RowDataPacket[]>(
          'SELECT COUNT(*) AS count FROM profiles WHERE account_id = ?',
          [sourceAccountId],
        );
        if ((profileCountRows[0].count as number) <= 1) {
          throw new BadRequestError('Source account must retain at least one other profile');
        }

        const accountQuery = `INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)`;
        const [accountResult] = await connection.execute<ResultSetHeader>(accountQuery, [
          newAccountName,
          newAccountEmail,
          newAccountUid,
        ]);
        const newAccountId = accountResult.insertId;

        await connection.execute('UPDATE profiles SET account_id = ? WHERE profile_id = ?', [newAccountId, profileId]);

        await connection.execute('UPDATE watchlist_items SET account_id = ? WHERE profile_id = ?', [
          newAccountId,
          profileId,
        ]);
        await connection.execute('UPDATE watchlist_item_events SET account_id = ? WHERE profile_id = ?', [
          newAccountId,
          profileId,
        ]);

        await connection.execute('UPDATE accounts SET default_profile_id = ? WHERE account_id = ?', [
          profileId,
          newAccountId,
        ]);

        if (newDefaultProfileId) {
          await connection.execute('UPDATE accounts SET default_profile_id = ? WHERE account_id = ?', [
            newDefaultProfileId,
            sourceAccountId,
          ]);
        }

        await connection.execute(
          `UPDATE profile_transfer_invitations SET status = 'claimed', claimed_at = NOW() WHERE invitation_id = ?`,
          [invitationId],
        );

        const [invitationRowsAfter] = await connection.execute<ProfileTransferInvitationRow[]>(
          `${INVITATION_SELECT} WHERE pti.invitation_id = ?`,
          [invitationId],
        );

        return {
          account: {
            id: newAccountId,
            name: newAccountName,
            email: newAccountEmail,
            uid: newAccountUid,
            image: '',
            defaultProfileId: profileId,
          },
          invitation: transformProfileTransferInvitation(invitationRowsAfter[0]),
        };
      });
    });
  } catch (error) {
    handleDatabaseError(error, 'claiming a profile transfer invitation');
  }
}
