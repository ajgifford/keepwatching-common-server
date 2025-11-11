import { setupDatabaseTest } from './helpers/dbTestSetup';
import { AccountReference, DEFAULT_PREFERENCES, EmailPreferences, PreferenceType } from '@ajgifford/keepwatching-types';
import {
  deleteAccountPreferences,
  getAccountPreferences,
  getAccountsWithEmailPreference,
  getPreferencesByType,
  initializeDefaultPreferences,
  updateMultiplePreferences,
  updatePreferences,
} from '@db/preferencesDb';
import { cliLogger } from '@logger/logger';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { ResultSetHeader } from 'mysql2/promise';

jest.mock('@logger/logger');
jest.mock('@utils/errorHandlingUtility');

describe('preferencesDb', () => {
  let mockExecute: jest.Mock;
  let mockQuery: jest.Mock;
  let mockLogger: jest.Mocked<typeof cliLogger>;
  let mockExecuteInTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockQuery = mocks.mockQuery;
    mockExecuteInTransaction = mocks.mockExecuteInTransaction;

    // Setup other mocks specific to this test
    mockLogger = cliLogger as jest.Mocked<typeof cliLogger>;

    jest.mocked(handleDatabaseError).mockImplementation((error, contextMessage) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error ${contextMessage}: ${errorMessage}`);
    });
  });

  describe('getAccountPreferences', () => {
    const accountId = 123;
    const mockPreferenceRows = [
      {
        account_id: accountId,
        preference_type: 'email',
        preferences: { weeklyDigest: true, marketingEmails: false },
      },
      {
        account_id: accountId,
        preference_type: 'notification',
        preferences: { newSeasonAlerts: true, newEpisodeAlerts: false },
      },
    ];

    it('should return complete account preferences with defaults for missing types', async () => {
      mockExecute.mockResolvedValueOnce([mockPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM account_preferences WHERE account_id = ?', [accountId]);

      expect(result).toEqual({
        email: { weeklyDigest: true, marketingEmails: false },
        notification: { newSeasonAlerts: true, newEpisodeAlerts: false },
        display: DEFAULT_PREFERENCES.display,
        privacy: DEFAULT_PREFERENCES.privacy,
      });
    });

    it('should return all default preferences when no preferences exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await getAccountPreferences(accountId);

      expect(result).toEqual(DEFAULT_PREFERENCES);
    });

    it('should handle preferences stored as JSON strings', async () => {
      const stringPreferenceRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: '{"weeklyDigest": true, "marketingEmails": false}',
        },
      ];
      mockExecute.mockResolvedValueOnce([stringPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(result.email).toEqual({ weeklyDigest: true, marketingEmails: false });
    });

    it('should handle invalid JSON gracefully and log errors', async () => {
      const invalidPreferenceRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: 'invalid json',
        },
      ];
      mockExecute.mockResolvedValueOnce([invalidPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to parse preference string:', expect.any(Error));
      expect(result.email).toEqual({});
    });

    it('should handle unexpected preference data types', async () => {
      const unexpectedPreferenceRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: null,
        },
      ];
      mockExecute.mockResolvedValueOnce([unexpectedPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unexpected preference data type:', 'object', null);
      expect(result.email).toEqual({});
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(getAccountPreferences(accountId)).rejects.toThrow(
        'Database error getting account preferences: Connection failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting account preferences');
    });
  });

  describe('getPreferencesByType', () => {
    const accountId = 123;
    const preferenceType: PreferenceType = 'email';

    it('should return preferences for existing type', async () => {
      const mockRow = {
        preferences: { weeklyDigest: true, marketingEmails: false },
      };
      mockExecute.mockResolvedValueOnce([[mockRow]]);

      const result = await getPreferencesByType<EmailPreferences>(accountId, preferenceType);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT preferences FROM account_preferences WHERE account_id = ? AND preference_type = ?',
        [accountId, preferenceType],
      );
      expect(result).toEqual({ weeklyDigest: true, marketingEmails: false });
    });

    it('should return default preferences when no preferences exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await getPreferencesByType<EmailPreferences>(accountId, preferenceType);

      expect(result).toEqual(DEFAULT_PREFERENCES.email);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(getPreferencesByType(accountId, preferenceType)).rejects.toThrow(
        'Database error getting account preferences by type: Connection failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting account preferences by type');
    });
  });

  describe('updatePreferences', () => {
    const accountId = 123;
    const preferenceType: PreferenceType = 'email';
    const updates = { weeklyDigest: false };

    it('should update preferences successfully', async () => {
      // Mock getPreferencesByType call within updatePreferences
      mockExecute
        .mockResolvedValueOnce([[{ preferences: { weeklyDigest: true, marketingEmails: false } }]]) // getPreferencesByType call
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // update call

      const result = await updatePreferences(accountId, preferenceType, updates);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO account_preferences'), [
        accountId,
        preferenceType,
        JSON.stringify({ weeklyDigest: false, marketingEmails: false }),
      ]);
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ preferences: { weeklyDigest: true, marketingEmails: false } }]])
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const result = await updatePreferences(accountId, preferenceType, updates);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Update failed');
      mockExecute
        .mockResolvedValueOnce([[{ preferences: { weeklyDigest: true, marketingEmails: false } }]])
        .mockRejectedValueOnce(dbError);

      await expect(updatePreferences(accountId, preferenceType, updates)).rejects.toThrow(
        'Database error updating account preferences: Update failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'updating account preferences');
    });
  });

  describe('updateMultiplePreferences', () => {
    const accountId = 123;
    const updates = {
      email: { weeklyDigest: false },
      notification: { newSeasonAlerts: true },
    };

    it('should update multiple preferences in transaction successfully', async () => {
      // Mock getPreferencesByType calls and INSERT queries
      mockExecute
        .mockResolvedValueOnce([[{ preferences: { weeklyDigest: true, marketingEmails: false } }]]) // getPreferencesByType for email
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // INSERT for email
        .mockResolvedValueOnce([[{ preferences: { newSeasonAlerts: false, newEpisodeAlerts: true } }]]) // getPreferencesByType for notification
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // INSERT for notification

      const result = await updateMultiplePreferences(accountId, updates);

      expect(mockExecuteInTransaction).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toBe(true);
    });

    it('should skip empty preference updates', async () => {
      const updatesWithEmpty = {
        email: { weeklyDigest: false },
        notification: {},
      };

      mockExecute
        .mockResolvedValueOnce([[{ preferences: { weeklyDigest: true, marketingEmails: false } }]]) // getPreferencesByType for email
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // INSERT for email

      await updateMultiplePreferences(accountId, updatesWithEmpty);

      // Should call execute twice: once for SELECT (getPreferencesByType) and once for INSERT, but not for notification since it's empty
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should handle transaction errors', async () => {
      const transactionError = new Error('Transaction failed');
      mockExecuteInTransaction.mockRejectedValueOnce(transactionError);

      await expect(updateMultiplePreferences(accountId, updates)).rejects.toThrow(
        'Database error updating multiple account preferences: Transaction failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(transactionError, 'updating multiple account preferences');
    });
  });

  describe('initializeDefaultPreferences', () => {
    const accountId = 123;

    it('should initialize default preferences successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 4 }]);

      await initializeDefaultPreferences(accountId);

      const expectedValues = Object.entries(DEFAULT_PREFERENCES).map(([type, prefs]) => [
        accountId,
        type,
        JSON.stringify(prefs),
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO account_preferences (account_id, preference_type, preferences) VALUES ?',
        [expectedValues],
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Insert failed');
      mockQuery.mockRejectedValueOnce(dbError);

      await expect(initializeDefaultPreferences(accountId)).rejects.toThrow(
        'Database error initializing default preferences: Insert failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'initializing default preferences');
    });
  });

  describe('deleteAccountPreferences', () => {
    const accountId = 123;

    it('should delete account preferences successfully', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 4 }]);

      await deleteAccountPreferences(accountId);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM account_preferences WHERE account_id = ?', [accountId]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Delete failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(deleteAccountPreferences(accountId)).rejects.toThrow(
        'Database error deleting account preferences: Delete failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'deleting account preferences');
    });
  });

  describe('getAccountsWithEmailPreference', () => {
    const preferenceKey: keyof EmailPreferences = 'weeklyDigest';
    const value = true;

    const mockAccountRows = [
      { account_id: 1, account_name: 'John Doe', email: 'john@example.com' },
      { account_id: 2, account_name: 'Jane Smith', email: 'jane@example.com' },
    ];

    const mockAccountReferences: AccountReference[] = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ];

    it('should return accounts with specific email preference', async () => {
      mockExecute.mockResolvedValueOnce([mockAccountRows]);

      const result = await getAccountsWithEmailPreference(preferenceKey, value);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("JSON_EXTRACT(ap.preferences, '$.weeklyDigest') = ?"),
        [value],
      );
      expect(result).toEqual(mockAccountReferences);
    });

    it('should default to true for preference value', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await getAccountsWithEmailPreference(preferenceKey);

      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [true]);
    });

    it('should handle different preference keys', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await getAccountsWithEmailPreference('marketingEmails', false);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("JSON_EXTRACT(ap.preferences, '$.marketingEmails') = ?"),
        [false],
      );
    });

    it('should return empty array when no accounts match', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await getAccountsWithEmailPreference(preferenceKey, value);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(getAccountsWithEmailPreference(preferenceKey, value)).rejects.toThrow(
        'Database error getting accounts with email preference weeklyDigest: Query failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'getting accounts with email preference weeklyDigest');
    });
  });

  describe('processPreferenceData (indirectly tested)', () => {
    const accountId = 123;

    it('should handle array preferences by logging warning and returning empty object', async () => {
      const arrayPreferenceRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: ['invalid', 'array'],
        },
      ];
      mockExecute.mockResolvedValueOnce([arrayPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unexpected preference data type:', 'object', ['invalid', 'array']);
      expect(result.email).toEqual({});
    });

    it('should handle number preferences by logging warning and returning empty object', async () => {
      const numberPreferenceRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: 123,
        },
      ];
      mockExecute.mockResolvedValueOnce([numberPreferenceRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unexpected preference data type:', 'number', 123);
      expect(result.email).toEqual({});
    });

    it('should handle parsed JSON that is not an object', async () => {
      const invalidJsonObjectRows = [
        {
          account_id: accountId,
          preference_type: 'email',
          preferences: '"string value"',
        },
      ];
      mockExecute.mockResolvedValueOnce([invalidJsonObjectRows]);

      const result = await getAccountPreferences(accountId);

      expect(mockLogger.error).toHaveBeenCalledWith('Parsed preference data is not an object:', 'string value');
      expect(result.email).toEqual({});
    });
  });
});
