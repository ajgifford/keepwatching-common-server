import {
  ProfileEpisodeRow,
  RecentUpcomingEpisodeRow,
  transformProfileEpisode,
  transformRecentUpcomingEpisode,
} from '../types/episodeTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import {
  CreateEpisodeRequest,
  ProfileEpisode,
  RecentUpcomingEpisode,
  UpdateEpisodeRequest,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Saves a new episode to the database
 *
 * This function inserts a new episode record with all associated metadata.
 * After successful insertion, it returns a the id of the new episode object.
 *
 * @param episode - The episode data to save
 * @returns A promise that resolves to the id of the saved episode
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * const episode = {
 *   tmdb_id: 98765,         // TMDB ID
 *   show_id: 42,            // Show ID
 *   season_id: 15,          // Season ID
 *   episode_number: 3,      // Episode number
 *   episode_type: 'standard', // Episode type
 *   season_number: 2,       // Season number
 *   title: 'The One With the Test',  // Title
 *   overview: 'Episode description...',  // Overview
 *   air_date: '2023-05-15', // Air date
 *   runtime: 45,            // Runtime in minutes
 *   still_image: '/path/to/still.jpg'  // Still image path
 * };
 *
 * const savedEpisode = await saveEpisode(episode);
 * console.log(`Episode saved with ID: ${savedEpisode.id}`);
 */
export async function saveEpisode(episode: CreateEpisodeRequest): Promise<number> {
  try {
    const query =
      'INSERT into episodes (tmdb_id, season_id, show_id, episode_number, episode_type, season_number, title, overview, air_date, runtime, still_image) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [
      episode.tmdb_id,
      episode.season_id,
      episode.show_id,
      episode.episode_number,
      episode.episode_type,
      episode.season_number,
      episode.title,
      episode.overview,
      episode.air_date,
      episode.runtime,
      episode.still_image,
    ]);

    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'saving an episode');
  }
}

/**
 * Updates an existing episode or inserts a new one if it doesn't exist
 *
 * This function uses MySQL's "INSERT ... ON DUPLICATE KEY UPDATE" syntax to perform
 * an upsert operation, either creating a new episode or updating an existing one
 * based on the TMDB ID.
 *
 * @param episode - The episode data to update or insert
 * @returns A id of the episode that was either inserted or updated
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Updating an existing episode with new information
 * const episode = {
 *   tmdb_id: 98765,         // TMDB ID (same as existing)
 *   show_id: 42,            // Show ID
 *   season_id: 15,          // Season ID
 *   episode_number: 3,      // Episode number
 *   episode_type: 'standard', // Episode type
 *   season_number: 2,       // Season number
 *   title: 'The One With the Updated Title',  // Updated title
 *   overview: 'Updated episode description...', // Updated overview
 *   air_date: '2023-05-15', // Air date
 *   runtime: 48,            // Updated runtime
 *   still_image: '/path/to/new_still.jpg'  // Updated still image
 * };
 *
 * const updatedEpisode = await updateEpisode(episode);
 * console.log('Episode updated successfully with ID: ' + updatedEpisode.id);
 */
export async function updateEpisode(episode: UpdateEpisodeRequest): Promise<number> {
  try {
    const query =
      'INSERT into episodes (tmdb_id, season_id, show_id, episode_number, episode_type, season_number, title, overview, air_date, runtime, still_image) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), episode_number = ?, episode_type = ?, season_number = ?, title = ?, overview = ?, air_date = ?, runtime = ?, still_image = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [
      //Insert Values
      episode.tmdb_id,
      episode.season_id,
      episode.show_id,
      episode.episode_number,
      episode.episode_type,
      episode.season_number,
      episode.title,
      episode.overview,
      episode.air_date,
      episode.runtime,
      episode.still_image,
      //Update Values
      episode.episode_number,
      episode.episode_type,
      episode.season_number,
      episode.title,
      episode.overview,
      episode.air_date,
      episode.runtime,
      episode.still_image,
    ]);

    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'updating an episode');
  }
}

/**
 * Adds an episode to a user's favorites/watch list
 *
 * @param profileId - ID of the profile to add the episode to as a favorite
 * @param episodeId - ID of the episode to add as a favorite
 * @returns A promise that resolves when the favorite has been added
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Add episode with ID 789 to profile 456's favorites
 * await saveFavorite('456', 789);
 */
export async function saveFavorite(profileId: number, episodeId: number): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO episode_watch_status (profile_id, episode_id) VALUES (?,?)';
    await getDbPool().execute(query, [profileId, episodeId]);
  } catch (error) {
    handleDatabaseError(error, 'saving an episode as a favorite');
  }
}

