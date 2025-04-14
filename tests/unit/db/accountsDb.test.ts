import * as accountsDb from '@db/accountsDb';
import { Account } from '@db/accountsDb';
import { CustomError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

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
        account_id: 1,
        default_profile_id: 101,
      });
    });

    it('should throw DatabaseError when the transaction fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const dbError = new Error('Database connection error');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(CustomError);
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the account insert fails', async () => {
      const testAccount: Account = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const dbError = new Error('Duplicate email');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(CustomError);
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
      };

      const accountInsertResult: [ResultSetHeader, any] = [
        { insertId: 1, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockExecute.mockResolvedValueOnce(accountInsertResult).mockRejectedValueOnce(new Error('Profile insert failed'));

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(CustomError);
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

      await expect(accountsDb.registerAccount(testAccount)).rejects.toThrow(CustomError);
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
      const accountId = 1;
      const newName = 'Updated Name';
      const newDefaultProfileId = 201;
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const mockAccount = {
        account_id: accountId,
        account_name: newName,
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: 'profile.jpg',
        default_profile_id: newDefaultProfileId,
      };

      const accountRows = [mockAccount as unknown as RowDataPacket];
      const accountQueryResult: [RowDataPacket[], any] = [accountRows, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce(accountQueryResult);

      const result = await accountsDb.editAccount(accountId, newName, newDefaultProfileId);

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(
        1,
        'UPDATE accounts SET account_name = ?, default_profile_id = ? WHERE account_id = ?',
        [newName, newDefaultProfileId, accountId],
      );
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [accountId]);
      expect(result).toEqual({
        id: accountId,
        name: newName,
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: 'profile.jpg',
        default_profile_id: newDefaultProfileId,
      });
    });

    it('should return null when no rows affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updatedAccount = await accountsDb.editAccount(1, 'Jane Doe', 20);

      expect(updatedAccount).toBeNull();
    });

    it('should throw error when edit account fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.editAccount(1, 'Jane Doe', 20)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when edit account fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.editAccount(1, 'Jane Doe', 23)).rejects.toThrow(
        'Unknown database error during account edit',
      );
    });
  });

  describe('updateAccountImage', () => {
    it('should update account image successfully', async () => {
      const accountId = 1;
      const imagePath = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const mockAccount = {
        account_id: accountId,
        account_name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: imagePath,
        default_profile_id: 101,
      };
      const accountRows = [mockAccount as unknown as RowDataPacket];
      const accountQueryResult: [RowDataPacket[], any] = [accountRows, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce(accountQueryResult);

      const result = await accountsDb.updateAccountImage(accountId, imagePath);

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [
        imagePath,
        accountId,
      ]);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [accountId]);
      expect(result).toEqual({
        id: accountId,
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: imagePath,
        default_profile_id: 101,
      });
    });

    it('should return null when no rows are affected (account not found)', async () => {
      const accountId = 999;
      const imagePath = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult);

      const result = await accountsDb.updateAccountImage(accountId, imagePath);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET image = ? WHERE account_id = ?', [
        imagePath,
        accountId,
      ]);
      expect(result).toBeNull();
    });

    it('should throw DatabaseError when the update query fails', async () => {
      const accountId = 1;
      const imagePath = 'path/to/new/image.jpg';
      const dbError = new Error('Database error');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(accountsDb.updateAccountImage(accountId, imagePath)).rejects.toThrow(CustomError);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE accounts SET image = ? WHERE account_id = ?', [
        imagePath,
        accountId,
      ]);
    });

    it('should throw DatabaseError when the select query fails', async () => {
      const accountId = 1;
      const imagePath = 'path/to/new/image.jpg';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockRejectedValueOnce(new Error('Select query failed'));

      await expect(accountsDb.updateAccountImage(accountId, imagePath)).rejects.toThrow(CustomError);

      expect(getDbPool).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [
        imagePath,
        accountId,
      ]);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT * FROM accounts WHERE account_id = ?', [accountId]);
    });

    it('should handle empty or null image paths', async () => {
      const accountId = 1;
      const imagePath = '';
      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const mockAccount = {
        account_id: accountId,
        account_name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: imagePath,
        default_profile_id: 101,
      };
      const accountRows = [mockAccount as unknown as RowDataPacket];
      const accountQueryResult: [RowDataPacket[], any] = [accountRows, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce(accountQueryResult);

      const result = await accountsDb.updateAccountImage(accountId, imagePath);

      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [
        '',
        accountId,
      ]);
      expect(result).toHaveProperty('image', '');
    });

    it('should handle image paths with special characters', async () => {
      const accountId = 1;
      const imagePath = 'path/to/image with spaces & special chars?.jpg';

      const updateResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];

      const mockAccount = {
        account_id: accountId,
        account_name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
        image: imagePath,
        default_profile_id: 101,
      };
      const accountRows = [mockAccount as unknown as RowDataPacket];
      const accountQueryResult: [RowDataPacket[], any] = [accountRows, undefined];

      mockExecute.mockResolvedValueOnce(updateResult).mockResolvedValueOnce(accountQueryResult);

      const result = await accountsDb.updateAccountImage(accountId, imagePath);

      expect(mockExecute).toHaveBeenNthCalledWith(1, 'UPDATE accounts SET image = ? WHERE account_id = ?', [
        imagePath,
        accountId,
      ]);
      expect(result).toHaveProperty('image', imagePath);
    });
  });

  describe('findByUID()', () => {
    it('should return an account object', async () => {
      const mockAccount = {
        account_id: 1,
        account_name: 'John Doe',
        email: 'john@example.com',
        uid: 'uid123',
        image: null,
        default_profile_id: 10,
      };

      mockPool.execute.mockResolvedValueOnce([[mockAccount] as RowDataPacket[]]);

      const account = await accountsDb.findAccountByUID('uid123');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE uid = ?', ['uid123']);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(1);
      expect(account?.name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

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
        'Unknown database error when finding account by UID',
      );
    });
  });

  describe('findByEmail()', () => {
    it('should return an account object', async () => {
      const mockAccount = {
        account_id: 1,
        account_name: 'John Doe',
        email: 'john@example.com',
        uid: 'uid123',
        image: null,
        default_profile_id: 10,
      };

      mockPool.execute.mockResolvedValueOnce([[mockAccount] as RowDataPacket[]]);

      const account = await accountsDb.findAccountByEmail('john@example.com');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE email = ?', ['john@example.com']);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(1);
      expect(account?.name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

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
        'Unknown database error when finding account by email',
      );
    });
  });

  describe('findById()', () => {
    it('should return an account object', async () => {
      const mockAccount = {
        account_id: 1,
        account_name: 'John Doe',
        email: 'john@example.com',
        uid: 'uid123',
        image: null,
        default_profile_id: 10,
      };

      mockPool.execute.mockResolvedValueOnce([[mockAccount] as RowDataPacket[]]);

      const account = await accountsDb.findAccountById(1);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM accounts WHERE account_id = ?', [1]);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(1);
      expect(account?.name).toBe('John Doe');
    });

    it('should return null when account not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

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

      await expect(accountsDb.findAccountById(1)).rejects.toThrow('Unknown database error when finding account by ID');
    });
  });

  describe('findAccountIdByProfileId()', () => {
    it('should return account ID', async () => {
      const mockProfile = {
        profile_id: 5,
        account_id: 1,
        name: 'Test Profile',
      };

      mockPool.execute.mockResolvedValueOnce([[mockProfile] as RowDataPacket[]]);

      const accountId = await accountsDb.findAccountIdByProfileId('5');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profiles where profile_id = ?', ['5']);
      expect(accountId).toBe(1);
    });

    it('should return null when profile not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const accountId = await accountsDb.findAccountIdByProfileId('999');

      expect(accountId).toBeNull();
    });

    it('should throw error when find by profile id fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValueOnce(mockError);

      await expect(accountsDb.findAccountIdByProfileId('5')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when find by profile id fails', async () => {
      mockPool.execute.mockRejectedValueOnce({});

      await expect(accountsDb.findAccountIdByProfileId('5')).rejects.toThrow(
        'Unknown database error when finding account ID by profile ID',
      );
    });
  });
});
