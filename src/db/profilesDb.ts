import { AdminProfileRow, ProfileRow, transformAdminProfile, transformProfile } from '../types/profileTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import {
  AdminProfile,
  CreateProfileRequest,
  Profile,
  UpdateProfileImageRequest,
  UpdateProfileNameRequest,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

export async function saveProfile(profileRequest: CreateProfileRequest): Promise<number> {
  try {
    const query = 'INSERT into profiles (account_id, name) VALUES (?, ?)';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profileRequest.accountId, profileRequest.name]);

    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'saving a profile');
  }
}

export async function updateProfileName(profileRequest: UpdateProfileNameRequest): Promise<boolean> {
  try {
    const query = 'UPDATE profiles SET name = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profileRequest.name, profileRequest.id]);

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating a profile name');
  }
}

export async function updateProfileImage(profileRequest: UpdateProfileImageRequest): Promise<boolean> {
  try {
    const query = 'UPDATE profiles SET image = ? WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profileRequest.image, profileRequest.id]);

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating a profile image');
  }
}

export async function deleteProfile(id: number): Promise<boolean> {
  try {
    const query = 'DELETE FROM profiles WHERE profile_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [id]);

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'deleting a profile');
  }
}

export async function findProfileById(id: number): Promise<Profile | null> {
  try {
    const query = `SELECT * FROM profiles WHERE profile_id = ?`;
    const [profileRows] = await getDbPool().execute<ProfileRow[]>(query, [id]);

    if (profileRows.length === 0) return null;

    return transformProfile(profileRows[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a profile by id');
  }
}

export async function getProfilesByAccountId(accountId: number): Promise<Profile[]> {
  try {
    const query = `SELECT * FROM profiles WHERE account_id = ?`;
    const [profileRows] = await getDbPool().execute<ProfileRow[]>(query, [accountId]);
    return profileRows.map(transformProfile);
  } catch (error) {
    handleDatabaseError(error, 'getting profiles by account id');
  }
}

export async function getAdminProfilesByAccountId(accountId: number): Promise<AdminProfile[]> {
  try {
    const query =
      'SELECT p.*, (SELECT COUNT(*) FROM show_watch_status f WHERE f.profile_id = p.profile_id) as favorited_shows, (SELECT COUNT(*) FROM movie_watch_status f WHERE f.profile_id = p.profile_id) as favorited_movies FROM profiles p WHERE p.account_id = ?';
    const [profiles] = await getDbPool().execute<AdminProfileRow[]>(query, [accountId]);

    return profiles.map(transformAdminProfile);
  } catch (error) {
    handleDatabaseError(error, 'getting profiles with show and movie counts by account id');
  }
}
