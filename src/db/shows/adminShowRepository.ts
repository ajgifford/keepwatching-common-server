import { NotFoundError } from '../../middleware/errorMiddleware';
import { AdminShow, AdminShowRow } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { RowDataPacket } from 'mysql2';

export async function getAllShows(limit: number = 50, offset: number = 0) {
  try {
    const query = `SELECT 
      s.id,
      s.tmdb_id,
      s.title,
      s.description,
      s.release_date,
      s.poster_image,
      s.backdrop_image,
      s.network,
      s.season_count,
      s.episode_count,
      s.user_rating,
      s.content_rating,
      s.status,
      s.type,
      s.in_production,
      s.last_air_date,
      s.created_at,
      s.updated_at,
    GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
    GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services
    FROM 
      shows s
    LEFT JOIN 
      show_genres sg ON s.id = sg.show_id
    LEFT JOIN 
      genres g ON sg.genre_id = g.id
    LEFT JOIN
      show_services shs ON s.id = shs.show_id
    LEFT JOIN
      streaming_services ss on shs.streaming_service_id = ss.id
    GROUP BY 
      s.id
    ORDER BY
        s.title
    LIMIT ${limit} 
    OFFSET ${offset}`;

    const [shows] = await getDbPool().execute<AdminShowRow[]>(query);
    return shows.map((show) => transformAdminShow(show));
  } catch (error) {
    handleDatabaseError(error, 'get all shows');
  }
}

export async function getShowsCount() {
  try {
    const query = `SELECT COUNT(DISTINCT s.id) AS total FROM shows s`;
    const [result] = await getDbPool().execute<(RowDataPacket & { total: number })[]>(query);
    return result[0].total;
  } catch (error) {
    handleDatabaseError(error, 'get a count of all shows');
  }
}

