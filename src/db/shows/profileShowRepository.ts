import { ProfileEpisodeRow, transformProfileEpisode } from '../../types/episodeTypes';
import { ProfileSeasonRow, transformProfileSeason } from '../../types/seasonTypes';
import {
  ProfileForShowRow,
  ProfileShowRow,
  ProfileShowWatchProgressRow,
  transformProfileShow,
  transformProfileShowWatchProgress,
} from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import {
  KeepWatchingShow,
  ProfileEpisode,
  ProfileSeason,
  ProfileShow,
  ProfileShowWithSeasons,
  ProfilesForShowResponse,
} from '@ajgifford/keepwatching-types';
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
export async function getAllShowsForProfile(profileId: number): Promise<ProfileShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllShowsForProfile', async () => {
      const query = 'SELECT * FROM profile_shows WHERE profile_id = ?';
      const [shows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId]);
      return shows.map(transformProfileShow);
    });
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
    return await DbMonitor.getInstance().executeWithTiming(
      'getShowForProfile',
      async () => {
        const query = 'SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = ?';
        const [shows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, showId]);
        return transformProfileShow(shows[0]);
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting a show for a profile');
  }
}

/**
 * Gets a specific show for a profile with watch status information using a child (episode or season) of the show
 *
 * This function retrieves a single show from a profile's watchlist
 * along with its watch status.
 *
 * @param profileId - ID of the profile
 * @param childId - ID of the child content (episode or season) to retrieve the show for
 * @returns Show with watch status information
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getShowForProfileByChild(
  profileId: number,
  childId: number,
  childEntity: 'episodes' | 'seasons',
): Promise<ProfileShow> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getShowForProfileByChild',
      async () => {
        const query = `SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from ${childEntity} where id = ?)`;
        const [shows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, childId]);
        return transformProfileShow(shows[0]);
      },
      1000,
      { content: { id: childId, type: childEntity === 'episodes' ? 'episode' : 'season' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting a show for a profile by child');
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
    return await DbMonitor.getInstance().executeWithTiming(
      'getShowWithSeasonsForProfile',
      async () => {
        const query = 'SELECT * FROM profile_shows where profile_id = ? AND show_id = ?';
        const [rows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, showId]);
        if (rows.length === 0) {
          return null;
        }

        const show = transformProfileShow(rows[0]) as ProfileShowWithSeasons;
        show.seasons = await getShowSeasons(profileId, showId);

        return show;
      },
      1000,
      { content: { id: showId, type: 'show' }, resultCount: 1 },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting a show and its seasons for a profile');
  }
}

/**
 * Retrieves a show with all its seasons and episodes for a specific profile using a child (episode or season) of the show
 *
 * This function fetches a show with all its associated metadata and watch status, along with
 * all seasons and their episodes. The resulting hierarchical structure provides a complete
 * view of the show's content with watch status for the specified profile.
 *
 * @param profileId - ID of the profile to get the show for
 * @param childId - ID of the child content (episode or season) to retrieve a show for
 * @returns Complete show object with seasons and episodes or null if not found
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getShowWithSeasonsForProfileByChild(
  profileId: number,
  childId: number,
  childEntity: 'episodes' | 'seasons',
): Promise<ProfileShowWithSeasons | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getShowWithSeasonsForProfileByChild',
      async () => {
        const query = `SELECT * FROM profile_shows WHERE profile_id = ? AND show_id = (SELECT show_id from ${childEntity} where id = ?)`;
        const [rows] = await getDbPool().execute<ProfileShowRow[]>(query, [profileId, childId]);
        if (rows.length === 0) {
          return null;
        }

        const show = transformProfileShow(rows[0]) as ProfileShowWithSeasons;
        show.seasons = await getShowSeasons(profileId, show.id);

        return show;
      },
      1000,
      { content: { id: childId, type: childEntity === 'episodes' ? 'episode' : 'season' }, resultCount: 1 },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting a show and its seasons for a profile by child');
  }
}

/**
 * Helper method to retrieve the seasons of a show
 * @param profileId - ID of the profile to get the seasons for a show for
 * @param showId - ID of the show to get seasons for
 * @returns array of seasons for a show, empty if none found
 */
async function getShowSeasons(profileId: number, showId: number): Promise<ProfileSeason[]> {
  const seasonQuery = 'SELECT * FROM profile_seasons WHERE profile_id = ? AND show_id = ? ORDER BY season_number';
  const [seasonRows] = await getDbPool().execute<ProfileSeasonRow[]>(seasonQuery, [profileId, showId]);

  if (seasonRows.length <= 0) {
    return [];
  }

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

  return seasonRows.map((season) => transformProfileSeason(season, episodesBySeasonId[season.season_id] || []));
}

