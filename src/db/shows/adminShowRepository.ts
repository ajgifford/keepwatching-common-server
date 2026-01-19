import { RowDataPacket } from 'mysql2';
import { NotFoundError } from '../../middleware/errorMiddleware';
import { ContentCountRow } from '../../types/contentTypes';
import { AdminEpisodeRow, transformAdminEpisode } from '../../types/episodeTypes';
import {
  AdminSeasonWatchProgressRow,
  ContentProfilesRow,
  ProfileShowStatusRow,
  transformAdminSeasonWatchProgress,
  transformContentProfiles,
} from '../../types/profileTypes';
import { AdminSeasonRow, transformAdminSeason, transformAdminSeasonWithEpisodes } from '../../types/seasonTypes';
import { AdminShowRow, ShowReferenceRow, transformAdminShow, transformShowReferenceRow } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import {
  AdminEpisode,
  AdminProfileWatchProgress,
  AdminSeason,
  AdminSeasonWithEpisodes,
  AdminShow,
  AdminShowWatchProgressResult,
  ContentProfiles,
  ShowFilters,
  ShowReference,
  WatchStatus,
} from '@ajgifford/keepwatching-types';

export async function getShowsCount(): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowsCount', async () => {
      const query = `SELECT COUNT(DISTINCT s.id) AS total FROM shows s`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'get a count of all shows');
  }
}

export interface ShowFilterOptions {
  types: string[];
  statuses: string[];
  networks: string[];
  streamingServices: string[];
}

interface DistinctValueRow extends RowDataPacket {
  value: string | null;
}

/**
 * Get all distinct filter values available for shows
 * Used to populate filter dropdowns in the admin UI
 *
 * @returns Object containing arrays of distinct values for each filter type
 */
export async function getShowFilterOptions(): Promise<ShowFilterOptions> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowFilterOptions', async () => {
      const [types] = await getDbPool().execute<DistinctValueRow[]>(
        'SELECT DISTINCT type as value FROM shows WHERE type IS NOT NULL AND type != "" ORDER BY type',
      );
      const [statuses] = await getDbPool().execute<DistinctValueRow[]>(
        'SELECT DISTINCT status as value FROM shows WHERE status IS NOT NULL AND status != "" ORDER BY status',
      );
      const [networks] = await getDbPool().execute<DistinctValueRow[]>(
        'SELECT DISTINCT network as value FROM shows WHERE network IS NOT NULL AND network != "" ORDER BY network',
      );
      const [streamingServices] = await getDbPool().execute<DistinctValueRow[]>(
        `SELECT DISTINCT ss.name as value
         FROM show_services shs
         JOIN streaming_services ss ON shs.streaming_service_id = ss.id
         WHERE ss.name IS NOT NULL AND ss.name != ""
         ORDER BY ss.name`,
      );

      return {
        types: types.map((r) => r.value).filter((v): v is string => v !== null),
        statuses: statuses.map((r) => r.value).filter((v): v is string => v !== null),
        networks: networks.map((r) => r.value).filter((v): v is string => v !== null),
        streamingServices: streamingServices.map((r) => r.value).filter((v): v is string => v !== null && v !== ''),
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'get show filter options');
  }
}

export async function getShowsCountByProfile(profileId: number): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowsCountByProfile', async () => {
      const query = `SELECT COUNT(DISTINCT s.show_id) AS total FROM profile_shows s WHERE s.profile_id = ?`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query, [profileId]);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting a count of shows for a profile');
  }
}

export async function getAllShows(limit: number = 50, offset: number = 0): Promise<AdminShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllShows', async () => {
      const query = `SELECT * FROM admin_shows LIMIT ${limit} OFFSET ${offset}`;
      const [shows] = await getDbPool().execute<AdminShowRow[]>(query);
      return shows.map(transformAdminShow);
    });
  } catch (error) {
    handleDatabaseError(error, 'get all shows');
  }
}

