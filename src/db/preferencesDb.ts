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
 * @fileoverview Database operations module for managing user account preferences.
 *
 * This module provides direct database access functions for managing user preferences
 * stored in MySQL JSON columns. It handles preference data serialization/deserialization,
 * transaction management, and error handling for all preference-related database operations.
 *
 * The module supports four types of preferences:
 * - Email preferences (weekly digest, marketing emails)
 * - Notification preferences (alerts for new content)
 * - Display preferences (theme, date format)
 * - Privacy preferences (data collection, recommendations)
 *
 * @module preferencesDb
 */

/**
 * Safely processes preference data from MySQL JSON columns.
 *
 * MySQL JSON columns are automatically parsed by the driver, but this function
 * provides additional safety by handling edge cases where the data might be
 * stored as a string or in an unexpected format. It ensures that the returned
 * data is always a valid object that can be used as preference data.
 *
 * @private
 * @param preferences - Raw preference data from the database (could be object, string, or other)
 * @returns Processed preference data as a safe object
 *
 * @example
 * ```typescript
 * // Handles automatically parsed JSON objects
 * const prefs1 = processPreferenceData({ weeklyDigest: true });
 *
 * // Handles string JSON that needs parsing
 * const prefs2 = processPreferenceData('{"weeklyDigest": true}');
 *
 * // Handles invalid data gracefully
 * const prefs3 = processPreferenceData(null); // Returns {}
 * ```
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

/**
 * Retrieves all preferences for a specific account across all preference types.
 *
 * Fetches preferences for all supported types (email, notification, display, privacy)
 * from the account_preferences table. For any missing preference types, automatically
 * populates the result with default values to ensure a complete preference object
 * is always returned.
 *
 * @param accountId - The unique identifier of the account
 * @returns Promise that resolves to complete account preferences with all types populated
 * @throws {Error} Database connection errors, query execution failures, or data corruption issues
 *
 * @example
 * ```typescript
 * const preferences = await getAccountPreferences(123);
 * console.log(preferences);
 * // Output:
 * // {
 * //   email: { weeklyDigest: true, marketingEmails: false },
 * //   notification: { newSeasonAlerts: true, newEpisodeAlerts: false },
 * //   display: { theme: 'dark', dateFormat: 'MM/DD/YYYY' },
 * //   privacy: { allowRecommendations: true, dataCollection: false }
 * // }
 * ```
 *
 */
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

/**
 * Retrieves preferences for a specific account and preference type.
 *
 * Fetches only the preferences for the specified type (e.g., 'email', 'notification').
 * If no preferences exist for the specified type in the database, returns the
 * default preferences for that type instead of throwing an error. This ensures
 * that the application always has valid preference data to work with.
 *
 * @template T - The specific preference data type extending PreferenceData
 * @param accountId - The unique identifier of the account
 * @param preferenceType - The type of preferences to retrieve ('email' | 'notification' | 'display' | 'privacy')
 * @returns Promise that resolves to the preference data for the specified type
 * @throws {Error} Database connection errors, invalid preference type, or query execution failures
 *
 * @example
 * ```typescript
 * // Get email preferences only
 * const emailPrefs = await getPreferencesByType(123, 'email');
 * console.log(emailPrefs.weeklyDigest); // boolean
 *
 * // Get display preferences with type safety
 * const displayPrefs = await getPreferencesByType<DisplayPreferences>(123, 'display');
 * console.log(displayPrefs.theme); // 'light' | 'dark' | 'auto'
 *
 * // Returns defaults if no preferences exist
 * const newUserPrefs = await getPreferencesByType(999, 'email');
 * // Returns DEFAULT_PREFERENCES.email
 * ```
 *
 */
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

/**
 * Updates preferences for a specific account and preference type.
 *
 * Performs a partial update by merging the provided updates with existing preferences.
 * Uses MySQL's INSERT ... ON DUPLICATE KEY UPDATE to handle both creation and updating
 * of preference records. The function fetches existing preferences, merges them with
 * the updates, and stores the complete merged object back to the database.
 *
 * @template T - The specific preference data type extending PreferenceData
 * @param accountId - The unique identifier of the account
 * @param preferenceType - The type of preferences to update ('email' | 'notification' | 'display' | 'privacy')
 * @param updates - Partial preference object containing only the fields to update
 * @returns Promise that resolves to true if any rows were affected, false otherwise
 * @throws {Error} Database connection errors, constraint violations, or JSON serialization errors
 *
 * @example
 * ```typescript
 * // Update email preferences
 * const success = await updatePreferences(123, 'email', {
 *   weeklyDigest: false,
 *   marketingEmails: true
 * });
 *
 * // Update display theme only
 * const success = await updatePreferences(123, 'display', {
 *   theme: 'dark'
 * });
 *
 * // The dateFormat field remains unchanged
 * ```
 *
 */
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

