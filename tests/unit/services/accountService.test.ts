import * as accountsDb from '@db/accountsDb';
import { cliLogger, httpLogger } from '@logger/logger';
import { BadRequestError, ForbiddenError, NotFoundError } from '@middleware/errorMiddleware';
import { accountService } from '@services/accountService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { getFirebaseAdmin } from '@utils/firebaseUtil';
import { getAccountImage } from '@utils/imageUtility';
import { UserRecord } from 'firebase-admin/auth';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  httpLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@db/accountsDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@utils/imageUtility');
jest.mock('@utils/firebaseUtil');

type MockUserRecord = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
    lastRefreshTime: string | null;
  };
  providerData: any[]; // Add missing property
  toJSON: () => object; // Add missing method
};

function createMockUserRecord(data: Partial<MockUserRecord>): UserRecord {
  const defaultData: MockUserRecord = {
    uid: 'default-uid',
    email: 'default@example.com',
    emailVerified: false,
    displayName: null,
    photoURL: null,
    disabled: false,
    metadata: {
      creationTime: '2023-01-01',
      lastSignInTime: '2023-01-01',
      lastRefreshTime: null,
    },
    providerData: [],
    toJSON: () => ({}),
  };

  const mockData = { ...defaultData, ...data };
  return mockData as unknown as UserRecord;
}

