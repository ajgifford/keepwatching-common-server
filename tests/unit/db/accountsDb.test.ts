import { Account, UpdateAccountRequest } from '@ajgifford/keepwatching-types';
import * as accountsDb from '@db/accountsDb';
import { DatabaseError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});
jest.mock('@utils/transactionHelper');

describe('accountsDb Module', () => {
  let mockPool: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute = jest.fn();
    mockPool = {
      execute: mockExecute,
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);
  });

  describe('registerAccount()', () => {
    let mockConnection: any;
    let mockTransactionHelper: jest.Mocked<TransactionHelper>;

    beforeEach(() => {
      mockConnection = {
        execute: mockExecute,
      };

      mockTransactionHelper = {
        executeInTransaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockConnection);
        }),
      } as unknown as jest.Mocked<TransactionHelper>;

      (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
    });

    it('should register an account with a default profile successfully', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        id: 0,
        image: '',
        defaultProfileId: 0,
      };

      const accountInsertResult: [ResultSetHeader, any] = [
        { insertId: 1, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      const profileInsertResult: [ResultSetHeader, any] = [
        { insertId: 101, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute
        .mockResolvedValueOnce(accountInsertResult)
        .mockResolvedValueOnce(profileInsertResult)
        .mockResolvedValueOnce(updateResult);

      const result = await accountsDb.registerAccount(testAccount);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)',
        ['Test User', 'test@example.com', 'test-uid-123'],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'INSERT INTO profiles (account_id, name) VALUES (?,?)', [
        1,
        'Test User',
      ]);
      expect(mockExecute).toHaveBeenNthCalledWith(
        3,
        'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?',
        [101, 1],
      );
      expect(result).toEqual({
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: '',
        id: 1,
        defaultProfileId: 101,
      });
    });

    it('should throw DatabaseError when the transaction fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        id: 0,
        image: '',
        defaultProfileId: 0,
      };

      const dbError = new Error('Database connection error');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(DatabaseError);
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the account insert fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        id: 0,
        image: '',
        defaultProfileId: 0,
      };

      const dbError = new Error('Duplicate email');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(DatabaseError);
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)', [
        'Test User',
        'test@example.com',
        'test-uid-123',
      ]);
    });

    it('should throw DatabaseError when the profile insert fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        id: 0,
        image: '',
        defaultProfileId: 0,
      };

      const accountInsertResult: [ResultSetHeader, any] = [
        { insertId: 1, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockExecute.mockResolvedValueOnce(accountInsertResult).mockRejectedValueOnce(new Error('Profile insert failed'));

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(DatabaseError);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)',
        ['Test User', 'test@example.com', 'test-uid-123'],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'INSERT INTO profiles (account_id, name) VALUES (?,?)', [
        1,
        'Test User',
      ]);
    });

    it('should throw DatabaseError when the update default profile fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        id: 0,
        image: '',
        defaultProfileId: 0,
      };

      const accountInsertResult: [ResultSetHeader, any] = [
        { insertId: 1, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      const profileInsertResult: [ResultSetHeader, any] = [
        { insertId: 101, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockExecute
        .mockResolvedValueOnce(accountInsertResult)
        .mockResolvedValueOnce(profileInsertResult)
        .mockRejectedValueOnce(new Error('Update default profile failed'));

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(DatabaseError);
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(
        3,
        'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?',
        [101, 1],
      );
    });
  });

  describe('editAccount()', () => {
    it('should update account details', async () => {
      const id = 1;
      const name = 'Updated Name';
      const defaultProfileId = 201;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const dbAccount = [
        {
          account_id: id,
          account_name: name,
          email: 'test@example.com',
          uid: 'test-uid-123',
          image: 'profile.jpg',
          default_profile_id: defaultProfileId,
        },
      ];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce([dbAccount]);

      const accountData: UpdateAccountRequest = {
        id,
        name,
        defaultProfileId,
      };
      const result = await accountsDb.editAccount(accountData);

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'UPDATE accounts SET account_name = ?, default_profile_id = ? WHERE account_id = ?',
        [name, defaultProfileId, id],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [id]);
      expect(result).toEqual({
        id: id,
        name: name,
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: 'profile.jpg',
        defaultProfileId: defaultProfileId,
      });
    });

    it('should return null when no rows affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);
      const updatedAccount = await accountsDb.editAccount({ id: 1, name: 'Jane Doe', defaultProfileId: 20 });
      expect(updatedAccount).toBeNull();
    });

    it('should throw error when edit account fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);
      await expect(accountsDb.editAccount({ id: 1, name: 'Jane Doe', defaultProfileId: 20 })).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should throw error with default message when edit account fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});
      await expect(accountsDb.editAccount({ id: 1, name: 'Jane Doe', defaultProfileId: 23 })).rejects.toThrow(
        'Unknown database error editing an account',
      );
    });
  });

  describe('updateAccountImage', () => {
    it('should update account image successfully', async () => {
      const id = 1;
      const image = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const dbAccount = [
        {
          account_id: id,
          account_name: 'Test User',
          email: 'test@example.com',
          uid: 'test-uid-123',
          image: image,
          default_profile_id: 101,
        },
      ];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce([dbAccount]);

      const result = await accountsDb.updateAccountImage({ id, image });

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [image, id]);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [id]);
      expect(result).toEqual({
        id: id,
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: image,
        defaultProfileId: 101,
      });
    });

    it('should return null when no rows are affected (account not found)', async () => {
      const id = 999;
      const image = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateAccountImage({ id, image });

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET image = ? WHERE account_id = ?', [image, id]);
      expect(result).toBeNull();
    });

    it('should throw DatabaseError when the update query fails', async () => {
      const id = 1;
      const image = 'path/to/new/image.jpg';
      const dbError = new Error('Database error');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.updateAccountImage({ id, image })).rejects.toThrow(DatabaseError);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET image = ? WHERE account_id = ?', [image, id]);
    });

    it('should throw DatabaseError when the select query fails', async () => {
      const id = 1;
      const image = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockRejectedValueOnce(new Error('Select query failed'));

      await expect(accountsDb.updateAccountImage({ id, image })).rejects.toThrow(DatabaseError);

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [image, id]);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [id]);
    });

    it('should handle empty or null image paths', async () => {
      const id = 1;
      const image = '';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const dbAccount = [
        {
          account_id: id,
          account_name: 'Test User',
          email: 'test@example.com',
          uid: 'test-uid-123',
          image: image,
          default_profile_id: 101,
        },
      ];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce([dbAccount]);

      const result = await accountsDb.updateAccountImage({ id, image });

      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', ['', id]);
      expect(result).toHaveProperty('image', '');
    });

    it('should handle image paths with special characters', async () => {
      const id = 1;
      const image = 'path/to/image with spaces & special chars?.jpg';

      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const dbAccount = [
        {
          account_id: id,
          account_name: 'Test User',
          email: 'test@example.com',
          uid: 'test-uid-123',
          image: image,
          default_profile_id: 101,
        },
      ];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce([dbAccount]);

      const result = await accountsDb.updateAccountImage({ id, image });

      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [image, id]);
      expect(result).toHaveProperty('image', image);
    });
  });

  describe('findByUID()', () => {
    it('should return an account object', async () => {
      const mockAccount = [
        {
          account_id: 1,
          account_name: 'John Doe',
          email: 'john@example.com',
          uid: 'uid123',
          image: null,
          default_profile_id: 10,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockAccount]);

      const account = await accountsDb.findAccountByUID('uid123');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE uid = ?', ['uid123']);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(1);
      expect(account?.name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);
      const account = await accountsDb.findAccountByUID('unknown-uid');
      expect(account).toBeNull();
    });

    it('should throw error when find by UID fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.findAccountByUID('uid123')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when find by UID fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.findAccountByUID('uid123')).rejects.toThrow(
        'Unknown database error finding an account by UID',
      );
    });
  });

  describe('findByEmail()', () => {
    it('should return an account object', async () => {
      const mockAccount = [
        {
          account_id: 1,
          account_name: 'John Doe',
          email: 'john@example.com',
          uid: 'uid123',
          image: null,
          default_profile_id: 10,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockAccount]);

      const account = await accountsDb.findAccountByEmail('john@example.com');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE email = ?', ['john@example.com']);
      expect(account).not.toBeNull();
      expect(account?.account_id).toBe(1);
      expect(account?.account_name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);
      const account = await accountsDb.findAccountByEmail('unknown@example.com');
      expect(account).toBeNull();
    });

    it('should throw error when find by email fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.findAccountByEmail('john@example.com')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when find by email fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.findAccountByEmail('john@example.com')).rejects.toThrow(
        'Unknown database error finding an account by email',
      );
    });
  });

  describe('findById()', () => {
    it('should return an account object', async () => {
      const mockAccount = [
        {
          account_id: 1,
          account_name: 'John Doe',
          email: 'john@example.com',
          uid: 'uid123',
          image: null,
          default_profile_id: 10,
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockAccount]);

      const account = await accountsDb.findAccountById(1);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE account_id = ?', [1]);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(1);
      expect(account?.name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);
      const account = await accountsDb.findAccountById(999);
      expect(account).toBeNull();
    });

    it('should throw error when find by id fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.findAccountById(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when find by id fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.findAccountById(1)).rejects.toThrow('Unknown database error finding an account by id');
    });
  });

  describe('findAccountIdByProfileId()', () => {
    it('should return account ID', async () => {
      const mockProfile = [
        {
          profile_id: 5,
          account_id: 1,
          name: 'Test Profile',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockProfile]);

      const accountId = await accountsDb.findAccountIdByProfileId(5);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT account_id FROM profiles where profile_id = ?', [5]);
      expect(accountId).toBe(1);
    });

    it('should return null when profile not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const accountId = await accountsDb.findAccountIdByProfileId(999);

      expect(accountId).toBeNull();
    });

    it('should throw error when find by profile id fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.findAccountIdByProfileId(5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when find by profile id fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.findAccountIdByProfileId(5)).rejects.toThrow(
        'Unknown database error finding an account by profile id',
      );
    });
  });

  describe('getAccounts()', () => {
    it('should return all accounts', async () => {
      const mockAccounts = [
        {
          account_id: 1,
          account_name: 'John Doe',
          email: 'john@example.com',
          uid: 'uid123',
          image: null,
          default_profile_id: 10,
          created_at: new Date(),
        },
        {
          account_id: 2,
          account_name: 'Jane Doe',
          email: 'jane@example.com',
          uid: 'uid456',
          image: 'path/to/image.jpg',
          default_profile_id: 20,
          created_at: new Date(),
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockAccounts]);

      const accounts = await accountsDb.getAccounts();

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * from accounts');
      expect(accounts).toEqual(mockAccounts);
    });

    it('should throw error when getting accounts fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.getAccounts()).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting accounts fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.getAccounts()).rejects.toThrow('Unknown database error getting all accounts');
    });
  });

  describe('deleteAccount()', () => {
    let mockConnection: any;
    let mockTransactionHelper: jest.Mocked<TransactionHelper>;

    beforeEach(() => {
      mockConnection = {
        execute: jest.fn(),
      };

      mockTransactionHelper = {
        executeInTransaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockConnection);
        }),
      } as unknown as jest.Mocked<TransactionHelper>;

      (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
    });

    it('should delete an account successfully', async () => {
      const accountId = 1;
      mockConnection.execute
        .mockResolvedValueOnce([[{ uid: 'test-uid-123' }]]) // Find account query
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Delete query

      const result = await accountsDb.deleteAccount(accountId);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(1, 'SELECT * FROM accounts WHERE account_id = ?', [
        accountId,
      ]);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(2, 'DELETE FROM accounts WHERE account_id = ?', [
        accountId,
      ]);
      expect(result).toBe(true);
    });

    it('should return false when account not found', async () => {
      const accountId = 999;
      mockConnection.execute.mockResolvedValueOnce([[]]);

      const result = await accountsDb.deleteAccount(accountId);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE account_id = ?', [accountId]);
      expect(result).toBe(false);
    });

    it('should return false when no rows are affected by delete', async () => {
      const accountId = 1;
      mockConnection.execute
        .mockResolvedValueOnce([[{ uid: 'test-uid-123' }]])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await accountsDb.deleteAccount(accountId);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(result).toBe(false);
    });

    it('should throw DatabaseError when transaction fails', async () => {
      const accountId = 1;
      const dbError = new Error('Transaction failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValueOnce(dbError);

      await expect(accountsDb.deleteAccount(accountId)).rejects.toThrow('Transaction failed');
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateLastLogin()', () => {
    it('should update last login successfully', async () => {
      const uid = 'test-uid-123';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastLogin(uid);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET last_login = NOW() WHERE uid = ?', [uid]);
      expect(result).toBe(true);
    });

    it('should return false when no rows are affected (account not found)', async () => {
      const uid = 'nonexistent-uid';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastLogin(uid);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET last_login = NOW() WHERE uid = ?', [uid]);
      expect(result).toBe(false);
    });

    it('should throw DatabaseError when the update query fails', async () => {
      const uid = 'test-uid-123';
      const dbError = new Error('Database connection error');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.updateLastLogin(uid)).rejects.toThrow(DatabaseError);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET last_login = NOW() WHERE uid = ?', [uid]);
    });

    it('should handle empty uid string', async () => {
      const uid = '';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastLogin(uid);

      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET last_login = NOW() WHERE uid = ?', [uid]);
      expect(result).toBe(false);
    });
  });

  describe('updateLastActivity()', () => {
    it('should update last activity successfully with default throttle', async () => {
      const accountId = 1;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastActivity(accountId);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `\n      UPDATE accounts \n      SET last_activity = NOW() \n      WHERE account_id = ? \n        AND (last_activity IS NULL OR last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE))\n    `,
        [accountId, 5],
      );
      expect(result).toBe(true);
    });

    it('should update last activity successfully with custom throttle', async () => {
      const accountId = 1;
      const throttleMinutes = 10;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastActivity(accountId, throttleMinutes);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `\n      UPDATE accounts \n      SET last_activity = NOW() \n      WHERE account_id = ? \n        AND (last_activity IS NULL OR last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE))\n    `,
        [accountId, throttleMinutes],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows are affected (account not found or throttled)', async () => {
      const accountId = 999;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastActivity(accountId);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('should throw DatabaseError when the update query fails', async () => {
      const accountId = 1;
      const dbError = new Error('Database error');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.updateLastActivity(accountId)).rejects.toThrow(DatabaseError);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should handle zero throttle minutes', async () => {
      const accountId = 1;
      const throttleMinutes = 0;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastActivity(accountId, throttleMinutes);

      expect(mockExecute).toHaveBeenCalledWith(
        `\n      UPDATE accounts \n      SET last_activity = NOW() \n      WHERE account_id = ? \n        AND (last_activity IS NULL OR last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE))\n    `,
        [accountId, 0],
      );
      expect(result).toBe(true);
    });

    it('should handle large throttle values', async () => {
      const accountId = 1;
      const throttleMinutes = 1440; // 24 hours
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateLastActivity(accountId, throttleMinutes);

      expect(mockExecute).toHaveBeenCalledWith(
        `\n      UPDATE accounts \n      SET last_activity = NOW() \n      WHERE account_id = ? \n        AND (last_activity IS NULL OR last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE))\n    `,
        [accountId, 1440],
      );
      expect(result).toBe(true);
    });
  });
});