/**
 * Build WHERE clause and params array from filter object
 * @internal
 */
function buildShowFilterClause(filters: ShowFilters): { whereClause: string; params: string[] } {
  const whereClauses: string[] = [];
  const params: string[] = [];

  if (filters.type) {
    whereClauses.push('type = ?');
    params.push(filters.type);
  }

  if (filters.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.network) {
    whereClauses.push('network = ?');
    params.push(filters.network);
  }

  if (filters.streamingService) {
    whereClauses.push('streaming_services LIKE ?');
    params.push(`%${filters.streamingService}%`);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * Get count of shows matching the provided filters
 *
 * @param filters - Optional filters to apply
 * @returns Count of shows matching the filter criteria
 */
export async function getShowsCountFiltered(filters: ShowFilters): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowsCountFiltered', async () => {
      const { whereClause, params } = buildShowFilterClause(filters);
      const query = `SELECT COUNT(*) AS total FROM admin_shows ${whereClause}`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query, params);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'get filtered shows count');
  }
}

/**
 * Get all shows with optional filtering by type, status, network, or streaming service
 *
 * This method extends `getAllShows` by allowing optional filters to narrow down results.
 * Filters are combined with AND logic - shows must match all provided filter criteria.
 *
 * @param filters - Optional filters to apply (see ShowFilters interface)
 * @param limit - Maximum number of shows to return (default: 50)
 * @param offset - Number of shows to skip for pagination (default: 0)
 * @returns Array of AdminShow objects matching the filter criteria
 * @throws {DatabaseError} If a database error occurs
 *
 * @example
 * ```typescript
 * // Get ended shows
 * const endedShows = await getAllShowsFiltered({ status: 'Ended' }, 100, 0);
 *
 * // Get reality shows on NBC
 * const realityShows = await getAllShowsFiltered({
 *   type: 'Reality',
 *   network: 'NBC'
 * }, 50, 0);
 *
 * // Get all shows available on Netflix (2nd page)
 * const netflixShows = await getAllShowsFiltered(
 *   { streamingService: 'Netflix' },
 *   50,
 *   50
 * );
 * ```
 */
export async function getAllShowsFiltered(
  filters: ShowFilters,
  limit: number = 50,
  offset: number = 0,
): Promise<AdminShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllShowsFiltered', async () => {
      const { whereClause, params } = buildShowFilterClause(filters);
      const query = `SELECT * FROM admin_shows ${whereClause} LIMIT ${limit} OFFSET ${offset}`;

      const [shows] = await getDbPool().execute<AdminShowRow[]>(query, params);
      return shows.map(transformAdminShow);
    });
  } catch (error) {
    handleDatabaseError(error, 'get filtered shows');
  }
}

export async function getAllShowsByProfile(
  profileId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<AdminShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllShowsByProfile', async () => {
      const query = `SELECT * FROM admin_profile_shows WHERE profile_id = ? ORDER BY title asc LIMIT ${limit} OFFSET ${offset}`;
      const [shows] = await getDbPool().execute<AdminShowRow[]>(query, [profileId]);
      return shows.map(transformAdminShow);
    });
  } catch (error) {
    handleDatabaseError(error, 'get all shows for a profile');
  }
}

