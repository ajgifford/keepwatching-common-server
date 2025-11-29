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
