import { ProfileTransferInvitation, ProfileTransferInvitationStatus } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ProfileTransferInvitationRow extends RowDataPacket {
  invitation_id: number;
  profile_id: number;
  profile_name: string;
  source_account_id: number;
  source_account_name: string;
  target_email: string;
  target_name: string | null;
  new_default_profile_id: number | null;
  status: ProfileTransferInvitationStatus;
  expires_at: Date;
  claimed_at: Date | null;
  created_at: Date;
}

export function transformProfileTransferInvitation(row: ProfileTransferInvitationRow): ProfileTransferInvitation {
  return {
    id: row.invitation_id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    sourceAccountId: row.source_account_id,
    sourceAccountName: row.source_account_name,
    targetEmail: row.target_email,
    targetName: row.target_name,
    newDefaultProfileId: row.new_default_profile_id,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    claimedAt: row.claimed_at ? row.claimed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}