describe('AccountService', () => {
  const mockCacheService = {
    invalidateAccount: jest.fn(),
  };

  const mockAccount = {
    account_id: 1,
    account_name: 'Test User',
    email: 'test@example.com',
    uid: 'test-uid-123',
    default_profile_id: 101,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(accountService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (errorService.assertExists as jest.Mock).mockImplementation((entity) => {
      if (!entity) throw new Error('Entity not found');
      return true;
    });

    (errorService.assertNotExists as jest.Mock).mockImplementation((entity, entityName, field, value) => {
      if (entity) throw new Error(`${entityName} with ${field} ${value} already exists`);
      return true;
    });

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    (getAccountImage as jest.Mock).mockReturnValue('account-image-url.jpg');
  });

  describe('editAccount', () => {
    const mockAccount = {
      id: 123,
      name: 'Original Account',
      email: 'test@example.com',
      uid: 'uid123',
      default_profile_id: 1,
    };

    const mockUpdatedAccount = {
      id: 123,
      name: 'Updated Account',
      email: 'test@example.com',
      uid: 'uid123',
      default_profile_id: 2,
    };

    it('should update an account successfully', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.editAccount as jest.Mock).mockResolvedValue(mockUpdatedAccount);

      const result = await accountService.editAccount(123, 'Updated Account', 2);

      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.editAccount).toHaveBeenCalledWith(123, 'Updated Account', 2);
      expect(result).toEqual({
        id: 123,
        name: 'Updated Account',
        email: 'test@example.com',
        image: 'account-image-url.jpg',
        default_profile_id: 2,
      });
    });

    it('should throw NotFoundError when account does not exist', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(null);

      await expect(accountService.editAccount(999, 'Test', 1)).rejects.toThrow(NotFoundError);
      expect(accountsDb.findAccountById).toHaveBeenCalledWith(999);
    });

    it('should throw BadRequestError when update fails', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.editAccount as jest.Mock).mockResolvedValue(null);

      await expect(accountService.editAccount(123, 'Updated Account', 2)).rejects.toThrow(BadRequestError);
      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.editAccount).toHaveBeenCalledWith(123, 'Updated Account', 2);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.editAccount as jest.Mock).mockRejectedValue(error);

      await expect(accountService.editAccount(123, 'Updated Account', 2)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'editAccount(123)');
    });
  });

  describe('login', () => {
    it('should successfully login an existing user', async () => {
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(mockAccount);

      const result = await accountService.login('test-uid-123');

      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('test-uid-123');
      expect(errorService.assertExists).toHaveBeenCalledWith(mockAccount, 'Account', 'test-uid-123');
      expect(httpLogger.info).toHaveBeenCalledWith('User logged in: test@example.com', { userId: 'test-uid-123' });
      expect(result).toEqual(mockAccount);
    });

    it('should throw error when user does not exist', async () => {
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new Error('Account not found');
      });

      await expect(accountService.login('nonexistent-uid')).rejects.toThrow('Account not found');
      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('nonexistent-uid');
      expect(errorService.assertExists).toHaveBeenCalledWith(null, 'Account', 'nonexistent-uid');
      expect(httpLogger.info).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during login', async () => {
      const dbError = new Error('Database connection failed');
      (accountsDb.findAccountByUID as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.login('test-uid-123')).rejects.toThrow('Database connection failed');
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'login(test-uid-123)');
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue(null);
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(null);
      (accountsDb.createAccount as jest.Mock).mockResolvedValue(null);

      const result = await accountService.register('Test User', 'test@example.com', 'new-uid-123');

      expect(accountsDb.findAccountByEmail).toHaveBeenCalledWith('test@example.com');
      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('new-uid-123');
      expect(accountsDb.createAccount).toHaveBeenCalledWith('Test User', 'test@example.com', 'new-uid-123');
      expect(accountsDb.registerAccount).toHaveBeenCalled();
      expect(httpLogger.info).toHaveBeenCalledWith('New user registered: test@example.com', { userId: 'new-uid-123' });
    });

    it('should throw error when email already exists', async () => {
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue(mockAccount);
      (errorService.assertNotExists as jest.Mock).mockImplementation(() => {
        throw new Error('Account with email test@example.com already exists');
      });

      await expect(accountService.register('Test User', 'test@example.com', 'new-uid-123')).rejects.toThrow(
        'Account with email test@example.com already exists',
      );

      expect(accountsDb.findAccountByEmail).toHaveBeenCalledWith('test@example.com');
      expect(errorService.assertNotExists).toHaveBeenCalledWith(mockAccount, 'Account', 'email', 'test@example.com');
      expect(accountsDb.findAccountByUID).not.toHaveBeenCalled();
    });

    it('should throw error when UID already exists', async () => {
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue(null);
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(mockAccount);
      (errorService.assertNotExists as jest.Mock)
        .mockImplementationOnce(() => true)
        .mockImplementationOnce(() => {
          throw new Error('Account with uid test-uid-123 already exists');
        });

      await expect(accountService.register('Test User', 'new@example.com', 'test-uid-123')).rejects.toThrow(
        'Account with uid test-uid-123 already exists',
      );

      expect(accountsDb.findAccountByEmail).toHaveBeenCalledWith('new@example.com');
      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('test-uid-123');
      expect(errorService.assertNotExists).toHaveBeenNthCalledWith(2, mockAccount, 'Account', 'uid', 'test-uid-123');
    });

    it('should handle registration failure', async () => {
      const registerError = new Error('Registration failed');
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue(null);
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(null);
      (accountsDb.registerAccount as jest.Mock).mockRejectedValue(registerError);

      await expect(accountService.register('Test User', 'test@example.com', 'new-uid-123')).rejects.toThrow(
        'Registration failed',
      );

      expect(accountsDb.registerAccount).toHaveBeenCalled();
      expect(errorService.handleError).toHaveBeenCalledWith(
        registerError,
        'register(Test User, test@example.com, new-uid-123)',
      );
    });
  });

  describe('googleLogin', () => {
    it('should login existing user with Google credentials', async () => {
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(mockAccount);

      const result = await accountService.googleLogin('Test User', 'test@example.com', 'test-uid-123');

      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('test-uid-123');
      expect(accountsDb.findAccountByEmail).not.toHaveBeenCalled();
      expect(httpLogger.info).toHaveBeenCalledWith('User logged in via Google: test@example.com', {
        userId: 'test-uid-123',
      });

      expect(result).toEqual({
        account: mockAccount,
        isNewAccount: false,
      });
    });

    it('should register new user with Google credentials', async () => {
      const mockNewAccount = {
        name: 'Google User',
        email: 'google@example.com',
        uid: 'new-google-uid',
      };

      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(null);
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue(null);
      (accountsDb.createAccount as jest.Mock).mockReturnValue(mockNewAccount);
      (accountsDb.registerAccount as jest.Mock).mockResolvedValue(null);

      const result = await accountService.googleLogin('Google User', 'google@example.com', 'new-google-uid');

      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('new-google-uid');
      expect(accountsDb.findAccountByEmail).toHaveBeenCalledWith('google@example.com');
      expect(accountsDb.createAccount).toHaveBeenCalledWith('Google User', 'google@example.com', 'new-google-uid');
      expect(accountsDb.registerAccount).toHaveBeenCalled();

      expect(result).toEqual({
        account: mockNewAccount,
        isNewAccount: true,
      });
    });

    it('should throw error when email is already registered with different auth', async () => {
      (accountsDb.findAccountByUID as jest.Mock).mockResolvedValue(null);
      (accountsDb.findAccountByEmail as jest.Mock).mockResolvedValue({
        ...mockAccount,
        uid: 'different-auth-uid',
      });

      await expect(accountService.googleLogin('Google User', 'test@example.com', 'google-uid-123')).rejects.toThrow(
        ForbiddenError,
      );

      expect(accountsDb.findAccountByUID).toHaveBeenCalledWith('google-uid-123');
      expect(accountsDb.findAccountByEmail).toHaveBeenCalledWith('test@example.com');
      expect(accountsDb.createAccount).not.toHaveBeenCalled();
    });

    it('should handle errors in Google login process', async () => {
      const dbError = new Error('Database error');
      (accountsDb.findAccountByUID as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.googleLogin('Google User', 'google@example.com', 'google-uid-123')).rejects.toThrow(
        'Database error',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        'googleLogin(Google User, google@example.com, google-uid-123)',
      );
    });
  });

  describe('logout', () => {
    it('should invalidate account cache on logout', async () => {
      await accountService.logout('1');

      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith('1');
      expect(cliLogger.info).toHaveBeenCalledWith('User logged out: account ID 1');
    });

    it('should handle errors during logout', async () => {
      const cacheError = new Error('Cache invalidation failed');
      mockCacheService.invalidateAccount.mockImplementation(() => {
        throw cacheError;
      });

      await expect(accountService.logout('1')).rejects.toThrow('Cache invalidation failed');
      expect(errorService.handleError).toHaveBeenCalledWith(cacheError, 'logout(1)');
    });
  });

  describe('findAccountById', () => {
    it('should return account with formatted image when account exists', async () => {
      const mockAccountData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test123',
        image: 'profile.jpg',
      };

      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccountData);

      const result = await accountService.findAccountById(1);

      expect(accountsDb.findAccountById).toHaveBeenCalledWith(1);
      expect(getAccountImage).toHaveBeenCalledWith('profile.jpg', 'Test User');
      expect(result).toEqual({
        ...mockAccountData,
        image: 'account-image-url.jpg', // This is the mocked return value from getAccountImage
      });
    });

    it('should return null when account does not exist', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(null);

      const result = await accountService.findAccountById(999);

      expect(accountsDb.findAccountById).toHaveBeenCalledWith(999);
      expect(getAccountImage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle and transform errors using errorService', async () => {
      const dbError = new Error('Database connection failed');
      (accountsDb.findAccountById as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.findAccountById(1)).rejects.toThrow('Database connection failed');
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'findAccountById(1)');
    });
  });

  describe('findAccountIdByProfileId', () => {
    it('should return account ID when profile exists', async () => {
      const profileId = '42';
      const accountId = 123;

      (accountsDb.findAccountIdByProfileId as jest.Mock).mockResolvedValue(accountId);

      const result = await accountService.findAccountIdByProfileId(profileId);

      expect(accountsDb.findAccountIdByProfileId).toHaveBeenCalledWith(profileId);
      expect(result).toBe(accountId);
    });

    it('should return null when profile does not exist', async () => {
      const profileId = '999';

      (accountsDb.findAccountIdByProfileId as jest.Mock).mockResolvedValue(null);

      const result = await accountService.findAccountIdByProfileId(profileId);

      expect(accountsDb.findAccountIdByProfileId).toHaveBeenCalledWith(profileId);
      expect(result).toBeNull();
    });

    it('should handle and transform errors using errorService', async () => {
      const profileId = '42';
      const dbError = new Error('Database error');

      (accountsDb.findAccountIdByProfileId as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.findAccountIdByProfileId(profileId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `findAccountIdByProfileId(${profileId})`);
    });
  });

  describe('updateAccountImage', () => {
    it('should update account image and return formatted account data', async () => {
      const accountId = 1;
      const imagePath = 'new-image.jpg';
      const updatedAccount = {
        id: accountId,
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test123',
        image: imagePath,
        default_profile_id: 5,
      };

      (accountsDb.updateAccountImage as jest.Mock).mockResolvedValue(updatedAccount);

      mockCacheService.invalidateAccount.mockImplementation(() => {
        return;
      });

      const result = await accountService.updateAccountImage(accountId, imagePath);

      expect(accountsDb.updateAccountImage).toHaveBeenCalledWith(accountId, imagePath);
      expect(getAccountImage).toHaveBeenCalledWith(imagePath, 'Test User');
      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith(accountId);
      expect(result).toEqual({
        id: accountId,
        name: 'Test User',
        email: 'test@example.com',
        image: 'account-image-url.jpg', // From the mock
        default_profile_id: 5,
      });
    });

    it('should throw error when account image update fails', async () => {
      const accountId = 1;
      const imagePath = 'new-image.jpg';

      (accountsDb.updateAccountImage as jest.Mock).mockResolvedValue(null);

      await expect(accountService.updateAccountImage(accountId, imagePath)).rejects.toThrow(
        'Failed to update image for account 1',
      );
      expect(accountsDb.updateAccountImage).toHaveBeenCalledWith(accountId, imagePath);
      expect(mockCacheService.invalidateAccount).not.toHaveBeenCalled();
    });

    it('should handle database errors using errorService', async () => {
      const accountId = 1;
      const imagePath = 'new-image.jpg';
      const dbError = new Error('Database error');

      (accountsDb.updateAccountImage as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.updateAccountImage(accountId, imagePath)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, `updateAccountImage(${accountId}, ${imagePath})`);
      expect(mockCacheService.invalidateAccount).not.toHaveBeenCalled();
    });
  });

  describe('getAccounts', () => {
    const mockDatabaseAccounts = [
      {
        account_id: 1,
        account_name: 'User One',
        email: 'user1@example.com',
        uid: 'uid1',
        default_profile_id: 101,
        image: 'db-image1.jpg',
        created_at: new Date('2023-01-01'),
      },
      {
        account_id: 2,
        account_name: 'User Two',
        email: 'user2@example.com',
        uid: 'uid2',
        default_profile_id: 201,
        image: null,
        created_at: new Date('2023-02-01'),
      },
    ];

    it('should return combined user data from Firebase and database', async () => {
      const mockUser1 = createMockUserRecord({
        uid: 'uid1',
        email: 'user1@example.com',
        emailVerified: true,
        displayName: 'User One',
        photoURL: 'photo1.jpg',
        metadata: {
          creationTime: '2023-01-01',
          lastSignInTime: '2023-01-10',
          lastRefreshTime: '2023-01-10',
        },
      });

      const mockUser2 = createMockUserRecord({
        uid: 'uid2',
        email: 'user2@example.com',
        emailVerified: false,
        displayName: 'User Two',
        photoURL: null,
        metadata: {
          creationTime: '2023-02-01',
          lastSignInTime: '2023-02-10',
          lastRefreshTime: null,
        },
      });

      const mockListUsersResult = {
        users: [mockUser1],
        pageToken: 'next-page-token',
      };

      const mockListUsersResult2 = {
        users: [mockUser2],
        pageToken: undefined,
      };

      const mockFirebaseAdmin = {
        auth: jest.fn().mockReturnValue({
          listUsers: jest.fn().mockResolvedValueOnce(mockListUsersResult).mockResolvedValueOnce(mockListUsersResult2),
        }),
      };
      (getFirebaseAdmin as jest.Mock).mockReturnValue(mockFirebaseAdmin);
      (accountsDb.getAccounts as jest.Mock).mockResolvedValue(mockDatabaseAccounts);

      const result = await accountService.getAccounts();

      expect(accountsDb.getAccounts).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        uid: 'uid1',
        email: 'user1@example.com',
        emailVerified: true,
        displayName: 'User One',
        photoURL: 'photo1.jpg',
        disabled: false,
        metadata: {
          creationTime: '2023-01-01',
          lastSignInTime: '2023-01-10',
          lastRefreshTime: '2023-01-10',
        },
        account_id: 1,
        account_name: 'User One',
        default_profile_id: 101,
        database_image: 'account-image-url.jpg',
        database_created_at: mockDatabaseAccounts[0].created_at,
      });
      expect(result[1]).toEqual({
        uid: 'uid2',
        email: 'user2@example.com',
        emailVerified: false,
        displayName: 'User Two',
        photoURL: null,
        disabled: false,
        metadata: {
          creationTime: '2023-02-01',
          lastSignInTime: '2023-02-10',
          lastRefreshTime: null,
        },
        account_id: 2,
        account_name: 'User Two',
        default_profile_id: 201,
        database_image: 'account-image-url.jpg',
        database_created_at: mockDatabaseAccounts[1].created_at,
      });
    });

    it('should handle errors during account retrieval', async () => {
      const mockError = new Error('Failed to retrieve accounts');
      const mockFirebaseAdmin = {
        auth: jest.fn().mockReturnValue({
          listUsers: jest.fn().mockRejectedValue(mockError),
        }),
      };
      (getFirebaseAdmin as jest.Mock).mockReturnValue(mockFirebaseAdmin);

      await expect(accountService.getAccounts()).rejects.toThrow('Failed to retrieve accounts');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getAccounts()');
    });
  });

  describe('deleteAccount', () => {
    const mockAccount = {
      id: 123,
      uid: 'firebase-uid-123',
      name: 'User to Delete',
      email: 'delete@example.com',
    };

    it('should delete an account successfully', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.deleteAccount as jest.Mock).mockResolvedValue(true);

      const mockFirebaseAdmin = {
        auth: jest.fn().mockReturnValue({
          deleteUser: jest.fn().mockResolvedValue(undefined),
        }),
      };
      (getFirebaseAdmin as jest.Mock).mockReturnValue(mockFirebaseAdmin);

      const result = await accountService.deleteAccount(123);

      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.deleteAccount).toHaveBeenCalledWith(123);
      expect(getFirebaseAdmin).toHaveBeenCalled();
      expect(mockFirebaseAdmin.auth().deleteUser).toHaveBeenCalledWith('firebase-uid-123');
      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith(123);
      expect(httpLogger.info).toHaveBeenCalledWith('Account deleted: delete@example.com', { accountId: 123 });
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when account does not exist', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(null);
      const notFoundError = new NotFoundError('Account with ID 999 not found');
      (errorService.handleError as jest.Mock).mockImplementation(() => {
        throw notFoundError;
      });

      await expect(accountService.deleteAccount(999)).rejects.toThrow(notFoundError);
      expect(accountsDb.findAccountById).toHaveBeenCalledWith(999);
      expect(accountsDb.deleteAccount).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateAccount).not.toHaveBeenCalled();
    });

    it('should still succeed when Firebase user deletion fails', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.deleteAccount as jest.Mock).mockResolvedValue(true);

      const firebaseError = new Error('Firebase user not found');
      const mockFirebaseAdmin = {
        auth: jest.fn().mockReturnValue({
          deleteUser: jest.fn().mockRejectedValue(firebaseError),
        }),
      };
      (getFirebaseAdmin as jest.Mock).mockReturnValue(mockFirebaseAdmin);

      const result = await accountService.deleteAccount(123);

      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.deleteAccount).toHaveBeenCalledWith(123);
      expect(getFirebaseAdmin).toHaveBeenCalled();
      expect(mockFirebaseAdmin.auth().deleteUser).toHaveBeenCalledWith('firebase-uid-123');
      expect(cliLogger.error).toHaveBeenCalledWith(`Error deleting Firebase user: firebase-uid-123`, firebaseError);
      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith(123);
      expect(result).toBe(true);
    });

    it('should throw error when database deletion fails', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      const dbError = new Error('Database deletion failed');
      (accountsDb.deleteAccount as jest.Mock).mockRejectedValue(dbError);

      await expect(accountService.deleteAccount(123)).rejects.toThrow('Database deletion failed');
      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.deleteAccount).toHaveBeenCalledWith(123);
      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'deleteAccount(123)');
    });

    it('should handle case when deleteAccount returns false', async () => {
      (accountsDb.findAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (accountsDb.deleteAccount as jest.Mock).mockResolvedValue(false);

      await expect(accountService.deleteAccount(123)).rejects.toThrow('Account deletion failed');
      expect(accountsDb.findAccountById).toHaveBeenCalledWith(123);
      expect(accountsDb.deleteAccount).toHaveBeenCalledWith(123);
      expect(mockCacheService.invalidateAccount).not.toHaveBeenCalled();
    });
  });
});