export async function getAllShowReferences(): Promise<ShowReference[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllShowReferences', async () => {
      const query = `SELECT id, tmdb_id, title, release_date FROM shows`;
      const [shows] = await getDbPool().execute<ShowReferenceRow[]>(query);
      return shows.map(transformShowReferenceRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'get all show references');
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
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminShowDetails',
      async () => {
        const query = `SELECT * FROM admin_show_details WHERE id = ?`;
        const [rows] = await getDbPool().execute<AdminShowRow[]>(query, [showId]);

        if (rows.length === 0) {
          throw new NotFoundError(`Show with ID ${showId} not found`);
        }

        return transformAdminShow(rows[0]);
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
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
export async function getAdminShowSeasons(showId: number): Promise<AdminSeason[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminShowSeasons',
      async () => {
        const query = `SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number`;
        const [seasonRows] = await getDbPool().execute<AdminSeasonRow[]>(query, [showId]);
        return seasonRows.map(transformAdminSeason);
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
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
export async function getAdminShowSeasonsWithEpisodes(showId: number): Promise<AdminSeasonWithEpisodes[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminShowSeasonsWithEpisodes',
      async () => {
        const seasonsQuery = `SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number`;
        const [seasonRows] = await getDbPool().execute<AdminSeasonRow[]>(seasonsQuery, [showId]);

        if (seasonRows.length === 0) {
          return [];
        }

        const seasonIds = seasonRows.map((row) => row.id);
        const placeholders = seasonIds.map(() => '?').join(',');
        const episodesQuery = `SELECT * FROM episodes WHERE season_id IN (${placeholders}) ORDER BY season_id, episode_number`;
        const [episodeRows] = await getDbPool().execute<AdminEpisodeRow[]>(episodesQuery, seasonIds);

        const episodesBySeason: Record<number, AdminEpisode[]> = {};
        episodeRows.forEach((episodeRow) => {
          if (!episodesBySeason[episodeRow.season_id]) {
            episodesBySeason[episodeRow.season_id] = [];
          }

          episodesBySeason[episodeRow.season_id].push(transformAdminEpisode(episodeRow));
        });

        return seasonRows.map((season) => transformAdminSeasonWithEpisodes(season, episodesBySeason));
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
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
export async function getAdminSeasonEpisodes(seasonId: number): Promise<AdminEpisode[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminSeasonEpisodes',
      async () => {
        const query = `SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number`;
        const [episodeRows] = await getDbPool().execute<AdminEpisodeRow[]>(query, [seasonId]);
        return episodeRows.map(transformAdminEpisode);
      },
      1000,
      { content: { id: seasonId, type: 'season' } },
    );
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
export async function getAdminShowProfiles(showId: number): Promise<ContentProfiles[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminShowProfiles',
      async () => {
        const query = `SELECT * FROM admin_show_profiles WHERE show_id = ?`;
        const [profileRows] = await getDbPool().execute<ContentProfilesRow[]>(query, [showId]);
        return profileRows.map(transformContentProfiles);
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
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
export async function getAdminShowWatchProgress(showId: number): Promise<AdminShowWatchProgressResult> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getAdminShowWatchProgress',
      async () => {
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

        const [profileRows] = await getDbPool().execute<ProfileShowStatusRow[]>(profilesQuery, [showId]);

        if (profileRows.length === 0) {
          return [];
        }

        const results = await Promise.all(
          profileRows.map(async (profile) => {
            const seasonQuery = `SELECT * FROM admin_season_watch_progress WHERE show_id = ? and profile_id = ?`;
            const [seasonRows] = await getDbPool().execute<AdminSeasonWatchProgressRow[]>(seasonQuery, [
              showId,
              profile.profile_id,
            ]);

            const seasons = seasonRows.map(transformAdminSeasonWatchProgress);
            const totalEpisodes = seasonRows.reduce((sum, season) => sum + season.number_of_episodes, 0);
            const watchedEpisodes = seasonRows.reduce((sum, season) => sum + season.watched_episodes, 0);
            const percentComplete = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;

            return {
              profileId: profile.profile_id,
              name: profile.name,
              showStatus: profile.show_status as WatchStatus,
              totalEpisodes,
              watchedEpisodes,
              percentComplete,
              seasons,
            } as AdminProfileWatchProgress;
          }),
        );

        return results;
      },
      1000,
      { content: { id: showId, type: 'show' } },
    );
  } catch (error) {
    handleDatabaseError(error, `getAdminShowWatchProgress(${showId})`);
  }
}
