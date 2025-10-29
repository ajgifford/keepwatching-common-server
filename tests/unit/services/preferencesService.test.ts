import {
  AccountPreferences,
  AccountReference,
  EmailPreferences,
  PreferenceType,
  TypedPreferenceUpdate,
} from '@ajgifford/keepwatching-types';
import * as preferencesDb from '@db/preferencesDb';
import { NoAffectedRowsError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { PreferencesService } from '@services/preferencesService';

// Mock the database module
jest.mock('@db/preferencesDb');
jest.mock('@services/errorService');

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PreferencesService();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getAccountPreferences', () => {
    const mockAccountPreferences: AccountPreferences = {
      email: {
        weeklyDigest: true,
        marketingEmails: false,
      },
      notification: {
        newSeasonAlerts: true,
        newEpisodeAlerts: true,
      },
      display: {
        theme: 'dark',
        dateFormat: 'DD/MM/YYYY',
      },
      privacy: {
        allowRecommendations: true,
        dataCollection: false,
      },
    };

    it('should return account preferences successfully', async () => {
      const accountId = 123;
      (preferencesDb.getAccountPreferences as jest.Mock).mockResolvedValue(mockAccountPreferences);

      const result = await service.getAccountPreferences(accountId);

      expect(result).toEqual(mockAccountPreferences);
      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledWith(accountId);
      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const accountId = 123;
      const dbError = new Error('Database connection failed');

      (preferencesDb.getAccountPreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getAccountPreferences(accountId)).rejects.toThrow(dbError);

      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledWith(accountId);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `getAccountPreferences(${accountId})`);
    });
  });

  describe('getPreferencesByType', () => {
    const mockEmailPreferences: EmailPreferences = {
      weeklyDigest: true,
      marketingEmails: false,
    };

    it('should return preferences by type successfully', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';

      (preferencesDb.getPreferencesByType as jest.Mock).mockResolvedValue(mockEmailPreferences);

      const result = await service.getPreferencesByType(accountId, preferenceType);

      expect(result).toEqual(mockEmailPreferences);
      expect(preferencesDb.getPreferencesByType).toHaveBeenCalledWith(accountId, preferenceType);
      expect(preferencesDb.getPreferencesByType).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';
      const dbError = new Error('Database error');

      (preferencesDb.getPreferencesByType as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getPreferencesByType(accountId, preferenceType)).rejects.toThrow(dbError);

      expect(preferencesDb.getPreferencesByType).toHaveBeenCalledWith(accountId, preferenceType);
      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getPreferencesByType(${accountId}, ${preferenceType})`,
      );
    });
  });

  describe('updatePreferences', () => {
    const mockAccountPreferences: AccountPreferences = {
      email: {
        weeklyDigest: false,
        marketingEmails: false,
      },
      notification: {
        newEpisodeAlerts: true,
      },
      display: {
        theme: 'dark',
      },
      privacy: {
        dataCollection: true,
      },
    };

    it('should update preferences successfully', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';
      const updates = { weeklyDigest: false };

      (preferencesDb.updatePreferences as jest.Mock).mockResolvedValue(true);
      (preferencesDb.getAccountPreferences as jest.Mock).mockResolvedValue(mockAccountPreferences);

      const result = await service.updatePreferences(accountId, preferenceType, updates);

      expect(result).toEqual(mockAccountPreferences);
      expect(preferencesDb.updatePreferences).toHaveBeenCalledWith(accountId, preferenceType, updates);
      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledWith(accountId);
    });

    it('should throw NoAffectedRowsError when no rows are updated', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';
      const updates = { weeklyDigest: false };

      (preferencesDb.updatePreferences as jest.Mock).mockResolvedValue(false);

      await expect(service.updatePreferences(accountId, preferenceType, updates)).rejects.toThrow(NoAffectedRowsError);

      expect(preferencesDb.updatePreferences).toHaveBeenCalledWith(accountId, preferenceType, updates);
      expect(preferencesDb.getAccountPreferences).not.toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';
      const updates = { weeklyDigest: false };
      const dbError = new Error('Update failed');

      (preferencesDb.updatePreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.updatePreferences(accountId, preferenceType, updates)).rejects.toThrow(dbError);

      expect(preferencesDb.updatePreferences).toHaveBeenCalledWith(accountId, preferenceType, updates);
      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `updatePreferences(${accountId}, ${preferenceType})`,
      );
    });

    it('should handle database errors during getAccountPreferences', async () => {
      const accountId = 123;
      const preferenceType: PreferenceType = 'email';
      const updates = { weeklyDigest: false };
      const dbError = new Error('Get preferences failed');

      (preferencesDb.updatePreferences as jest.Mock).mockResolvedValue(true);
      (preferencesDb.getAccountPreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.updatePreferences(accountId, preferenceType, updates)).rejects.toThrow(dbError);

      expect(preferencesDb.updatePreferences).toHaveBeenCalledWith(accountId, preferenceType, updates);
      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledWith(accountId);
      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `updatePreferences(${accountId}, ${preferenceType})`,
      );
    });
  });

  describe('updateMultiplePreferences', () => {
    const mockAccountPreferences: AccountPreferences = {
      email: {
        weeklyDigest: true,
        marketingEmails: false,
      },
      notification: {
        newEpisodeAlerts: true,
      },
      display: {
        theme: 'dark',
      },
      privacy: {
        dataCollection: true,
      },
    };

    it('should update multiple preferences successfully', async () => {
      const accountId = 123;
      const updates: Partial<TypedPreferenceUpdate> = {
        email: { weeklyDigest: true },
        display: { theme: 'dark' },
      };

      (preferencesDb.updateMultiplePreferences as jest.Mock).mockResolvedValue(true);
      (preferencesDb.getAccountPreferences as jest.Mock).mockResolvedValue(mockAccountPreferences);

      const result = await service.updateMultiplePreferences(accountId, updates);

      expect(result).toEqual(mockAccountPreferences);
      expect(preferencesDb.updateMultiplePreferences).toHaveBeenCalledWith(accountId, updates);
      expect(preferencesDb.getAccountPreferences).toHaveBeenCalledWith(accountId);
    });

    it('should throw NoAffectedRowsError when no rows are updated', async () => {
      const accountId = 123;
      const updates: Partial<TypedPreferenceUpdate> = {
        email: { weeklyDigest: true },
      };

      (preferencesDb.updateMultiplePreferences as jest.Mock).mockResolvedValue(false);

      await expect(service.updateMultiplePreferences(accountId, updates)).rejects.toThrow(NoAffectedRowsError);

      expect(preferencesDb.updateMultiplePreferences).toHaveBeenCalledWith(accountId, updates);
      expect(preferencesDb.getAccountPreferences).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const accountId = 123;
      const updates: Partial<TypedPreferenceUpdate> = {
        email: { weeklyDigest: true },
      };
      const dbError = new Error('Multiple update failed');

      (preferencesDb.updateMultiplePreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.updateMultiplePreferences(accountId, updates)).rejects.toThrow(dbError);

      expect(preferencesDb.updateMultiplePreferences).toHaveBeenCalledWith(accountId, updates);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `updateMultiplePreferences(${accountId})`);
    });
  });

  describe('initializeDefaultPreferences', () => {
    it('should initialize default preferences successfully', async () => {
      const accountId = 123;

      (preferencesDb.initializeDefaultPreferences as jest.Mock).mockResolvedValue(accountId);

      await service.initializeDefaultPreferences(accountId);

      expect(preferencesDb.initializeDefaultPreferences).toHaveBeenCalledWith(accountId);
      expect(preferencesDb.initializeDefaultPreferences).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const accountId = 123;
      const dbError = new Error('Initialize failed');

      (preferencesDb.initializeDefaultPreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.initializeDefaultPreferences(accountId)).rejects.toThrow(dbError);

      expect(preferencesDb.initializeDefaultPreferences).toHaveBeenCalledWith(accountId);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `initializeDefaultPreferences(${accountId})`);
    });
  });

  describe('deleteAccountPreferences', () => {
    it('should delete account preferences successfully', async () => {
      const accountId = 123;

      (preferencesDb.deleteAccountPreferences as jest.Mock).mockResolvedValue(accountId);

      await service.deleteAccountPreferences(accountId);

      expect(preferencesDb.deleteAccountPreferences).toHaveBeenCalledWith(accountId);
      expect(preferencesDb.deleteAccountPreferences).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const accountId = 123;
      const dbError = new Error('Delete failed');

      (preferencesDb.deleteAccountPreferences as jest.Mock).mockRejectedValue(dbError);

      await expect(service.deleteAccountPreferences(accountId)).rejects.toThrow(dbError);

      expect(preferencesDb.deleteAccountPreferences).toHaveBeenCalledWith(accountId);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `deleteAccountPreferences(${accountId})`);
    });
  });

  describe('getAccountsWithEmailPreference', () => {
    const mockAccountReferences: AccountReference[] = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    ];

    it('should return accounts with email preference successfully (default value true)', async () => {
      const preferenceKey: keyof EmailPreferences = 'weeklyDigest';

      (preferencesDb.getAccountsWithEmailPreference as jest.Mock).mockResolvedValue(mockAccountReferences);

      const result = await service.getAccountsWithEmailPreference(preferenceKey);

      expect(result).toEqual(mockAccountReferences);
      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledWith(preferenceKey, true);
      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledTimes(1);
    });

    it('should return accounts with email preference successfully (explicit value false)', async () => {
      const preferenceKey: keyof EmailPreferences = 'marketingEmails';
      const value = false;

      (preferencesDb.getAccountsWithEmailPreference as jest.Mock).mockResolvedValue(mockAccountReferences);

      const result = await service.getAccountsWithEmailPreference(preferenceKey, value);

      expect(result).toEqual(mockAccountReferences);
      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledWith(preferenceKey, value);
      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no accounts match', async () => {
      const preferenceKey: keyof EmailPreferences = 'weeklyDigest';

      (preferencesDb.getAccountsWithEmailPreference as jest.Mock).mockResolvedValue([]);

      const result = await service.getAccountsWithEmailPreference(preferenceKey);

      expect(result).toEqual([]);
      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledWith(preferenceKey, true);
    });

    it('should handle database errors', async () => {
      const preferenceKey: keyof EmailPreferences = 'weeklyDigest';
      const value = true;
      const dbError = new Error('Query failed');

      (preferencesDb.getAccountsWithEmailPreference as jest.Mock).mockRejectedValue(dbError);

      await expect(service.getAccountsWithEmailPreference(preferenceKey, value)).rejects.toThrow(dbError);

      expect(preferencesDb.getAccountsWithEmailPreference).toHaveBeenCalledWith(preferenceKey, value);
      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getAccountsWithEmailPreference(${preferenceKey}, ${value})`,
      );
    });
  });

  describe('error handling consistency', () => {
    it('should handle all errors through errorService.handleError', async () => {
      const accountId = 123;
      const dbError = new Error('Test error');
      const handledError = new Error('Handled error');

      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      // Test all methods that use errorService.handleError
      const testCases = [
        () => {
          (preferencesDb.getAccountPreferences as jest.Mock).mockRejectedValue(dbError);
          return service.getAccountPreferences(accountId);
        },
        () => {
          (preferencesDb.getPreferencesByType as jest.Mock).mockRejectedValue(dbError);
          return service.getPreferencesByType(accountId, 'email');
        },
        () => {
          (preferencesDb.updatePreferences as jest.Mock).mockRejectedValue(dbError);
          return service.updatePreferences(accountId, 'email', {});
        },
        () => {
          (preferencesDb.updateMultiplePreferences as jest.Mock).mockRejectedValue(dbError);
          return service.updateMultiplePreferences(accountId, {});
        },
        () => {
          (preferencesDb.initializeDefaultPreferences as jest.Mock).mockRejectedValue(dbError);
          return service.initializeDefaultPreferences(accountId);
        },
        () => {
          (preferencesDb.deleteAccountPreferences as jest.Mock).mockRejectedValue(dbError);
          return service.deleteAccountPreferences(accountId);
        },
        () => {
          (preferencesDb.getAccountsWithEmailPreference as jest.Mock).mockRejectedValue(dbError);
          return service.getAccountsWithEmailPreference('weeklyDigest');
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        await expect(testCase()).rejects.toThrow(handledError);
        expect(errorService.handleError).toHaveBeenCalledWith(dbError, expect.stringContaining('('));
      }
    });
  });
});
