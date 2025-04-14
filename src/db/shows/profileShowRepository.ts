import { DatabaseError } from '../../middleware/errorMiddleware';
import {
  ContinueWatchingShow,
  NextEpisode,
  ProfileSeason,
  ProfileShow,
  ProfileShowWithSeasons,
} from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { RowDataPacket } from 'mysql2';

/**
 * Retrieves all shows for a specific profile with their watch status
 *
 * This function returns all shows that a profile has added to their
 * favorites/watchlist, including watch status information.
 *
 * @param profileId - ID of the profile to get shows for
 * @returns Array of shows with their details and watch status
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getAllShowsForProfile(profileId: string): Promise<ProfileShow[]> {
  try {
    const query = 'SELECT * FROM profile_shows WHERE profile_id = ?';
    const [shows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId)]);
    const transformedRows = shows.map(transformRow);
    return transformedRows;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting all shows for a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Gets a specific show for a profile with watch status information
 *
 * This function retrieves a single show from a profile's watchlist
 * along with its watch status.
 *
 * @param profileId - ID of the profile
 * @param showId - ID of the show to retrieve
 * @returns Show with watch status information
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getShowForProfile(profileId: string, showId: number): Promise<ProfileShow> {
  try {
    const query = 'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?';
    const [shows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId), showId]);
    const result = transformRow(shows[0]);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error getting a show for a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Retrieves a show with all its seasons and episodes for a specific profile
 *
 * This function fetches a show with all its associated metadata and watch status, along with
 * all seasons and their episodes. The resulting hierarchical structure provides a complete
 * view of the show's content with watch status for the specified profile.
 *
 * @param profileId - ID of the profile to get the show for
 * @param showId - ID of the show to retrieve
 * @returns Complete show object with seasons and episodes or null if not found
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getShowWithSeasonsForProfile(
  profileId: string,
  showId: string,
): Promise<ProfileShowWithSeasons | null> {
  try {
    const query = 'SELECT * FROM profile_shows where profile_id = ? AND show_id = ?';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId), Number(showId)]);
    if (rows.length === 0) {
      return null;
    }

    const show = transformRow(rows[0]) as ProfileShowWithSeasons;
    const seasonQuery = 'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number';
    const [seasonRows] = await getDbPool().execute<RowDataPacket[]>(seasonQuery, [Number(profileId), Number(showId)]);

    if (seasonRows.length > 0) {
      const seasonIds = seasonRows.map((season) => season.season_id);
      const placeholders = seasonIds.map(() => '?').join(',');

      const episodeQuery = `
            SELECT * FROM profile_episodes 
            WHERE profile_id = ? AND season_id IN (${placeholders}) 
            ORDER BY season_id, episode_number
          `;

      const [episodeRows] = await getDbPool().execute<RowDataPacket[]>(episodeQuery, [Number(profileId), ...seasonIds]);

      const episodesBySeasonId: Record<number, any[]> = {};
      episodeRows.forEach((episode) => {
        if (!episodesBySeasonId[episode.season_id]) {
          episodesBySeasonId[episode.season_id] = [];
        }
        episodesBySeasonId[episode.season_id].push({
          profile_id: episode.profile_id,
          episode_id: episode.episode_id,
          tmdb_id: episode.tmdb_id,
          season_id: episode.season_id,
          show_id: episode.show_id,
          episode_number: episode.episode_number,
          episode_type: episode.episode_type,
          season_number: episode.season_number,
          title: episode.title,
          overview: episode.overview,
          runtime: episode.runtime,
          air_date: episode.air_date,
          still_image: episode.still_image,
          watch_status: episode.watch_status,
        });
      });

      show.seasons = seasonRows.map(
        (season): ProfileSeason => ({
          profile_id: season.profile_id,
          season_id: season.season_id,
          show_id: season.show_id,
          tmdb_id: season.tmdb_id,
          name: season.name,
          overview: season.overview,
          season_number: season.season_number,
          release_date: season.release_date,
          poster_image: season.poster_image,
          number_of_episodes: season.number_of_episodes,
          watch_status: season.watch_status,
          episodes: episodesBySeasonId[season.season_id] || [],
        }),
      );
    } else {
      show.seasons = [];
    }

    return show;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting a show and its seasons for a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Gets the next unwatched episodes for shows a profile has recently watched
 *
 * This function identifies shows that a user has partially watched (status = 'WATCHING')
 * and finds the next unwatched episodes for each show. It's commonly used to build
 * a "Continue Watching" section in the UI, allowing users to easily resume shows
 * they've started but not finished.
 *
 * @param profileId - ID of the profile to get next unwatched episodes for
 * @returns Array of shows with their next unwatched episodes, ordered by most recently watched
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getNextUnwatchedEpisodesForProfile(profileId: string): Promise<ContinueWatchingShow[]> {
  try {
    const pool = getDbPool();
    const recentShowsQuery = `SELECT * FROM profile_recent_shows_with_unwatched WHERE profile_id = ? ORDER BY last_watched_date DESC LIMIT 6`;
    const [recentShows] = await pool.execute<RowDataPacket[]>(recentShowsQuery, [profileId]);

    if (recentShows.length === 0) {
      return [];
    }

    const results = await Promise.all(
      recentShows.map(async (show) => {
        const nextEpisodesQuery = `SELECT * FROM profile_next_unwatched_episodes WHERE profile_id = ? AND show_id = ? AND episode_rank <= 2 ORDER BY season_number ASC, episode_number ASC`;
        const [episodes] = await pool.execute<RowDataPacket[]>(nextEpisodesQuery, [profileId, show.show_id]);

        return {
          show_id: show.show_id,
          show_title: show.show_title,
          poster_image: show.poster_image,
          last_watched: show.last_watched_date,
          episodes: episodes as NextEpisode[],
        };
      }),
    );

    return results;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown database error getting the next unwatched episodes for a profile';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Gets all profile IDs that have added this show to their watchlist
 *
 * This function retrieves the IDs of all profiles that have saved this show as a favorite.
 * Useful for notifications, batch updates, and determining the popularity of a show within the system.
 *
 * @param showId - ID of the show to get profiles for
 * @returns Array of profile IDs that have this show as a favorite
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getProfilesForShow(showId: number): Promise<number[]> {
  try {
    const query = 'SELECT profile_id FROM show_watch_status where show_id = ?';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [showId]);
    const profileIds = rows.map((row) => {
      return row.profile_id;
    });
    return profileIds;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting the profiles for a show';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Transforms a raw database row into a ProfileShow object
 */
