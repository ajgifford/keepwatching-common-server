import { DatabaseError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { TransactionHelper } from '../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Account {
  /** Unique identifier for the account (optional, set after saving to database) */
  id?: number;
  /** Display name of the account owner */
  name: string;
  /** Email address associated with the account */
  email: string;
  /** External authentication provider's unique ID (e.g., Firebase UID) */
  uid: string;
  /** Path to the account's profile image (optional) */
  image?: string;
  /** ID of the profile marked as default for this account (optional) */
  default_profile_id?: number;
}

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error during registration';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error during image update';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error during account edit';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error when finding account by UID';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error when finding account by email';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error when finding account by ID';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error when finding account ID by profile ID';
    throw new DatabaseError(errorMessage, error);
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
