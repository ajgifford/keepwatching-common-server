import { Account, DatabaseAccount } from '../types/accountTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * Registers a new account with a default profile
 *
 * This function creates a new account record in the database, then creates an initial profile
 * with the same name as the account, and sets that profile as the default profile.
 *
 * @param account - The account data to register
 * @returns A promise that resolves with the updated account data including IDs
 * @throws {DatabaseError} If a database error occurs during registration
 */
export async function registerAccount(account: Account): Promise<Account> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query = `INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)`;
      const [result] = await connection.execute<ResultSetHeader>(query, [account.name, account.email, account.uid]);
      const accountId = result.insertId;

      const profileQuery = 'INSERT INTO profiles (account_id, name) VALUES (?,?)';
      const [profileResult] = await connection.execute<ResultSetHeader>(profileQuery, [accountId, account.name]);
      const defaultProfileId = profileResult.insertId;

      const defaultQuery = 'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?';
      await connection.execute(defaultQuery, [defaultProfileId, accountId]);

      return {
        ...account,
        account_id: accountId,
        default_profile_id: defaultProfileId,
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'registering an account');
  }
}

export async function getAccounts(): Promise<DatabaseAccount[]> {
  try {
    const query = 'SELECT * from accounts';
    const [accounts] = (await getDbPool().execute(query)) as [DatabaseAccount[], any];
    return accounts;
  } catch (error) {
    handleDatabaseError(error, 'getting all accounts');
  }
}

/**
 * Updates an account's profile image
 *
 * @param accountId - ID of the account to update
 * @param imagePath - Path to the new image file
 * @returns Updated account data or null if update failed
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateAccountImage(accountId: number, imagePath: string): Promise<Account | null> {
  try {
    const query = 'UPDATE accounts SET image = ? WHERE account_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [imagePath, accountId]);

    if (result.affectedRows === 0) return null;

    return await findAccountById(accountId);
  } catch (error) {
    handleDatabaseError(error, 'updating an account image');
  }
}

/**
 * Updates an account's details including name and default profile
 *
 * @param accountId - ID of the account to update
 * @param accountName - New name for the account
 * @param defaultProfileId - ID of the profile to set as default
 * @returns Updated account data or null if update failed
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function editAccount(
  accountId: number,
  accountName: string,
  defaultProfileId: number,
): Promise<Account | null> {
  try {
    const query = 'UPDATE accounts SET account_name = ?, default_profile_id = ? WHERE account_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [accountName, defaultProfileId, accountId]);

    if (result.affectedRows === 0) return null;

    return await findAccountById(accountId);
  } catch (error) {
    handleDatabaseError(error, 'editing an account');
  }
}

/**
 * Deletes an account and all its associated data
 *
 * This function deletes an account and all related data (profiles, favorites, etc.)
 * using a transaction to ensure data consistency.
 *
 * @param accountId - ID of the account to delete
 * @returns True if the account was successfully deleted, false if not found
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function deleteAccount(accountId: number): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const findAccountQuery = `SELECT uid FROM accounts WHERE account_id = ?`;
      const [accountRows] = await connection.execute<RowDataPacket[]>(findAccountQuery, [accountId]);

      if (accountRows.length === 0) {
        return false;
      }

      const deleteQuery = 'DELETE FROM accounts WHERE account_id = ?';
      const [result] = await connection.execute<ResultSetHeader>(deleteQuery, [accountId]);

      return result.affectedRows > 0;
    });
  } catch (error) {
    handleDatabaseError(error, 'deleting an account');
  }
}

/**
 * Finds an account by external provider UID (e.g., Firebase UID)
 *
 * @param uid - External provider's unique ID to search for
 * @returns Account data if found, null otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findAccountByUID(uid: string): Promise<Account | null> {
  try {
    const query = `SELECT * FROM accounts WHERE uid = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [uid]);

    if (rows.length === 0) return null;

    const account = rows[0];
    return {
      id: account.account_id,
      name: account.account_name,
      email: account.email,
      uid: account.uid,
      image: account.image,
      default_profile_id: account.default_profile_id,
    };
  } catch (error) {
    handleDatabaseError(error, 'finding an account by UID');
  }
}

/**
 * Finds an account by email address
 *
 * @param email - Email address to search for
 * @returns Account data if found, null otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findAccountByEmail(email: string): Promise<Account | null> {
  try {
    const query = `SELECT * FROM accounts WHERE email = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) return null;

    const account = rows[0];
    return {
      id: account.account_id,
      name: account.account_name,
      email: account.email,
      uid: account.uid,
      image: account.image,
      default_profile_id: account.default_profile_id,
    };
  } catch (error) {
    handleDatabaseError(error, 'finding an account by email');
  }
}

/**
 * Finds an account by its database ID
 *
 * @param id - Account ID to search for
 * @returns Account data if found, null otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findAccountById(id: number): Promise<Account | null> {
  try {
    const query = `SELECT * FROM accounts WHERE account_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) return null;

    const account = rows[0];
    return {
      id: account.account_id,
      name: account.account_name,
      email: account.email,
      uid: account.uid,
      image: account.image,
      default_profile_id: account.default_profile_id,
    };
  } catch (error) {
    handleDatabaseError(error, 'finding an account by id');
  }
}

/**
 * Finds the account ID associated with a specific profile
 *
 * @param profileId - Profile ID to search for
 * @returns Account ID if found, null otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findAccountIdByProfileId(profileId: string): Promise<number | null> {
  try {
    const query = `SELECT * FROM profiles where profile_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [profileId]);

    if (rows.length === 0) return null;

    const profile = rows[0];
    return profile.account_id;
  } catch (error) {
    handleDatabaseError(error, 'finding an account by profile id');
  }
}

export function createAccount(
  name: string,
  email: string,
  uid: string,
  image?: string,
  accountId?: number,
  defaultProfileId?: number,
): Account {
  return {
    name: name,
    email: email,
    uid: uid,
    ...(image ? { image } : {}),
    ...(accountId ? { id: accountId } : {}),
    ...(defaultProfileId ? { default_profile_id: defaultProfileId } : {}),
  };
}
