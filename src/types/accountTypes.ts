import { Account, AccountReference } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface AccountReferenceRow extends RowDataPacket {
  account_id: number;
  account_name: string;
  email: string;
}

export interface AccountRow extends AccountReferenceRow {
  uid: string;
  last_login: Date | null;
  last_activity: Date | null;
  image: string;
  default_profile_id: number;
  created_at: Date;
  updated_at: Date;
}

export function transformAccountReferenceRow(row: AccountReferenceRow): AccountReference {
  return {
    id: row.account_id,
    name: row.account_name,
    email: row.email,
  };
}

export function transformAccountRow(row: AccountRow): Account {
  return {
    id: row.account_id,
    name: row.account_name,
    email: row.email,
    uid: row.uid,
    image: row.image ?? '',
    defaultProfileId: row.default_profile_id,
  };
}
