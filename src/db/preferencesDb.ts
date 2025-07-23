import { cliLogger } from '../logger/logger';
import { AccountReferenceRow, transformAccountReferenceRow } from '../types/accountTypes';
import { AccountPreferenceRow } from '../types/preferenceTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import {
  AccountPreferences,
  AccountReference,
  DEFAULT_PREFERENCES,
  EmailPreferences,
  PreferenceData,
  PreferenceType,
  TypedPreferenceUpdate,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Safely handles preference data from MySQL JSON column
 * MySQL JSON columns are automatically parsed by the driver, so we don't need JSON.parse()
 */
function processPreferenceData(preferences: unknown): PreferenceData {
  if (typeof preferences === 'object' && preferences !== null && !Array.isArray(preferences)) {
    return preferences as PreferenceData;
  }

  if (typeof preferences === 'string') {
    try {
      const parsed = JSON.parse(preferences);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as PreferenceData;
      }
      cliLogger.error('Parsed preference data is not an object:', parsed);
      return {};
    } catch (error) {
      cliLogger.error('Failed to parse preference string:', error);
      return {};
    }
  }

  cliLogger.warn('Unexpected preference data type:', typeof preferences, preferences);
  return {};
}

export async function getAccountPreferences(accountId: number): Promise<AccountPreferences> {
  try {
    const query = `SELECT * FROM account_preferences WHERE account_id = ?`;

    const [rows] = await getDbPool().execute<AccountPreferenceRow[]>(query, [accountId]);
    const preferences: AccountPreferences = {};

    for (const row of rows) {
      const processedPreferences = processPreferenceData(row.preferences);
      preferences[row.preference_type as PreferenceType] = processedPreferences;
    }

    for (const [type, defaultPrefs] of Object.entries(DEFAULT_PREFERENCES)) {
      if (!preferences[type as PreferenceType]) {
        preferences[type as PreferenceType] = defaultPrefs;
      }
    }

    return preferences;
  } catch (error) {
    handleDatabaseError(error, 'getting account preferences');
  }
}

export async function getPreferencesByType<T extends PreferenceData>(
  accountId: number,
  preferenceType: PreferenceType,
): Promise<T> {
  try {
    const query = `SELECT preferences FROM account_preferences WHERE account_id = ? AND preference_type = ?`;

    const [rows] = await getDbPool().execute<AccountPreferenceRow[]>(query, [accountId, preferenceType]);

    if (rows.length === 0) {
      return DEFAULT_PREFERENCES[preferenceType] as T;
    }

    const processedPreferences = processPreferenceData(rows[0].preferences);
    return processedPreferences as T;
  } catch (error) {
    handleDatabaseError(error, 'getting account preferences by type');
  }
}

export async function updatePreferences<T extends PreferenceData>(
  accountId: number,
  preferenceType: PreferenceType,
  updates: Partial<T>,
): Promise<boolean> {
  try {
    const existing = await getPreferencesByType(accountId, preferenceType);
    const merged = { ...existing, ...updates };

    const query = `
      INSERT INTO account_preferences (account_id, preference_type, preferences)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        preferences = VALUES(preferences),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await getDbPool().execute<ResultSetHeader>(query, [accountId, preferenceType, merged]);
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating account preferences');
  }
}

export async function updateMultiplePreferences(
  accountId: number,
  updates: Partial<TypedPreferenceUpdate>,
): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction<boolean>(async (connection) => {
      for (const [type, prefs] of Object.entries(updates)) {
        if (prefs && Object.keys(prefs).length > 0) {
          const existing = await getPreferencesByType(accountId, type as PreferenceType);
          const merged = { ...existing, ...prefs };

          const query = `
            INSERT INTO account_preferences (account_id, preference_type, preferences)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              preferences = VALUES(preferences),
              updated_at = CURRENT_TIMESTAMP`;

          await connection.execute(query, [accountId, type, merged]);
        }
      }
      return true;
    });
  } catch (error) {
    handleDatabaseError(error, 'updating multiple account preferences');
  }
}

export async function initializeDefaultPreferences(accountId: number): Promise<void> {
  try {
    const values = Object.entries(DEFAULT_PREFERENCES).map(([type, prefs]) => [accountId, type, prefs]);

    const query = `INSERT INTO account_preferences (account_id, preference_type, preferences) VALUES ?`;
    await getDbPool().query(query, [values]);
  } catch (error) {
    handleDatabaseError(error, 'initializing default preferences');
  }
}

export async function deleteAccountPreferences(accountId: number): Promise<void> {
  try {
    const query = `DELETE FROM account_preferences WHERE account_id = ?`;
    await getDbPool().execute(query, [accountId]);
  } catch (error) {
    handleDatabaseError(error, 'deleting account preferences');
  }
}

export async function getAccountsWithEmailPreference(
  preferenceKey: keyof EmailPreferences,
  value: boolean = true,
): Promise<AccountReference[]> {
  try {
    const query = `
      SELECT DISTINCT a.account_id, a.account_name, a.email
      FROM accounts a
      JOIN account_preferences ap ON a.account_id = ap.account_id
      WHERE ap.preference_type = 'email'
        AND JSON_EXTRACT(ap.preferences, '$.${String(preferenceKey)}') = ?
        AND a.email IS NOT NULL
    `;

    const [rows] = await getDbPool().execute<AccountReferenceRow[]>(query, [value]);
    return rows.map(transformAccountReferenceRow);
  } catch (error) {
    handleDatabaseError(error, `getting accounts with email preference ${preferenceKey}`);
  }
}