/**
 * Updates multiple preference types for an account in a single atomic transaction.
 *
 * Allows updating preferences across different types (email, notification, display, privacy)
 * within a single database transaction to ensure data consistency. Each preference type
 * is processed individually, merging updates with existing values, and all operations
 * are committed together or rolled back if any operation fails.
 *
 * @param accountId - The unique identifier of the account
 * @param updates - Object containing partial updates for multiple preference types
 * @returns Promise that resolves to true if the transaction succeeded, false otherwise
 * @throws {Error} Database connection errors, transaction failures, or constraint violations
 *
 * @example
 * ```typescript
 * // Update multiple preference types atomically
 * const success = await updateMultiplePreferences(123, {
 *   email: {
 *     weeklyDigest: true,
 *     marketingEmails: false
 *   },
 *   display: {
 *     theme: 'dark'
 *   },
 *   notification: {
 *     newEpisodeAlerts: true
 *   }
 * });
 *
 * // All updates succeed or all fail together
 * if (success) {
 *   console.log('All preferences updated successfully');
 * }
 * ```
 *
 */
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

/**
 * Initializes default preferences for a new account across all preference types.
 *
 * Creates preference records for all supported preference types using the default
 * values defined in DEFAULT_PREFERENCES. This function is typically called when
 * a new account is created to ensure all preference types have initial values.
 * Uses a batch INSERT operation for efficiency.
 *
 * @param accountId - The unique identifier of the account to initialize
 * @returns Promise that resolves when initialization is complete
 * @throws {Error} Database connection errors, constraint violations, or if preferences already exist
 *
 * @example
 * ```typescript
 * // Initialize preferences for a new account
 * await initializeDefaultPreferences(123);
 *
 * // Creates records for all preference types:
 * // - email: { weeklyDigest: true, marketingEmails: true }
 * // - notification: { newSeasonAlerts: true, newEpisodeAlerts: false }
 * // - display: { theme: 'light', dateFormat: 'MM/DD/YYYY' }
 * // - privacy: { allowRecommendations: true, dataCollection: true }
 * ```
 *
 * @warning This function does not check if preferences already exist. Use with new accounts only.
 *
 */
export async function initializeDefaultPreferences(accountId: number): Promise<void> {
  try {
    const values = Object.entries(DEFAULT_PREFERENCES).map(([type, prefs]) => [accountId, type, prefs]);

    const query = `INSERT INTO account_preferences (account_id, preference_type, preferences) VALUES ?`;
    await getDbPool().query(query, [values]);
  } catch (error) {
    handleDatabaseError(error, 'initializing default preferences');
  }
}

/**
 * Deletes all preferences for a specific account across all preference types.
 *
 * Removes all preference records from the account_preferences table for the specified
 * account. This is typically used when an account is being deleted or when preferences
 * need to be completely reset. This operation is irreversible and will cause
 * subsequent preference queries to return default values.
 *
 * @param accountId - The unique identifier of the account whose preferences should be deleted
 * @returns Promise that resolves when deletion is complete
 * @throws {Error} Database connection errors or constraint violations
 *
 * @example
 * ```typescript
 * // Delete all preferences for an account
 * await deleteAccountPreferences(123);
 *
 * // After deletion, getAccountPreferences(123) will return DEFAULT_PREFERENCES
 * const prefs = await getAccountPreferences(123);
 * // prefs will contain default values for all preference types
 * ```
 *
 * @warning This operation permanently deletes all preference data for the account.
 * @warning Consider backing up preference data before deletion if recovery might be needed.
 *
 */
export async function deleteAccountPreferences(accountId: number): Promise<void> {
  try {
    const query = `DELETE FROM account_preferences WHERE account_id = ?`;
    await getDbPool().execute(query, [accountId]);
  } catch (error) {
    handleDatabaseError(error, 'deleting account preferences');
  }
}

/**
 * Retrieves all accounts that have a specific email preference set to a given value.
 *
 * Performs a JOIN query between the accounts and account_preferences tables to find
 * accounts where a specific email preference (like weeklyDigest or marketingEmails)
 * matches the specified boolean value. Uses MySQL's JSON_EXTRACT function to query
 * the JSON preference data efficiently. Only returns accounts with valid email addresses.
 *
 * @param preferenceKey - The specific email preference key to search for (must be a key of EmailPreferences)
 * @param value - The boolean value to match (defaults to true)
 * @returns Promise that resolves to an array of account references with the matching preference
 * @throws {Error} Database connection errors, invalid preference key, or query execution failures
 *
 * @example
 * ```typescript
 * // Find all accounts with weekly digest enabled
 * const digestUsers = await getAccountsWithEmailPreference('weeklyDigest', true);
 * digestUsers.forEach(account => {
 *   console.log(`Send digest to: ${account.name} (${account.email})`);
 * });
 *
 * // Find accounts that opted out of marketing emails
 * const optedOut = await getAccountsWithEmailPreference('marketingEmails', false);
 *
 * // Process results for email campaign
 * const emailList = digestUsers.map(account => ({
 *   id: account.id,
 *   email: account.email,
 *   name: account.name
 * }));
 * ```
 *
 */
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
