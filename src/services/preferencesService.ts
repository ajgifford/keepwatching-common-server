import * as preferencesDb from '../db/preferencesDb';
import { NoAffectedRowsError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import {
  AccountPreferences,
  AccountReference,
  EmailPreferences,
  PreferenceData,
  PreferenceType,
  TypedPreferenceUpdate,
} from '@ajgifford/keepwatching-types';

/**
 * Service for managing user account preferences across different preference types.
 *
 * This service provides a high-level interface for managing user preferences including
 * email preferences, notification settings, display preferences, and privacy settings.
 * All operations are wrapped with comprehensive error handling and validation.
 *
 * @example
 * ```typescript
 * // Get all preferences for an account
 * const prefs = await preferencesService.getAccountPreferences(123);
 *
 * // Update email preferences
 * await preferencesService.updatePreferences(123, 'email', {
 *   weeklyDigest: true,
 *   marketingEmails: false
 * });
 *
 * // Update multiple preference types at once
 * await preferencesService.updateMultiplePreferences(123, {
 *   email: { weeklyDigest: true },
 *   display: { theme: 'dark' }
 * });
 * ```
 *
 */
export class PreferencesService {
  /**
   * Retrieves all preferences for a specific account across all preference types.
   *
   * Returns a complete AccountPreferences object containing all preference types
   * (email, notification, display, privacy). If any preference type is missing
   * from the database, default values are automatically populated.
   *
   * @param accountId - The unique identifier of the account
   * @returns Promise that resolves to the complete account preferences object
   * @throws {Error} When database operation fails or account access is denied
   *
   * @example
   * ```typescript
   * const preferences = await preferencesService.getAccountPreferences(123);
   * console.log(preferences.email.weeklyDigest); // boolean
   * console.log(preferences.display.theme); // 'light' | 'dark' | 'auto'
   * ```
   *
   */
  public async getAccountPreferences(accountId: number): Promise<AccountPreferences> {
    try {
      return await preferencesDb.getAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `getAccountPreferences(${accountId})`);
    }
  }

  /**
   * Retrieves preferences for a specific account and preference type.
   *
   * Returns only the preferences for the specified type (e.g., 'email', 'notification').
   * If no preferences exist for the specified type, returns the default preferences
   * for that type instead of throwing an error.
   *
   * @param accountId - The unique identifier of the account
   * @param preferenceType - The type of preferences to retrieve ('email' | 'notification' | 'display' | 'privacy')
   * @returns Promise that resolves to the preference data for the specified type
   * @throws {Error} When database operation fails or invalid preference type is provided
   *
   * @example
   * ```typescript
   * // Get only email preferences
   * const emailPrefs = await preferencesService.getPreferencesByType(123, 'email');
   * console.log(emailPrefs.weeklyDigest); // boolean
   *
   * // Get display preferences
   * const displayPrefs = await preferencesService.getPreferencesByType(123, 'display');
   * console.log(displayPrefs.theme); // 'light' | 'dark' | 'auto'
   * ```
   *
   */
  public async getPreferencesByType(accountId: number, preferenceType: PreferenceType): Promise<PreferenceData> {
    try {
      return await preferencesDb.getPreferencesByType(accountId, preferenceType);
    } catch (error) {
      throw errorService.handleError(error, `getPreferencesByType(${accountId}, ${preferenceType})`);
    }
  }

  /**
   * Updates preferences for a specific account and preference type.
   *
   * Performs a partial update, merging the provided updates with existing preferences.
   * Only the specified fields are updated; other fields in the preference type remain unchanged.
   * After updating, returns the complete updated AccountPreferences object.
   *
   * @template T - The specific preference data type extending PreferenceData
   * @param accountId - The unique identifier of the account
   * @param preferenceType - The type of preferences to update ('email' | 'notification' | 'display' | 'privacy')
   * @param updates - Partial preference object containing only the fields to update
   * @returns Promise that resolves to the complete updated account preferences
   * @throws {NoAffectedRowsError} When no preferences were updated (possibly due to identical values)
   * @throws {Error} When database operation fails or validation errors occur
   *
   * @example
   * ```typescript
   * // Update only weeklyDigest in email preferences
   * const updatedPrefs = await preferencesService.updatePreferences(123, 'email', {
   *   weeklyDigest: false
   * });
   *
   * // Update theme in display preferences
   * const updatedPrefs = await preferencesService.updatePreferences(123, 'display', {
   *   theme: 'dark'
   * });
   * ```
   *
   */
  public async updatePreferences<T extends PreferenceData>(
    accountId: number,
    preferenceType: PreferenceType,
    updates: Partial<T>,
  ): Promise<AccountPreferences> {
    try {
      const updated = await preferencesDb.updatePreferences(accountId, preferenceType, updates);
      if (!updated) {
        throw new NoAffectedRowsError('No preferences updated');
      }
      return await preferencesDb.getAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `updatePreferences(${accountId}, ${preferenceType})`);
    }
  }

  /**
   * Updates multiple preference types for an account in a single atomic operation.
   *
   * Allows updating preferences across different types (email, notification, display, privacy)
   * in a single transaction. Each preference type is updated independently, and only
   * the specified fields within each type are modified. Uses database transactions
   * to ensure data consistency.
   *
   * @param accountId - The unique identifier of the account
   * @param updates - Object containing partial updates for multiple preference types
   * @returns Promise that resolves to the complete updated account preferences
   * @throws {NoAffectedRowsError} When no preferences were updated across any type
   * @throws {Error} When database operation fails or transaction cannot be completed
   *
   * @example
   * ```typescript
   * // Update multiple preference types at once
   * const updatedPrefs = await preferencesService.updateMultiplePreferences(123, {
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
   * ```
   *
   */
  public async updateMultiplePreferences(
    accountId: number,
    updates: Partial<TypedPreferenceUpdate>,
  ): Promise<AccountPreferences> {
    try {
      const updated = await preferencesDb.updateMultiplePreferences(accountId, updates);
      if (!updated) {
        throw new NoAffectedRowsError('No preferences updated');
      }
      return await preferencesDb.getAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `updateMultiplePreferences(${accountId})`);
    }
  }

  /**
   * Initializes default preferences for a new account.
   *
   * Creates preference entries for all supported preference types using default values.
   * This method is typically called when a new account is created to ensure all
   * preference types have initial values. Does not overwrite existing preferences.
   *
   * @param accountId - The unique identifier of the account to initialize
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When database operation fails or account already has preferences
   *
   * @example
   * ```typescript
   * // Initialize preferences for a new account
   * await preferencesService.initializeDefaultPreferences(123);
   *
   * // Now the account will have default values for all preference types
   * const prefs = await preferencesService.getAccountPreferences(123);
   * ```
   *
   */
  public async initializeDefaultPreferences(accountId: number): Promise<void> {
    try {
      await preferencesDb.initializeDefaultPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `initializeDefaultPreferences(${accountId})`);
    }
  }

  /**
   * Deletes all preferences for a specific account.
   *
   * Removes all preference entries across all preference types for the specified account.
   * This is typically used when an account is being deleted or when preferences need
   * to be completely reset. This operation cannot be undone.
   *
   * @param accountId - The unique identifier of the account whose preferences should be deleted
   * @returns Promise that resolves when deletion is complete
   * @throws {Error} When database operation fails or account access is denied
   *
   * @example
   * ```typescript
   * // Delete all preferences for an account
   * await preferencesService.deleteAccountPreferences(123);
   *
   * // Account will now have no preference entries in the database
   * // getAccountPreferences() will return default values
   * ```
   *
   * @warning This operation permanently deletes all preference data for the account.
   *
   */
  public async deleteAccountPreferences(accountId: number): Promise<void> {
    try {
      await preferencesDb.deleteAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `deleteAccountPreferences(${accountId})`);
    }
  }

  /**
   * Retrieves all accounts that have a specific email preference set to a given value.
   *
   * Queries the database for accounts where a specific email preference (like weeklyDigest
   * or marketingEmails) is set to the specified boolean value. Returns minimal account
   * information including account ID, name, and email address. Only returns accounts
   * with valid email addresses.
   *
   * @param preferenceKey - The specific email preference key to search for
   * @param value - The boolean value to match (defaults to true)
   * @returns Promise that resolves to an array of account references with the matching preference
   * @throws {Error} When database operation fails or invalid preference key is provided
   *
   * @example
   * ```typescript
   * // Get all accounts with weekly digest enabled
   * const accounts = await preferencesService.getAccountsWithEmailPreference('weeklyDigest', true);
   *
   * // Get all accounts with marketing emails disabled
   * const accounts = await preferencesService.getAccountsWithEmailPreference('marketingEmails', false);
   *
   * // Process the results
   * accounts.forEach(account => {
   *   console.log(`${account.name} (${account.email})`);
   * });
   * ```
   *
   */
  public async getAccountsWithEmailPreference(
    preferenceKey: keyof EmailPreferences,
    value: boolean = true,
  ): Promise<AccountReference[]> {
    try {
      return await preferencesDb.getAccountsWithEmailPreference(preferenceKey, value);
    } catch (error) {
      throw errorService.handleError(error, `getAccountsWithEmailPreference(${preferenceKey}, ${value})`);
    }
  }
}

/**
 * Singleton instance of the PreferencesService.
 *
 * This is the primary export that should be used throughout the application
 * to interact with user preferences. The singleton pattern ensures consistent
 * state and connection management across the application.
 *
 * @example
 * ```typescript
 * import { preferencesService } from './services/preferencesService';
 *
 * const preferences = await preferencesService.getAccountPreferences(123);
 * ```
 *
 */
export const preferencesService = new PreferencesService();