/**
 * Get detailed information about a specific show for administrative purposes
 *
 * @param showId - ID of the show to retrieve
 * @returns AdminShow object with detailed show information
 * @throws {NotFoundError} If the show doesn't exist
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminShowDetails(showId: number): Promise<AdminShow> {
  try {
    const query = `SELECT 
      s.id,
      s.tmdb_id,
      s.title,
      s.description,
      s.release_date,
      s.poster_image,
      s.backdrop_image,
      s.network,
      s.season_count,
      s.episode_count,
      s.user_rating,
      s.content_rating,
      s.status,
      s.type,
      s.in_production,
      s.last_air_date,
      s.created_at,
      s.updated_at,
      GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
      GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services
    FROM 
      shows s
    LEFT JOIN 
      show_genres sg ON s.id = sg.show_id
    LEFT JOIN 
      genres g ON sg.genre_id = g.id
    LEFT JOIN
      show_services shs ON s.id = shs.show_id
    LEFT JOIN
      streaming_services ss on shs.streaming_service_id = ss.id
    WHERE
      s.id = ?
    GROUP BY 
      s.id`;

    const [rows] = await getDbPool().execute<AdminShowRow[]>(query, [showId]);

    if (rows.length === 0) {
      throw new NotFoundError(`Show with ID ${showId} not found`);
    }

    return transformAdminShow(rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    handleDatabaseError(error, `getAdminShowDetails(${showId})`);
  }
}

/**
 * Get all seasons for a specific show with their details
 *
 * @param showId - ID of the show to get seasons for
 * @returns Array of seasons belonging to the show
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminShowSeasons(showId: number): Promise<any[]> {
  try {
    const query = `
      SELECT 
        id as season_id,
        tmdb_id,
        name,
        overview,
        season_number,
        release_date,
        poster_image,
        number_of_episodes,
        created_at,
        updated_at
      FROM 
        seasons
      WHERE 
        show_id = ?
      ORDER BY 
        season_number`;

    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [showId]);

    return rows.map((row) => ({
      id: row.season_id,
      tmdbId: row.tmdb_id,
      name: row.name,
      overview: row.overview,
      seasonNumber: row.season_number,
      releaseDate: row.release_date,
      posterImage: row.poster_image,
      episodeCount: row.number_of_episodes,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (error) {
    handleDatabaseError(error, `getAdminShowSeasons(${showId})`);
  }
}

/**
 * Get all seasons with their episodes for a specific show in a single query
 *
 * @param showId - ID of the show to get seasons and episodes for
 * @returns Nested object with seasons and their episodes
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminShowSeasonsWithEpisodes(showId: number): Promise<any[]> {
  try {
    const seasonsQuery = `
      SELECT 
        id as season_id,
        tmdb_id as season_tmdb_id,
        name as season_name,
        overview as season_overview,
        season_number,
        release_date as season_release_date,
        poster_image as season_poster_image,
        number_of_episodes,
        created_at as season_created_at,
        updated_at as season_updated_at
      FROM 
        seasons
      WHERE 
        show_id = ?
      ORDER BY 
        season_number`;

    const [seasonRows] = await getDbPool().execute<RowDataPacket[]>(seasonsQuery, [showId]);

    if (seasonRows.length === 0) {
      return [];
    }

    const seasonIds = seasonRows.map((row) => row.season_id);
    const placeholders = seasonIds.map(() => '?').join(',');
    const episodesQuery = `
      SELECT 
        e.id as episode_id,
        e.tmdb_id as episode_tmdb_id,
        e.season_id,
        e.episode_number,
        e.episode_type,
        e.season_number,
        e.title as episode_title,
        e.overview as episode_overview,
        e.air_date as episode_air_date,
        e.runtime,
        e.still_image,
        e.created_at as episode_created_at,
        e.updated_at as episode_updated_at
      FROM 
        episodes e
      WHERE 
        e.season_id IN (${placeholders})
      ORDER BY 
        e.season_id, 
        e.episode_number`;

    const [episodeRows] = await getDbPool().execute<RowDataPacket[]>(episodesQuery, seasonIds);

    const episodesBySeason: Record<number, any[]> = {};
    episodeRows.forEach((episode) => {
      if (!episodesBySeason[episode.season_id]) {
        episodesBySeason[episode.season_id] = [];
      }

      episodesBySeason[episode.season_id].push({
        id: episode.episode_id,
        tmdbId: episode.episode_tmdb_id,
        seasonId: episode.season_id,
        episodeNumber: episode.episode_number,
        episodeType: episode.episode_type,
        seasonNumber: episode.season_number,
        title: episode.episode_title,
        overview: episode.episode_overview,
        airDate: episode.episode_air_date,
        runtime: episode.runtime,
        stillImage: episode.still_image,
        createdAt: episode.episode_created_at?.toISOString(),
        updatedAt: episode.episode_updated_at?.toISOString(),
      });
    });

    return seasonRows.map((season) => ({
      id: season.season_id,
      tmdbId: season.season_tmdb_id,
      name: season.season_name,
      overview: season.season_overview,
      seasonNumber: season.season_number,
      releaseDate: season.season_release_date,
      posterImage: season.season_poster_image,
      episodeCount: season.number_of_episodes,
      createdAt: season.season_created_at?.toISOString(),
      updatedAt: season.season_updated_at?.toISOString(),
      episodes: episodesBySeason[season.season_id] || [],
    }));
  } catch (error) {
    handleDatabaseError(error, `getAdminShowSeasonsWithEpisodes(${showId})`);
  }
}

/**
 * Get all episodes for a specific season
 *
 * @param seasonId - ID of the season to get episodes for
 * @returns Array of episodes belonging to the season
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminSeasonEpisodes(seasonId: number): Promise<any[]> {
  try {
    const query = `
      SELECT 
        id as episode_id,
        tmdb_id,
        season_id,
        show_id,
        episode_number,
        episode_type,
        season_number,
        title,
        overview,
        air_date,
        runtime,
        still_image,
        created_at,
        updated_at
      FROM 
        episodes
      WHERE 
        season_id = ?
      ORDER BY 
        episode_number`;

    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [seasonId]);

    return rows.map((row) => ({
      id: row.episode_id,
      tmdbId: row.tmdb_id,
      seasonId: row.season_id,
      showId: row.show_id,
      episodeNumber: row.episode_number,
      episodeType: row.episode_type,
      seasonNumber: row.season_number,
      title: row.title,
      overview: row.overview,
      airDate: row.air_date,
      runtime: row.runtime,
      stillImage: row.still_image,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (error) {
    handleDatabaseError(error, `getAdminSeasonEpisodes(${seasonId})`);
  }
}

/**
 * Get all profiles that have this show in their favorites
 *
 * @param showId - ID of the show to get profiles for
 * @returns Array of profiles watching the show
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminShowProfiles(showId: number): Promise<any[]> {
  try {
    const query = `
      SELECT 
        p.profile_id,
        p.name,
        p.image,
        p.account_id,
        a.account_name,
        sws.status as watch_status,
        sws.created_at as added_date,
        sws.updated_at as status_updated_date
      FROM 
        show_watch_status sws
      JOIN
        profiles p ON sws.profile_id = p.profile_id
      JOIN
        accounts a ON p.account_id = a.account_id
      WHERE 
        sws.show_id = ?
      ORDER BY 
        a.account_name, p.name`;

    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [showId]);

    return rows.map((row) => ({
      profileId: row.profile_id,
      name: row.name,
      image: row.image,
      accountId: row.account_id,
      accountName: row.account_name,
      watchStatus: row.watch_status,
      addedDate: row.added_date.toISOString(),
      lastUpdated: row.status_updated_date.toISOString(),
    }));
  } catch (error) {
    handleDatabaseError(error, `getAdminShowProfiles(${showId})`);
  }
}

/**
 * Get detailed watch progress stats for all profiles watching a show
 *
 * @param showId - ID of the show to get watch progress for
 * @returns Object with detailed watch progress by profile
 * @throws {DatabaseError} If a database error occurs
 */
