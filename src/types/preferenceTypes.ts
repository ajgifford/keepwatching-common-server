import { PreferenceData } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface AccountPreferenceRow extends RowDataPacket {
  preference_id: number;
  account_id: number;
  preference_type: string;
  preferences: PreferenceData;
  created_at: Date;
  updated_at: Date;
}