/**
 * Gets the next unwatched episodes for shows a profile has recently watched
 *
 * This function identifies shows that a user has partially watched (status = 'WATCHING')
 * and finds the next unwatched episodes for each show. It's commonly used to build
 * a "Continue Watching" section in the UI, allowing users to easily resume shows
 * they've started but not finished.
 *
 * PERFORMANCE: This optimized version uses a single query with a lateral join instead of
 * querying two materialized views and making N+1 queries. This reduces query time from
 * ~12,000ms to ~500-1,000ms by:
 * - Filtering by profile_id FIRST before any joins
 * - Using indexed columns for filtering
 * - Avoiding window functions on the full dataset
 * - Limiting results early in the query execution
 *
 * @param profileId - ID of the profile to get next unwatched episodes for
 * @returns Array of shows with their next unwatched episodes, ordered by most recently watched
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getNextUnwatchedEpisodesForProfile(profileId: number): Promise<KeepWatchingShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getNextUnwatchedEpisodesForProfile', async () => {
      const pool = getDbPool();
      
      // Single optimized query that replaces the view-based N+1 queries
      const query = `
        WITH recent_shows AS (
          SELECT DISTINCT
            s.id AS show_id,
            s.title AS show_title,
            s.poster_image,
            MAX(ews.updated_at) AS last_watched_date
          FROM episode_watch_status ews
          INNER JOIN episodes e ON ews.episode_id = e.id AND ews.profile_id = ?
          INNER JOIN shows s ON e.show_id = s.id
          WHERE ews.status = 'WATCHED'
            AND EXISTS (
              SELECT 1 
              FROM episodes e2
              LEFT JOIN episode_watch_status ews2 ON e2.id = ews2.episode_id AND ews2.profile_id = ?
              WHERE e2.show_id = s.id
                AND (ews2.status IS NULL OR ews2.status != 'WATCHED')
                AND e2.air_date IS NOT NULL
                AND e2.air_date <= CURDATE()
              LIMIT 1
            )
          GROUP BY s.id, s.title, s.poster_image
          ORDER BY last_watched_date DESC
          LIMIT 6
        )
        SELECT 
          rs.show_id,
          rs.show_title,
          rs.poster_image,
          rs.last_watched_date,
          e.id AS episode_id,
          e.title AS episode_title,
          e.overview,
          e.episode_number,
          e.season_number,
          e.season_id,
          e.still_image,
          e.air_date,
          s.network,
          GROUP_CONCAT(DISTINCT ss.name ORDER BY ss.name SEPARATOR ', ') AS streaming_services
        FROM recent_shows rs
        INNER JOIN episodes e ON e.show_id = rs.show_id
        INNER JOIN shows s ON rs.show_id = s.id
        LEFT JOIN show_services tss ON s.id = tss.show_id
        LEFT JOIN streaming_services ss ON tss.streaming_service_id = ss.id
        LEFT JOIN episode_watch_status ews ON e.id = ews.episode_id AND ews.profile_id = ?
        WHERE (ews.status IS NULL OR ews.status != 'WATCHED')
          AND e.air_date IS NOT NULL
          AND e.air_date <= CURDATE()
          AND (
            SELECT COUNT(*)
            FROM episodes e2
            LEFT JOIN episode_watch_status ews2 ON e2.id = ews2.episode_id AND ews2.profile_id = ?
            WHERE e2.show_id = rs.show_id
              AND (ews2.status IS NULL OR ews2.status != 'WATCHED')
              AND e2.air_date IS NOT NULL
              AND e2.air_date <= CURDATE()
              AND (e2.season_number < e.season_number OR (e2.season_number = e.season_number AND e2.episode_number < e.episode_number))
          ) < 2
        GROUP BY e.id, rs.show_id, rs.show_title, rs.poster_image, rs.last_watched_date, e.title, e.overview, 
                 e.episode_number, e.season_number, e.season_id, e.still_image, e.air_date, s.network
        ORDER BY rs.last_watched_date DESC, rs.show_id, e.season_number ASC, e.episode_number ASC
      `;

      interface OptimizedResultRow extends RowDataPacket {
        show_id: number;
        show_title: string;
        poster_image: string | null;
        last_watched_date: Date;
        episode_id: number;
        episode_title: string;
        overview: string | null;
        episode_number: number;
        season_number: number;
        season_id: number;
        still_image: string | null;
        air_date: string;
        network: string | null;
        streaming_services: string | null;
      }

      const [rows] = await pool.execute<OptimizedResultRow[]>(query, [profileId, profileId, profileId, profileId]);

      if (rows.length === 0) {
        return [];
      }

      // Group episodes by show
      const showMap = new Map<number, KeepWatchingShow>();
      
      for (const row of rows) {
        if (!showMap.has(row.show_id)) {
          showMap.set(row.show_id, {
            showId: row.show_id,
            showTitle: row.show_title,
            posterImage: row.poster_image || '',
            lastWatched: row.last_watched_date.toISOString(),
            episodes: [],
          });
        }

        const show = showMap.get(row.show_id)!;
        if (show.episodes.length < 2) {
          show.episodes.push({
            episodeId: row.episode_id,
            episodeTitle: row.episode_title,
            overview: row.overview || '',
            episodeNumber: row.episode_number,
            seasonNumber: row.season_number,
            episodeStillImage: row.still_image || '',
            airDate: row.air_date,
            showId: row.show_id,
            showName: row.show_title,
            seasonId: row.season_id,
            posterImage: row.poster_image || '',
            network: row.network || '',
            streamingServices: row.streaming_services || '',
            profileId: profileId
          });
        }
      }

      return Array.from(showMap.values());
    });
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
    return await DbMonitor.getInstance().executeWithTiming(
      'getProfilesForShow',
      async () => {
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

        const [rows] = await getDbPool().execute<ProfileForShowRow[]>(query, [showId]);

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
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting the profiles that have favorited a show');
  }
}

/**
 * Gets watch progress data for all shows in a profile using an optimized database view
 *
 * @param profileId - ID of the profile to get watch progress for
 * @returns Array of show watch progress data with episode counts and percentages
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getWatchProgressForProfile(profileId: number) {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getWatchProgressForProfile', async () => {
      const query = 'SELECT * FROM profile_show_watch_progress WHERE profile_id = ? ORDER BY show_id';
      const [rows] = await getDbPool().execute<ProfileShowWatchProgressRow[]>(query, [profileId]);
      return rows.map(transformProfileShowWatchProgress);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting watch progress for a profile');
  }
}
