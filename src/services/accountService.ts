import * as accountsDb from '../db/accountsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorMiddleware';
import { Account, CombinedUser, DatabaseAccount } from '../types/accountTypes';
import { getFirebaseAdmin } from '../utils/firebaseUtil';
import { getAccountImage } from '../utils/imageUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { socketService } from './socketService';
import { UserRecord } from 'firebase-admin/auth';

/**
 * Interface representing the response for a Google login operation,
 * which could be either a login to an existing account or creation of a new account
 */
export interface GoogleLoginResponse {
  account: Account;
  isNewAccount: boolean;
}

/**
 * Service class for handling account-related business logic
 */
export class AccountService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Authenticates a user by their UID
   *
   * @param uid - Firebase user ID
   * @returns The authenticated account
   * @throws {NotFoundError} If no account exists with the provided UID
   */
  public async login(uid: string): Promise<Account> {
    try {
      const account = await accountsDb.findAccountByUID(uid);
      errorService.assertExists(account, 'Account', uid);

      appLogger.info(`User logged in: ${account.email}`, { userId: account.uid });
      cliLogger.info(`User authenticated: ${account.email}`);

      return account;
    } catch (error) {
      throw errorService.handleError(error, `login(${uid})`);
    }
  }

  /**
   * Registers a new account with the provided details
   *
   * @param name - Display name for the account
   * @param email - Email address for the account
   * @param uid - Firebase user ID
   * @returns The newly created account
   * @throws {ConflictError} If an account with the provided email or uid already exists
   */
  public async register(name: string, email: string, uid: string): Promise<Account> {
    try {
      const existingAccountByEmail = await accountsDb.findAccountByEmail(email);
      errorService.assertNotExists(existingAccountByEmail, 'Account', 'email', email);

      const existingAccountByUID = await accountsDb.findAccountByUID(uid);
      errorService.assertNotExists(existingAccountByUID, 'Account', 'uid', uid);

      const account = accountsDb.createAccount(name, email, uid);
      await accountsDb.registerAccount(account);

      appLogger.info(`New user registered: ${email}`, { userId: uid });
      cliLogger.info(`New account created: ${email}`);

      return account;
    } catch (error) {
      throw errorService.handleError(error, `register(${name}, ${email}, ${uid})`);
    }
  }

  /**
   * Handles authentication via Google, either logging in an existing user
   * or creating a new account if the user doesn't exist
   *
   * @param name - Display name from Google profile
   * @param email - Email address from Google profile
   * @param uid - Firebase user ID
   * @returns Object containing the account and whether it was newly created
   */
  public async googleLogin(name: string, email: string, uid: string): Promise<GoogleLoginResponse> {
    try {
      const existingAccount = await accountsDb.findAccountByUID(uid);

      if (existingAccount) {
        appLogger.info(`User logged in via Google: ${existingAccount.email}`, { userId: existingAccount.uid });
        cliLogger.info(`Google authentication: existing user ${existingAccount.email}`);

        return {
          account: existingAccount,
          isNewAccount: false,
        };
      }

      const existingEmailAccount = await accountsDb.findAccountByEmail(email);
      if (existingEmailAccount) {
        throw new ForbiddenError(
          `An account with email ${email} already exists but is not linked to this Google account`,
        );
      }

      const newAccount = accountsDb.createAccount(name, email, uid);
      await accountsDb.registerAccount(newAccount);

      appLogger.info(`New user registered via Google: ${email}`, { userId: uid });
      cliLogger.info(`Google authentication: new account created for ${email}`);

      return {
        account: newAccount,
        isNewAccount: true,
      };
    } catch (error) {
      throw errorService.handleError(error, `googleLogin(${name}, ${email}, ${uid})`);
    }
  }

  /**
   * Logs out a user by invalidating their cache
   *
   * @param accountId - ID of the account being logged out
   */
  public async logout(accountId: string): Promise<void> {
    try {
      this.cache.invalidateAccount(accountId);
      const disconnectedCount = socketService.disconnectUserSockets(accountId);
      cliLogger.info(`User logged out: account ID ${accountId}`);
    } catch (error) {
      throw errorService.handleError(error, `logout(${accountId})`);
    }
  }

  public async getAccounts(): Promise<CombinedUser[]> {
    try {
      const users = await this.getAllUsers();
      const accounts = await accountsDb.getAccounts();
      return await this.combineUserData(users, accounts);
    } catch (error) {
      throw errorService.handleError(error, `getAccounts()`);
    }
  }

  /**
   * Updates an account's details (name and default profile)
   *
   * @param accountId - ID of the account to update
   * @param name - New name for the account
   * @param defaultProfileId - ID of the profile to set as default
   * @returns Updated account information
   * @throws {NotFoundError} If the account is not found
   * @throws {BadRequestError} If the account update fails
   */
  public async editAccount(accountId: number, name: string, defaultProfileId: number) {
    try {
      const account = await accountsDb.findAccountById(accountId);
      if (!account) {
        throw new NotFoundError('Account not found');
      }

      const updatedAccount = await accountsDb.editAccount(accountId, name, defaultProfileId);
      if (!updatedAccount) {
        throw new BadRequestError('Failed to update the account');
      }

      return {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        image: getAccountImage(updatedAccount.image, updatedAccount.name),
        default_profile_id: updatedAccount.default_profile_id,
      };
    } catch (error) {
      throw errorService.handleError(error, `editAccount(${accountId})`);
    }
  }

  /**
   * Deletes an account and all its associated data
   *
   * This method handles the complete account deletion process, including:
   * 1. Deleting the account from the database (with cascading deletions for profiles, watch status, etc.)
   * 2. Deleting the user from Firebase Authentication if available
   * 3. Invalidating all cache entries for the account
   *
   * @param accountId - ID of the account to delete
   * @returns True if the account was successfully deleted
   * @throws {NotFoundError} If the account doesn't exist
   * @throws {Error} If deletion from Firebase Authentication fails
   */
  public async deleteAccount(accountId: number): Promise<boolean> {
    try {
      const account = await accountsDb.findAccountById(accountId);
      if (!account) {
        throw new NotFoundError(`Account with ID ${accountId} not found`);
      }

      const deleted = await accountsDb.deleteAccount(accountId);
      if (!deleted) {
        throw new Error('Account deletion failed');
      }

      if (account.uid) {
        try {
          const admin = getFirebaseAdmin();
          await admin.auth().deleteUser(account.uid);
          cliLogger.info(`Firebase user deleted: ${account.uid}`);
        } catch (firebaseError) {
          cliLogger.error(`Error deleting Firebase user: ${account.uid}`, firebaseError);
          appLogger.error('Firebase user deletion failed', { error: firebaseError, uid: account.uid });
        }
      }

      // Invalidate cache for this account
      this.cache.invalidateAccount(accountId);

      appLogger.info(`Account deleted: ${account.email}`, { accountId });
      cliLogger.info(`Account deleted: ${account.email}`);

      return true;
    } catch (error) {
      throw errorService.handleError(error, `deleteAccount(${accountId})`);
    }
  }

  /**
   * Find account by its ID
   *
   * @param accountId - ID of the account to find
   * @returns Account information or null if not found
   * @throws Error if the database operation fails
   */
  public async findAccountById(accountId: number): Promise<Account | null> {
    try {
      const account = await accountsDb.findAccountById(accountId);

      if (!account) {
        return null;
      }

      return {
        ...account,
        image: getAccountImage(account.image, account.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `findAccountById(${accountId})`);
    }
  }

  /**
   * Find the account ID associated with a profile
   *
   * @param profileId - ID of the profile to look up
   * @returns Account ID if found, null otherwise
   * @throws Error if the database operation fails
   */
  public async findAccountIdByProfileId(profileId: string): Promise<number | null> {
    try {
      return await accountsDb.findAccountIdByProfileId(profileId);
    } catch (error) {
      throw errorService.handleError(error, `findAccountIdByProfileId(${profileId})`);
    }
  }

  /**
   * Update an account's profile image
   *
   * @param accountId - ID of the account to update
   * @param imagePath - Path to the new image file
   * @returns Updated account information
   * @throws NotFoundError if account not found
   * @throws BadRequestError if image update fails
   * @throws Error for other database errors
   */
  public async updateAccountImage(accountId: number, imagePath: string) {
    try {
      const updatedAccount = await accountsDb.updateAccountImage(accountId, imagePath);

      if (!updatedAccount) {
        throw new Error(`Failed to update image for account ${accountId}`);
      }

      // Invalidate cache if CacheService is used
      this.cache.invalidateAccount(accountId);

      return {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        image: getAccountImage(updatedAccount.image, updatedAccount.name),
        default_profile_id: updatedAccount.default_profile_id,
      };
    } catch (error) {
      throw errorService.handleError(error, `updateAccountImage(${accountId}, ${imagePath})`);
    }
  }

  private async getAllUsers(): Promise<any[]> {
    let nextPageToken: string | undefined;
    let allUsers: UserRecord[] = [];

    try {
      do {
        const admin = getFirebaseAdmin();
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
        allUsers = allUsers.concat(listUsersResult.users);
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);
      return allUsers;
    } catch (error) {
      throw error;
    }
  }

  private async combineUserData(
    firebaseUsers: UserRecord[],
    databaseAccounts: DatabaseAccount[],
  ): Promise<CombinedUser[]> {
    const accountMap = new Map(databaseAccounts.map((account) => [account.uid, account]));
    const combinedUsers = firebaseUsers
      .filter((firebaseUser) => accountMap.has(firebaseUser.uid))
      .map((firebaseUser) => {
        const dbAccount = accountMap.get(firebaseUser.uid)!;

        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || null,
          emailVerified: firebaseUser.emailVerified,
          displayName: firebaseUser.displayName || null,
          photoURL: firebaseUser.photoURL || null,
          disabled: firebaseUser.disabled,
          metadata: {
            creationTime: firebaseUser.metadata.creationTime,
            lastSignInTime: firebaseUser.metadata.lastSignInTime,
            lastRefreshTime: firebaseUser.metadata.lastRefreshTime || null,
          },
          account_id: dbAccount.account_id,
          account_name: dbAccount.account_name,
          default_profile_id: dbAccount.default_profile_id,
          database_image: getAccountImage(dbAccount.image, dbAccount.account_name),
          database_created_at: dbAccount.created_at,
        };
      });

    return combinedUsers;
  }
}

export const accountService = new AccountService();
