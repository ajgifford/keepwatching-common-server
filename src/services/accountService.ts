import { getActivityTrackingConfig, getServiceName } from '../config/config';
import * as accountsDb from '../db/accountsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { BadRequestError, FirebaseError, ForbiddenError, NotFoundError } from '../middleware/errorMiddleware';
import { AccountRow } from '../types/accountTypes';
import { getFirebaseAdmin } from '../utils/firebaseUtil';
import { getAccountImage, getPhotoForGoogleAccount } from '../utils/imageUtility';
import { CacheService } from './cacheService';
import { emailService } from './emailService';
import { errorService } from './errorService';
import { preferencesService } from './preferencesService';
import { profileService } from './profileService';
import { socketService } from './socketService';
import { Account, CombinedAccount, CreateAccountRequest, UpdateAccountRequest } from '@ajgifford/keepwatching-types';
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
  private serviceName: string;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
    this.serviceName = getServiceName();
  }

  public async invalidateAccountCache(accountId: number): Promise<void> {
    this.cache.invalidateAccount(accountId);

    const profiles = await profileService.getProfilesByAccountId(accountId);
    for (const profile of profiles) {
      this.cache.invalidateProfile(profile.id);
    }
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

      await accountsDb.updateLastLogin(uid);

      appLogger.info(`User logged in: ${account.email}`, { userId: account.uid });
      cliLogger.info(`User authenticated: ${account.email}`);

      return {
        ...account,
        image: getAccountImage(account.image, account.name),
      };
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

      const accountData: CreateAccountRequest = {
        name,
        email,
        uid,
      };

      const account = await accountsDb.registerAccount(accountData);

      await accountsDb.updateLastLogin(uid);

      appLogger.info(`New user registered: ${email}`, { userId: uid });
      cliLogger.info(`New account created: ${email}`);

      await preferencesService.initializeDefaultPreferences(account.id);

      // Send welcome email asynchronously (don't await to avoid blocking registration)
      emailService.sendWelcomeEmail(email).catch((error) => {
        appLogger.error(`Failed to send welcome email to ${email}`, { error });
      });

      return {
        ...account,
        image: getAccountImage(account.image, account.name),
      };
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
  public async googleLogin(
    name: string,
    email: string,
    uid: string,
    photoURL: string | undefined,
  ): Promise<GoogleLoginResponse> {
    try {
      const existingAccount = await accountsDb.findAccountByUID(uid);

      if (existingAccount) {
        await accountsDb.updateLastLogin(uid);

        appLogger.info(`User logged in via Google: ${existingAccount.email}`, { userId: existingAccount.uid });
        cliLogger.info(`Google authentication: existing user ${existingAccount.email}`);

        return {
          account: {
            ...existingAccount,
            image: getPhotoForGoogleAccount(existingAccount.name, photoURL, existingAccount.image),
          },
          isNewAccount: false,
        };
      }

      const existingEmailAccount = await accountsDb.findAccountByEmail(email);
      if (existingEmailAccount) {
        throw new ForbiddenError(
          `An account with email ${email} already exists but is not linked to this Google account`,
        );
      }

      const accountData: CreateAccountRequest = {
        name,
        email,
        uid,
      };

      const newAccount = await accountsDb.registerAccount(accountData);

      await accountsDb.updateLastLogin(uid);

      appLogger.info(`New user registered via Google: ${email}`, { userId: uid });
      cliLogger.info(`Google authentication: new account created for ${email}`);

      await preferencesService.initializeDefaultPreferences(newAccount.id);

      // Send welcome email asynchronously (don't await to avoid blocking registration)
      emailService.sendWelcomeEmail(email).catch((error) => {
        appLogger.error(`Failed to send welcome email to ${email}`, { error });
      });

      return {
        account: { ...newAccount, image: getPhotoForGoogleAccount(newAccount.name, photoURL, newAccount.image) },
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
  public async logout(accountId: number): Promise<void> {
    try {
      this.invalidateAccountCache(accountId);
      socketService.disconnectUserSockets(accountId);
      cliLogger.info(`User logged out: account ID ${accountId}`);
    } catch (error) {
      throw errorService.handleError(error, `logout(${accountId})`);
    }
  }

  /**
   * Get all accounts
   * @returns all accounts
   */
  public async getAccounts(): Promise<CombinedAccount[]> {
    try {
      const users = await this.getAllUsers();
      const accounts = await accountsDb.getAccounts();
      return this.combineUserData(users, accounts);
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
  public async editAccount(accountId: number, name: string, defaultProfileId: number): Promise<Account> {
    try {
      const account = await accountsDb.findAccountById(accountId);
      if (!account) {
        throw new NotFoundError('Account not found');
      }

      const accountData: UpdateAccountRequest = {
        id: accountId,
        name,
        defaultProfileId,
      };

      const updatedAccount = await accountsDb.editAccount(accountData);
      if (!updatedAccount) {
        throw new BadRequestError('Failed to update the account');
      }

      return {
        ...updatedAccount,
        image: getAccountImage(updatedAccount.image, updatedAccount.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `editAccount(${accountId})`);
    }
  }

  /**
   * Update an account's profile image
   *
   * @param id - ID of the account to update
   * @param image - Path to the new image file
   * @returns Updated account information
   * @throws NotFoundError if account not found
   * @throws BadRequestError if image update fails
   * @throws Error for other database errors
   */
  public async updateAccountImage(id: number, image: string | null): Promise<Account> {
    try {
      const updatedAccount = await accountsDb.updateAccountImage({ id, image });

      if (!updatedAccount) {
        throw new Error(`Failed to update image for account ${id}`);
      }

      return {
        ...updatedAccount,
        image: getAccountImage(updatedAccount.image, updatedAccount.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateAccountImage(${id}, ${image})`);
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
          await this.getAdmin().auth().deleteUser(account.uid);
          cliLogger.info(`Firebase user deleted: ${account.uid}`);
        } catch (firebaseError) {
          cliLogger.error(`Error deleting Firebase user: ${account.uid}`, firebaseError);
          appLogger.error('Firebase user deletion failed', { error: firebaseError, uid: account.uid });
        }
      }

      this.invalidateAccountCache(accountId);

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
  public async findAccountIdByProfileId(profileId: number): Promise<number | null> {
    try {
      return await accountsDb.findAccountIdByProfileId(profileId);
    } catch (error) {
      throw errorService.handleError(error, `findAccountIdByProfileId(${profileId})`);
    }
  }

  /**
   * Tracks user activity by updating the last_activity timestamp
   *
   * This method uses a fire-and-forget pattern to avoid blocking API requests.
   * Errors are logged but do not throw to prevent disruption to the user experience.
   *
   * @param accountId - ID of the account to track activity for
   * @returns Promise that resolves when tracking is complete (does not throw)
   */
  public async trackActivity(accountId: number): Promise<void> {
    try {
      const config = getActivityTrackingConfig();

      if (!config.enabled) {
        return;
      }

      const updated = await accountsDb.updateLastActivity(accountId, config.throttleMinutes);

      if (updated) {
        appLogger.debug(`Activity tracked for account ${accountId}`, { accountId });
      }
    } catch (error) {
      // Log error but don't throw - activity tracking should not disrupt requests
      appLogger.error(`Failed to track activity for account ${accountId}`, {
        error: error instanceof Error ? error.message : String(error),
        accountId,
      });
    }
  }

  /**
   * Get account by email address
   */
  public async getCombinedAccountByEmail(email: string): Promise<CombinedAccount | null> {
    try {
      const dbAccount = await accountsDb.findAccountByEmail(email);

      if (!dbAccount) {
        return null;
      }

      const firebaseUser = await this.getAdmin().auth().getUserByEmail(email);

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
        id: dbAccount.account_id,
        name: dbAccount.account_name,
        defaultProfileId: dbAccount.default_profile_id,
        image: getAccountImage(dbAccount.image, dbAccount.account_name),
        databaseCreatedAt: dbAccount.created_at,
        lastLogin: dbAccount.last_login,
        lastActivity: dbAccount.last_activity,
      };
    } catch (error) {
      throw errorService.handleError(error, `getCombinedAccountByEmail(${email})`);
    }
  }

  public async verifyEmail(accountUid: string): Promise<void> {
    try {
      await this.getAdmin().auth().updateUser(accountUid, { emailVerified: true });
    } catch (error) {
      throw errorService.handleError(error, `verifyEmail(${accountUid})`);
    }
  }

  private async getAllUsers(): Promise<UserRecord[]> {
    let nextPageToken: string | undefined;
    let allUsers: UserRecord[] = [];

    do {
      const listUsersResult = await this.getAdmin().auth().listUsers(1000, nextPageToken);
      allUsers = allUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    return allUsers;
  }

  private combineUserData(firebaseUsers: UserRecord[], databaseAccounts: AccountRow[]): CombinedAccount[] {
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
          id: dbAccount.account_id,
          name: dbAccount.account_name,
          defaultProfileId: dbAccount.default_profile_id,
          image: getAccountImage(dbAccount.image, dbAccount.account_name),
          databaseCreatedAt: dbAccount.created_at,
          lastLogin: dbAccount.last_login,
          lastActivity: dbAccount.last_activity,
        };
      });

    return combinedUsers;
  }

  private getAdmin() {
    const admin = getFirebaseAdmin(this.serviceName);
    if (admin) {
      return admin;
    }
    throw new FirebaseError();
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createAccountService(dependencies?: { cacheService?: CacheService }): AccountService {
  return new AccountService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: AccountService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getAccountService(): AccountService {
  if (!instance) {
    instance = createAccountService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetAccountService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { accountService }` continues to work
 */
export const accountService = getAccountService();
