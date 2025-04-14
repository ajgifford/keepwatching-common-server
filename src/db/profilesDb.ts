import { DatabaseError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Profile {
  account_id: number;
  name: string;
  id?: number;
  image?: string;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  try {
    const query = 'INSERT into profiles (account_id, name) VALUES (?, ?)';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profile.account_id, profile.name]);

    return {
      ...profile,
      id: result.insertId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error saving a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

export async function updateProfileName(profile: Profile, name: string): Promise<Profile | null> {
  try {
    const query = 'UPDATE profiles SET name = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [name, profile.id]);

    if (result.affectedRows === 0) return null;

    return { ...profile, name };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error updating a profile name';
    throw new DatabaseError(errorMessage, error);
  }
}

export async function updateProfileImage(profile: Profile, image: string): Promise<Profile | null> {
  try {
    const query = 'UPDATE profiles SET image = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [image, profile.id]);

    if (result.affectedRows === 0) return null;

    return { ...profile, image };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error updating a profile image';
    throw new DatabaseError(errorMessage, error);
  }
}

export async function deleteProfile(profile: Profile): Promise<boolean> {
  try {
    const query = 'DELETE FROM profiles WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profile.id]);

    return result.affectedRows > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error deleting a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

export async function findProfileById(id: number): Promise<Profile | null> {
  try {
    const query = `SELECT * FROM profiles WHERE profile_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) return null;

    return createProfile(rows[0].account_id, rows[0].name, rows[0].profile_id, rows[0].image);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error finding a profile by id';
    throw new DatabaseError(errorMessage, error);
  }
}

export async function getAllProfilesByAccountId(accountId: number): Promise<Profile[]> {
  try {
    const query = `SELECT * FROM profiles WHERE account_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [accountId]);

    return rows.map((profile) => createProfile(profile.account_id, profile.name, profile.profile_id, profile.image));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting all profiles by account';
    throw new DatabaseError(errorMessage, error);
  }
}

export function createProfile(accountId: number, name: string, id?: number, image?: string): Profile {
  return {
    account_id: accountId,
    name: name,
    ...(id ? { id } : {}),
    ...(image ? { image } : {}),
  };
}