export function transformRow(row: RowDataPacket): ProfileShow {
  if (!row) {
    throw new Error('Cannot transform undefined or null row');
  }

  const {
    profile_id,
    show_id,
    tmdb_id,
    title,
    description,
    release_date,
    poster_image,
    backdrop_image,
    user_rating,
    content_rating,
    season_count,
    episode_count,
    watch_status,
    status,
    type,
    in_production,
    genres,
    streaming_services,
    last_episode_title,
    last_episode_air_date,
    last_episode_number,
    last_episode_season,
    next_episode_title,
    next_episode_air_date,
    next_episode_number,
    next_episode_season,
    network,
  } = row;

  return {
    profile_id,
    show_id,
    tmdb_id,
    title,
    description,
    release_date,
    poster_image,
    backdrop_image,
    user_rating,
    content_rating,
    season_count,
    episode_count,
    watch_status,
    status,
    type,
    in_production,
    genres,
    streaming_services,
    network,
    last_episode: last_episode_title
      ? {
          title: last_episode_title,
          air_date: last_episode_air_date,
          episode_number: last_episode_number,
          season_number: last_episode_season,
        }
      : null,
    next_episode: next_episode_title
      ? {
          title: next_episode_title,
          air_date: next_episode_air_date,
          episode_number: next_episode_number,
          season_number: next_episode_season,
        }
      : null,
  };
}
