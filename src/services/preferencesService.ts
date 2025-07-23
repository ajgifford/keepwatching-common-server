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

export class PreferencesService {
  public async getAccountPreferences(accountId: number): Promise<AccountPreferences> {
    try {
      return await preferencesDb.getAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `getAccountPreferences(${accountId}`);
    }
  }

  public async getPreferencesByType(accountId: number, preferenceType: PreferenceType): Promise<PreferenceData> {
    try {
      return await preferencesDb.getPreferencesByType(accountId, preferenceType);
    } catch (error) {
      throw errorService.handleError(error, `getPreferencesByType(${accountId}, ${preferenceType}`);
    }
  }

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
      throw errorService.handleError(error, `updatePreferences(${accountId}, ${preferenceType}`);
    }
  }

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
      throw errorService.handleError(error, `updateMultiplePreferences(${accountId}`);
    }
  }

  public async initializeDefaultPreferences(accountId: number): Promise<void> {
    try {
      await preferencesDb.initializeDefaultPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `initializeDefaultPreferences(${accountId}`);
    }
  }

  public async deleteAccountPreferences(accountId: number): Promise<void> {
    try {
      await preferencesDb.deleteAccountPreferences(accountId);
    } catch (error) {
      throw errorService.handleError(error, `deleteAccountPreferences(${accountId}`);
    }
  }

  public async getAccountsWithEmailPreference(
    preferenceKey: keyof EmailPreferences,
    value: boolean = true,
  ): Promise<AccountReference[]> {
    try {
      return await preferencesDb.getAccountsWithEmailPreference(preferenceKey, value);
    } catch (error) {
      throw errorService.handleError(error, `getAccountsWithEmailPreference(${preferenceKey}, ${value}`);
    }
  }
}

export const preferencesService = new PreferencesService();
