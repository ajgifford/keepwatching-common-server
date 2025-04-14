import { DatabaseError } from '../middleware/errorMiddleware';
import { ProfileEpisode } from '../types/showTypes';
import { getDbPool } from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Episode {
  id?: number;
  tmdb_id: number;
  show_id: number;
  season_id: number;
  episode_number: number;
  episode_type: string;
  season_number: number;
  title: string;
  overview: string;
  air_date: string;
  runtime: number;
  still_image: string;
}

/**
 * Saves a new episode to the database
 *
 * This function inserts a new episode record with all associated metadata.
 * After successful insertion, it returns a new episode object with updated ID.
 *
 * @param episode - The episode data to save
 * @returns A promise that resolves to the saved episode with its new ID
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
export async function saveEpisode(episode: Episode): Promise<Episode> {
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

    // Return a new episode object with the ID
    return {
      ...episode,
      id: result.insertId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error saving an episode';
    throw new DatabaseError(errorMessage, error);
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
 * @returns A promise that resolves to the updated episode with its ID
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
export async function updateEpisode(episode: Episode): Promise<Episode> {
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

    // Return a new episode object with the ID
    return {
      ...episode,
      id: result.insertId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error updating an episode';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error saving an episode as a favorite';
    throw new DatabaseError(errorMessage, error);
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
export async function removeFavorite(profileId: string, episodeId: number): Promise<void> {
  try {
    const query = 'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?';
    await getDbPool().execute(query, [Number(profileId), episodeId]);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error removing an episode as a favorite';
    throw new DatabaseError(errorMessage, error);
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
export async function updateWatchStatus(profileId: string, episodeId: number, status: string): Promise<boolean> {
  try {
    const query = 'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, episodeId]);

    // Return true if at least one row was affected (watch status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error updating an episode watch status';
    throw new DatabaseError(errorMessage, error);
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
export async function getEpisodesForSeason(profileId: string, seasonId: number): Promise<ProfileEpisode[]> {
  try {
    const query = 'SELECT * FROM profile_episodes where profile_id = ? and season_id = ? ORDER BY episode_number';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId), seasonId]);
    return rows as ProfileEpisode[];
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting episodes for a season';
    throw new DatabaseError(errorMessage, error);
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
export async function getUpcomingEpisodesForProfile(profileId: string) {
  try {
    const query = 'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 6';
    const [rows] = await getDbPool().execute(query, [Number(profileId)]);
    return rows;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting upcoming episodes for a profile';
    throw new DatabaseError(errorMessage, error);
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
export async function getRecentEpisodesForProfile(profileId: string) {
  try {
    const query = 'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 6';
    const [rows] = await getDbPool().execute(query, [Number(profileId)]);
    return rows;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting recent episodes for a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Creates a new episode object with the given properties
 *
 * This is a helper function to create a new episode object with the given properties.
 *
 * @param tmdbId - TMDB API identifier for the episode
 * @param showId - ID of the show this episode belongs to
 * @param seasonId - ID of the season this episode belongs to
 * @param episodeNumber - Episode number within its season
 * @param episodeType - Type of episode (e.g., "standard", "mid_season_finale")
 * @param seasonNumber - Season number this episode belongs to
 * @param title - Title of the episode
 * @param overview - Synopsis/description of the episode
 * @param airDate - Original air date of the episode (YYYY-MM-DD format)
 * @param runtime - Runtime of the episode in minutes
 * @param stillImage - Path to the episode's still image
 * @param id - Optional database ID for an existing episode
 * @returns A new episode object
 */
export function createEpisode(
  tmdbId: number,
  showId: number,
  seasonId: number,
  episodeNumber: number,
  episodeType: string,
  seasonNumber: number,
  title: string,
  overview: string,
  airDate: string,
  runtime: number,
  stillImage: string,
  id?: number,
): Episode {
  return {
    tmdb_id: tmdbId,
    show_id: showId,
    season_id: seasonId,
    episode_number: episodeNumber,
    episode_type: episodeType,
    season_number: seasonNumber,
    title: title,
    overview: overview,
    air_date: airDate,
    runtime: runtime,
    still_image: stillImage,
    ...(id ? { id } : {}),
  };
}