/**
 * Removes an episode from a user's favorites/watch list
 *
 * This method deletes the watch status entry for an episode, removing it from
 * a user's list of tracked episodes.
 *
 * @param profileId - ID of the profile to remove the episode from
 * @param episodeId - ID of the episode to remove
 * @returns A promise that resolves when the favorite has been removed
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Remove episode with ID 789 from profile 456's favorites
 * await removeFavorite('456', 789);
 */
export async function removeFavorite(profileId: number, episodeId: number): Promise<void> {
  try {
    const query = 'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?';
    await getDbPool().execute(query, [profileId, episodeId]);
  } catch (error) {
    handleDatabaseError(error, 'removing an episode as a favorite');
  }
}

/**
 * Updates the watch status of an episode for a specific profile
 *
 * This method marks an episode as watched, watching, or not watched for a user,
 * allowing for tracking watch progress of TV shows.
 *
 * @param profileId - ID of the profile to update the watch status for
 * @param episodeId - ID of the episode to update
 * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
 * @returns `true` if the watch status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Mark episode 789 as watched for profile 456
 * const updated = await updateWatchStatus('456', 789, 'WATCHED');
 * if (updated) {
 *   console.log('Episode marked as watched');
 * } else {
 *   console.log('No update occurred - episode might not be in favorites');
 * }
 */
export async function updateWatchStatus(profileId: number, episodeId: number, status: string): Promise<boolean> {
  try {
    const query = 'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, episodeId]);

    // Return true if at least one row was affected (watch status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an episode watch status');
  }
}

/**
 * Gets all episodes for a specific season and profile with watch status
 *
 * This method retrieves all episodes belonging to a season along with their
 * watch status for a specific user profile.
 *
 * @param profileId - ID of the profile to get episodes for
 * @param seasonId - ID of the season to get episodes for
 * @returns Array of episodes with watch status
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Get all episodes for season 15 and profile 456
 *   const episodes = await getEpisodesForSeason('456', 15);
 *   console.log(`Found ${episodes.length} episodes`);
 *
 *   // Count watched episodes
 *   const watchedCount = episodes.filter(ep => ep.watch_status === 'WATCHED').length;
 *   console.log(`${watchedCount} episodes watched out of ${episodes.length}`);
 * } catch (error) {
 *   console.error('Error fetching episodes:', error);
 * }
 */
export async function getEpisodesForSeason(profileId: number, seasonId: number): Promise<ProfileEpisode[]> {
  try {
    const query = 'SELECT * FROM profile_episodes where profile_id = ? and season_id = ? ORDER BY episode_number';
    const [episodeRows] = await getDbPool().execute<ProfileEpisodeRow[]>(query, [Number(profileId), seasonId]);
    return episodeRows.map(transformProfileEpisode);
  } catch (error) {
    handleDatabaseError(error, 'getting episodes for a season');
  }
}

/**
 * Gets upcoming episodes from a profile's watchlist
 *
 * This method retrieves episodes from a profile's watchlist that are
 * scheduled to air within the next 7 days, ordered by air date.
 *
 * @param profileId - ID of the profile to get upcoming episodes for
 * @returns Array of upcoming episodes
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Get upcoming episodes for profile 456
 * const upcomingEpisodes = await getUpcomingEpisodesForProfile('456');
 * console.log(`${upcomingEpisodes.length} upcoming episodes in your watchlist`);
 */
export async function getUpcomingEpisodesForProfile(profileId: number): Promise<RecentUpcomingEpisode[]> {
  try {
    const query = 'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 6';
    const [episodeRows] = await getDbPool().execute<RecentUpcomingEpisodeRow[]>(query, [Number(profileId)]);
    return episodeRows.map(transformRecentUpcomingEpisode);
  } catch (error) {
    handleDatabaseError(error, 'getting upcoming episodes for a profile');
  }
}

/**
 * Gets recent episodes from a profile's watchlist
 *
 * This method retrieves episodes from a profile's watchlist that
 * aired within the last 7 days, ordered by air date.
 *
 * @param profileId - ID of the profile to get recent episodes for
 * @returns Array of recent episodes
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * // Get recent episodes for profile 456
 * const recentEpisodes = await Episode.getRecentEpisodesForProfile('456');
 * console.log(`${recentEpisodes.length} recent episodes in your watchlist`);
 */
export async function getRecentEpisodesForProfile(profileId: number): Promise<RecentUpcomingEpisode[]> {
  try {
    const query = 'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 6';
    const [episodeRows] = await getDbPool().execute<RecentUpcomingEpisodeRow[]>(query, [Number(profileId)]);
    return episodeRows.map(transformRecentUpcomingEpisode);
  } catch (error) {
    handleDatabaseError(error, 'getting recent episodes for a profile');
  }
}
