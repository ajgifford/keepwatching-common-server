import { DatabaseError } from '../middleware/errorMiddleware';
import { ProfileEpisodeRow, transformProfileEpisode } from '../types/episodeTypes';
import { ProfileSeasonRow, SeasonShowReferenceRow, transformProfileSeason } from '../types/seasonTypes';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import {
  CreateSeasonRequest,
  ProfileEpisode,
  ProfileSeason,
  SimpleWatchStatus,
  UpdateSeasonRequest,
  WatchStatus,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Saves a new season to the database
 *
 * @param season - The season data to save
 * @returns The saved season with its new ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function saveSeason(season: CreateSeasonRequest): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('saveSeason', async () => {
      const query = `
      INSERT INTO seasons (
        show_id, tmdb_id, name, overview, 
        season_number, release_date, poster_image, number_of_episodes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

      const [result] = await getDbPool().execute<ResultSetHeader>(query, [
        season.show_id,
        season.tmdb_id,
        season.name,
        season.overview,
        season.season_number,
        season.release_date,
        season.poster_image,
        season.number_of_episodes,
      ]);

      return result.insertId;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a season');
  }
}

/**
 * Updates an existing season or inserts a new one if it doesn't exist
 *
 * @param season - The season data to update
 * @returns The updated season with its ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateSeason(season: UpdateSeasonRequest): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('updateSeason', async () => {
      const query = `
      INSERT INTO seasons (
        show_id, tmdb_id, name, overview, 
        season_number, release_date, poster_image, number_of_episodes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        id = LAST_INSERT_ID(id), 
        name = ?, 
        overview = ?, 
        season_number = ?, 
        release_date = ?, 
        poster_image = ?, 
        number_of_episodes = ?
    `;

      const [result] = await getDbPool().execute<ResultSetHeader>(query, [
        // Insert values
        season.show_id,
        season.tmdb_id,
        season.name,
        season.overview,
        season.season_number,
        season.release_date,
        season.poster_image,
        season.number_of_episodes,
        // Update values
        season.name,
        season.overview,
        season.season_number,
        season.release_date,
        season.poster_image,
        season.number_of_episodes,
      ]);

      return result.insertId;
    });
  } catch (error) {
    handleDatabaseError(error, 'updating a season');
  }
}

/**
 * Adds a season to a user's favorites/watch list, will ignore if already exists
 *
 * @param profileId - ID of the profile to add the season for
 * @param seasonId - ID of the season to add
 * @param status - watch status of the season, defaults to NOT_WATCHED
 * @throws {DatabaseError} If a database error occurs
 */
export async function saveFavorite(
  profileId: number,
  seasonId: number,
  status: SimpleWatchStatus = WatchStatus.NOT_WATCHED,
): Promise<void> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    await DbMonitor.getInstance().executeWithTiming('saveFavorite', async () => {
      const query = 'INSERT IGNORE INTO season_watch_status (profile_id, season_id, status) VALUES (?,?,?)';
      await getDbPool().execute(query, [profileId, seasonId, status]);
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a season as a favorite');
  }
}

/**
 * Gets all seasons with episodes for a show
 *
 * @param profileId - ID of the profile to get seasons for
 * @param showId - ID of the show to get seasons for
 * @returns Array of seasons with their episodes
 * @throws {DatabaseError} If a database error occurs
 */
export async function getSeasonsForShow(profileId: number, showId: number): Promise<ProfileSeason[]> {
  if (!profileId || !showId) {
    throw new DatabaseError('Invalid parameters: profileId and showId are required', null);
  }

  try {
    return await DbMonitor.getInstance().executeWithTiming('getSeasonsForShow', async () => {
      const profileIdNum = profileId;
      const showIdNum = showId;

      // First get the seasons
      const seasonQuery = `
      SELECT * FROM profile_seasons 
      WHERE profile_id = ? AND show_id = ? 
      ORDER BY season_number
    `;

      const [seasonRows] = await getDbPool().execute<ProfileSeasonRow[]>(seasonQuery, [profileIdNum, showIdNum]);

      if (seasonRows.length === 0) return [];

      // Then get all episodes for these seasons in a single query
      const seasonIds = seasonRows.map((season) => season.season_id);
      const placeholders = seasonIds.map(() => '?').join(',');

      const episodeQuery = `
      SELECT * FROM profile_episodes 
      WHERE profile_id = ? AND season_id IN (${placeholders}) 
      ORDER BY season_id, episode_number
    `;

      const [episodeRows] = await getDbPool().execute<ProfileEpisodeRow[]>(episodeQuery, [profileIdNum, ...seasonIds]);

      // Group episodes by season
      const episodesBySeasonId: Record<number, ProfileEpisode[]> = {};
      episodeRows.forEach((episodeRow) => {
        if (!episodesBySeasonId[episodeRow.season_id]) {
          episodesBySeasonId[episodeRow.season_id] = [];
        }
        episodesBySeasonId[episodeRow.season_id].push(transformProfileEpisode(episodeRow));
      });

      // Build the final result
      return seasonRows.map((seasonRow) =>
        transformProfileSeason(seasonRow, episodesBySeasonId[seasonRow.season_id] || []),
      );
    });
  } catch (error) {
    handleDatabaseError(error, 'getting all seasons for a show');
  }
}

/**
 * Gets the show ID that a season belongs to
 *
 * @param seasonId - ID of the season
 * @returns Show ID or null if not found
 * @throws {DatabaseError} If a database error occurs
 */
export async function getShowIdForSeason(seasonId: number): Promise<number | null> {
  if (!seasonId) {
    throw new DatabaseError('Invalid parameter: seasonId is required', null);
  }

  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowIdForSeason', async () => {
      const query = 'SELECT show_id FROM seasons WHERE id = ?';
      const [rows] = await getDbPool().execute<SeasonShowReferenceRow[]>(query, [seasonId]);
      if (rows.length === 0) return null;
      return rows[0].show_id;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting the show id for a season');
  }
}
