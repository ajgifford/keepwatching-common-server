import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Profile {
  account_id: number;
  name: string;
  id?: number;
  image?: string;
}

export interface AdminProfile extends Profile{
  created_at: string;
  favorited_shows: number;
  favorited_movies: number
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
    handleDatabaseError(error, 'saving a profile');
  }
}

export async function updateProfileName(profile: Profile, name: string): Promise<Profile | null> {
  try {
    const query = 'UPDATE profiles SET name = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [name, profile.id]);

    if (result.affectedRows === 0) return null;

    return { ...profile, name };
  } catch (error) {
    handleDatabaseError(error, 'updating a profile name');
  }
}

export async function updateProfileImage(profile: Profile, image: string): Promise<Profile | null> {
  try {
    const query = 'UPDATE profiles SET image = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [image, profile.id]);

    if (result.affectedRows === 0) return null;

    return { ...profile, image };
  } catch (error) {
    handleDatabaseError(error, 'updating a profile image');
  }
}

export async function deleteProfile(profile: Profile): Promise<boolean> {
  try {
    const query = 'DELETE FROM profiles WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profile.id]);

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'deleting a profile');
  }
}

export async function findProfileById(id: number): Promise<Profile | null> {
  try {
    const query = `SELECT * FROM profiles WHERE profile_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) return null;

    return createProfile(rows[0].account_id, rows[0].name, rows[0].profile_id, rows[0].image);
  } catch (error) {
    handleDatabaseError(error, 'finding a profile by id');
  }
}

export async function getProfilesByAccountId(accountId: number): Promise<Profile[]> {
  try {
    const query = `SELECT * FROM profiles WHERE account_id = ?`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [accountId]);

    return rows.map((profile) => createProfile(profile.account_id, profile.name, profile.profile_id, profile.image));
  } catch (error) {
    handleDatabaseError(error, 'getting profiles by account id');
  }
}

export async function getProfilesWithCountsByAccountId(accountId: number): Promise<AdminProfile[]> {
  try {
    const query =
      'SELECT p.*, (SELECT COUNT(*) FROM show_watch_status f WHERE f.profile_id = p.profile_id) as favorited_shows, (SELECT COUNT(*) FROM movie_watch_status f WHERE f.profile_id = p.profile_id) as favorited_movies FROM profiles p WHERE p.account_id = ?';
    const [profiles] = await getDbPool().execute<RowDataPacket[]>(query, [accountId]);

    return profiles.map((profile) => createAdminProfile(profile.account_id, profile.name, profile.favorited_shows, profile.favorited_movies, profile.profile_id, profile.image, profile.created_at));;
  } catch (error) {
    handleDatabaseError(error, 'getting profiles with show and movie counts by account id');
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

export function createAdminProfile(
  accountId: number, 
  name: string, 
  favoritedShows: number,
  favoritedMovies: number,
  id?: number, 
  image?: string,
  createdAt?: string
): AdminProfile {
  return {
    account_id: accountId,
    name: name,
    favorited_shows: favoritedShows,
    favorited_movies: favoritedMovies,
    created_at: createdAt || new Date().toISOString(),
    ...(id ? { id } : {}),
    ...(image ? { image } : {}),
  };
}
