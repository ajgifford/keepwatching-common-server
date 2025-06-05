import {
  NextUnwatchedEpisodesRow,
  ProfileEpisodeRow,
  transformNextUnwatchedEpisodes,
  transformProfileEpisode,
} from '../../types/episodeTypes';
import { RecentShowsWithUnwatchedRow } from '../../types/profileTypes';
import { ProfileSeasonRow, transformProfileSeason } from '../../types/seasonTypes';
import { ProfileShowRow, ProfileShowStatusRow, transformProfileShow } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import {
  KeepWatchingShow,
  ProfileEpisode,
  ProfileShow,
  ProfileShowWithSeasons,
  ProfilesForShowResponse,
} from '@ajgifford/keepwatching-types';

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
export async function getAllShowsForProfile(profileId: number): Promise<ProfileShow[]> {
  try {
    const query = 'SELECT * FROM profile_shows WHERE profile_id = ?';
    const [shows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId]);
    return shows.map(transformProfileShow);
  } catch (error) {
    handleDatabaseError(error, 'getting all shows for a profile');
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
export async function getShowForProfile(profileId: number, showId: number): Promise<ProfileShow> {
  try {
    const query = 'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?';
    const [shows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, showId]);
    return transformProfileShow(shows[0]);
  } catch (error) {
    handleDatabaseError(error, 'getting a show for a profile');
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
  profileId: number,
  showId: number,
): Promise<ProfileShowWithSeasons | null> {
  try {
    const query = 'SELECT * FROM profile_shows where profile_id = ? AND show_id = ?';
    const [rows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, showId]);
    if (rows.length === 0) {
      return null;
    }

    const show = transformProfileShow(rows[0]) as ProfileShowWithSeasons;
    const seasonQuery = 'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number';
    const [seasonRows] = await getDbPool().execute<ProfileSeasonRow[]>(seasonQuery, [profileId, showId]);

    if (seasonRows.length > 0) {
      const seasonIds = seasonRows.map((season) => season.season_id);
      const placeholders = seasonIds.map(() => '?').join(',');

      const episodeQuery = `
            SELECT * FROM profile_episodes 
            WHERE profile_id = ? AND season_id IN (${placeholders}) 
            ORDER BY season_id, episode_number
          `;

      const [episodeRows] = await getDbPool().execute<ProfileEpisodeRow[]>(episodeQuery, [profileId, ...seasonIds]);

      const episodesBySeasonId: Record<number, ProfileEpisode[]> = {};
      episodeRows.forEach((episode) => {
        if (!episodesBySeasonId[episode.season_id]) {
          episodesBySeasonId[episode.season_id] = [];
        }
        episodesBySeasonId[episode.season_id].push(transformProfileEpisode(episode));
      });

      show.seasons = seasonRows.map((season) =>
        transformProfileSeason(season, episodesBySeasonId[season.season_id] || []),
      );
    } else {
      show.seasons = [];
    }

    return show;
  } catch (error) {
    handleDatabaseError(error, 'getting a show and its seasons for a profile');
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
export async function getNextUnwatchedEpisodesForProfile(profileId: number): Promise<KeepWatchingShow[]> {
  try {
    const pool = getDbPool();
    const recentShowsQuery = `SELECT * FROM profile_recent_shows_with_unwatched WHERE profile_id = ? ORDER BY last_watched_date DESC LIMIT 6`;
    const [recentShows] = await pool.execute<RecentShowsWithUnwatchedRow[]>(recentShowsQuery, [profileId]);

    if (recentShows.length === 0) {
      return [];
    }

    const results = await Promise.all(
      recentShows.map(async (show) => {
        const nextEpisodesQuery = `SELECT * FROM profile_next_unwatched_episodes WHERE profile_id = ? AND show_id = ? AND episode_rank <= 2 ORDER BY season_number ASC, episode_number ASC`;
        const [episodes] = await pool.execute<NextUnwatchedEpisodesRow[]>(nextEpisodesQuery, [profileId, show.show_id]);

        return {
          showId: show.show_id,
          showTitle: show.show_title,
          posterImage: show.poster_image,
          lastWatched: show.last_watched_date.toISOString(),
          episodes: episodes.map(transformNextUnwatchedEpisodes),
        } as KeepWatchingShow;
      }),
    );

    return results;
  } catch (error) {
    handleDatabaseError(error, 'getting the next unwatched episodes for a profile');
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
export async function getProfilesForShow(showId: number): Promise<ProfilesForShowResponse> {
  try {
    const query = `SELECT 
        sws.profile_id,
        p.account_id
      FROM 
        show_watch_status sws
      JOIN 
        profiles p ON sws.profile_id = p.profile_id
      WHERE 
        sws.show_id = ?
      ORDER BY 
        p.account_id, sws.profile_id`;

    const [rows] = await getDbPool().execute<ProfileShowStatusRow[]>(query, [showId]);

    const profileAccountMappings = rows.map((row) => ({
      profileId: row.profile_id,
      accountId: row.account_id,
    }));

    const profileIds = rows.map((row) => row.profile_id);
    return {
      showId,
      profileAccountMappings,
      totalCount: profileIds.length,
    };
  } catch (error) {
    handleDatabaseError(error, 'getting the profiles that have favorited a show');
  }
}
