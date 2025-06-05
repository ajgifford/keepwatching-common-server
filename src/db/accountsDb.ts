import { AccountRow, transformAccountRow } from '../types/accountTypes';
import { ProfileAccountReferenceRow } from '../types/profileTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

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
export async function registerAccount(accountData: CreateAccountRequest): Promise<Account> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const accountQuery = `INSERT INTO accounts (account_name, email, uid) VALUES (?, ?, ?)`;
      const [accountResult] = await connection.execute<ResultSetHeader>(accountQuery, [
        accountData.name,
        accountData.email,
        accountData.uid,
      ]);
      const accountId = accountResult.insertId;

      const profileQuery = 'INSERT INTO profiles (account_id, name) VALUES (?,?)';
      const [profileResult] = await connection.execute<ResultSetHeader>(profileQuery, [accountId, accountData.name]);
      const defaultProfileId = profileResult.insertId;

      const defaultQuery = 'UPDATE accounts SET default_profile_id = ? WHERE account_id = ?';
      await connection.execute(defaultQuery, [defaultProfileId, accountId]);

      return {
        id: accountId,
        name: accountData.name,
        email: accountData.email,
        uid: accountData.uid,
        image: '',
        defaultProfileId: defaultProfileId,
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'registering an account');
  }
}

export async function getAccounts(): Promise<AccountRow[]> {
  try {
    const query = 'SELECT * from accounts';
    const [accounts] = await getDbPool().execute<AccountRow[]>(query);
    return accounts;
  } catch (error) {
    handleDatabaseError(error, 'getting all accounts');
  }
}

/**
 * Updates an account's profile image
 *
 * @param accountData - Request object for updating an account
 * @returns Updated account data or null if update failed
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateAccountImage(accountData: UpdateAccountRequest): Promise<Account | null> {
  try {
    const query = 'UPDATE accounts SET image = ? WHERE account_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [accountData.image, accountData.id]);

    if (result.affectedRows === 0) return null;

    return await findAccountById(accountData.id);
  } catch (error) {
    handleDatabaseError(error, 'updating an account image');
  }
}

/**
 * Updates an account's details including name and default profile
 *
 * @param accountDate - Request object for updating an account
 * @returns Updated account data or null if update failed
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function editAccount(accountData: UpdateAccountRequest): Promise<Account | null> {
  try {
    const query = 'UPDATE accounts SET account_name = ?, default_profile_id = ? WHERE account_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [
      accountData.name,
      accountData.defaultProfileId,
      accountData.id,
    ]);

    if (result.affectedRows === 0) return null;

    return await findAccountById(accountData.id);
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
      const findAccountQuery = `SELECT * FROM accounts WHERE account_id = ?`;
      const [accountRows] = await connection.execute<AccountRow[]>(findAccountQuery, [accountId]);

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
    const [rows] = await getDbPool().execute<AccountRow[]>(query, [uid]);

    if (rows.length === 0) return null;

    return transformAccountRow(rows[0]);
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
    const [rows] = await getDbPool().execute<AccountRow[]>(query, [email]);

    if (rows.length === 0) return null;

    return transformAccountRow(rows[0]);
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
    const [rows] = await getDbPool().execute<AccountRow[]>(query, [id]);

    if (rows.length === 0) return null;

    return transformAccountRow(rows[0]);
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
export async function findAccountIdByProfileId(profileId: number): Promise<number | null> {
  try {
    const query = `SELECT account_id FROM profiles where profile_id = ?`;
    const [rows] = await getDbPool().execute<ProfileAccountReferenceRow[]>(query, [profileId]);

    if (rows.length === 0) return null;

    return rows[0].account_id;
  } catch (error) {
    handleDatabaseError(error, 'finding an account by profile id');
  }
}