export async function getAdminShowWatchProgress(showId: number): Promise<any[]> {
  try {
    // First get all profiles watching this show
    const profilesQuery = `
      SELECT 
        p.profile_id,
        p.name,
        sws.status as show_status
      FROM 
        show_watch_status sws
      JOIN
        profiles p ON sws.profile_id = p.profile_id
      WHERE 
        sws.show_id = ?`;

    const [profileRows] = await getDbPool().execute<RowDataPacket[]>(profilesQuery, [showId]);

    if (profileRows.length === 0) {
      return [];
    }

    // For each profile, get detailed watch progress
    const results = await Promise.all(
      profileRows.map(async (profile) => {
        // Get season stats
        const seasonQuery = `
        SELECT 
          s.id as season_id,
          s.name,
          s.season_number,
          s.number_of_episodes,
          sws.status as season_status,
          (
            SELECT COUNT(*) 
            FROM episode_watch_status ews
            JOIN episodes e ON ews.episode_id = e.id
            WHERE e.season_id = s.id AND ews.profile_id = ? AND ews.status = 'WATCHED'
          ) as watched_episodes
        FROM 
          seasons s
        LEFT JOIN
          season_watch_status sws ON s.id = sws.season_id AND sws.profile_id = ?
        WHERE 
          s.show_id = ?
        ORDER BY 
          s.season_number`;

        const [seasonRows] = await getDbPool().execute<RowDataPacket[]>(seasonQuery, [
          profile.profile_id,
          profile.profile_id,
          showId,
        ]);

        // Calculate overall stats
        const totalEpisodes = seasonRows.reduce((sum, season) => sum + season.number_of_episodes, 0);
        const watchedEpisodes = seasonRows.reduce((sum, season) => sum + season.watched_episodes, 0);
        const percentComplete = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;

        // Format seasons with their progress
        const seasons = seasonRows.map((season) => {
          const seasonPercentComplete =
            season.number_of_episodes > 0 ? Math.round((season.watched_episodes / season.number_of_episodes) * 100) : 0;

          return {
            seasonId: season.season_id,
            seasonNumber: season.season_number,
            name: season.name,
            status: season.season_status,
            episodeCount: season.number_of_episodes,
            watchedEpisodes: season.watched_episodes,
            percentComplete: seasonPercentComplete,
          };
        });

        return {
          profileId: profile.profile_id,
          name: profile.name,
          showStatus: profile.show_status,
          totalEpisodes,
          watchedEpisodes,
          percentComplete,
          seasons,
        };
      }),
    );

    return results;
  } catch (error) {
    handleDatabaseError(error, `getAdminShowWatchProgress(${showId})`);
  }
}

/**
 * Transforms a database row into an AdminShow object
 */
function transformAdminShow(show: AdminShowRow): AdminShow {
  return {
    id: show.id,
    tmdbId: show.tmdb_id,
    title: show.title,
    description: show.description,
    releaseDate: show.release_date,
    posterImage: show.poster_image,
    backdropImage: show.backdrop_image,
    network: show.network,
    seasonCount: show.season_count,
    episodeCount: show.episode_count,
    userRating: show.user_rating,
    contentRating: show.content_rating,
    status: show.status,
    type: show.type,
    inProduction: Boolean(show.in_production),
    lastAirDate: show.last_air_date,
    lastUpdated: show.updated_at.toISOString(),
    streamingServices: show.streaming_services,
    genres: show.genres,
  };
}
