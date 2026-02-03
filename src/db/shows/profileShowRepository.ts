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
  NextEpisode,
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
 * PERFORMANCE OPTIMIZATION (v2):
 * - Eliminates expensive window functions (ROW_NUMBER) that process ~47,822 rows
 * - Reduces CTE materialization from 6x to 1x for recent_shows
 * - Limits episodes early per season (3 max) reducing intermediate rows from ~47,822 to ~108
 * - Supports out-of-order season watching (e.g., watching seasons 26, 28, 41 simultaneously)
 * - Estimated improvement: 500-1000ms → 50-150ms
 *
 * @param profileId - ID of the profile to get next unwatched episodes for
 * @returns Array of shows with their next unwatched episodes, ordered by most recently watched
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getNextUnwatchedEpisodesForProfile(profileId: number): Promise<KeepWatchingShow[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getNextUnwatchedEpisodesForProfile', async () => {
      const pool = getDbPool();

      // Optimized query structure:
      // 1. recent_shows: Get 6 most recently watched shows with unwatched episodes
      // 2. active_seasons: Identify seasons with watched episodes (for out-of-order viewing)
      // 3. next_episodes_per_active_season: Get first 3 unwatched episodes per active season (early limiting)
      // 4. fallback_episodes: For shows with no active seasons, get first 3 from earliest unwatched season
      const query = `
        WITH recent_shows AS (
          SELECT DISTINCT
            s.id AS show_id,
            s.title AS show_title,
            s.poster_image,
            MAX(ews.updated_at) AS last_watched_date
          FROM episode_watch_status ews
          INNER JOIN episodes e ON ews.episode_id = e.id
          INNER JOIN shows s ON e.show_id = s.id
          WHERE ews.profile_id = ?
            AND ews.status = 'WATCHED'
            AND EXISTS (
              SELECT 1
              FROM episodes e2
              LEFT JOIN episode_watch_status ews2
                ON e2.id = ews2.episode_id
                AND ews2.profile_id = ?
              WHERE e2.show_id = s.id
                AND (ews2.status IS NULL OR ews2.status != 'WATCHED')
                AND e2.air_date IS NOT NULL
                AND e2.air_date <= CURDATE()
              LIMIT 1
            )
          GROUP BY s.id, s.title, s.poster_image
          ORDER BY last_watched_date DESC
          LIMIT 6
        ),
        active_seasons AS (
          SELECT DISTINCT
            rs.show_id,
            e.season_number
          FROM recent_shows rs
          INNER JOIN episodes e ON e.show_id = rs.show_id
          INNER JOIN episode_watch_status ews
            ON ews.episode_id = e.id
            AND ews.profile_id = ?
          WHERE ews.status = 'WATCHED'
        ),
        next_episodes_per_active_season AS (
          SELECT
            sub.show_id,
            sub.season_number,
            sub.episode_id,
            sub.episode_title,
            sub.episode_number,
            sub.overview,
            sub.season_id,
            sub.still_image,
            sub.air_date,
            sub.runtime,
            sub.is_active_season
          FROM (
            SELECT
              acts.show_id,
              acts.season_number,
              e.id AS episode_id,
              e.title AS episode_title,
              e.episode_number,
              e.overview,
              e.season_id,
              e.still_image,
              e.air_date,
              e.runtime,
              1 AS is_active_season,
              ROW_NUMBER() OVER (PARTITION BY acts.show_id, acts.season_number ORDER BY e.episode_number) AS rn
            FROM active_seasons acts
            INNER JOIN episodes e
              ON e.show_id = acts.show_id
              AND e.season_number = acts.season_number
            LEFT JOIN episode_watch_status ews
              ON e.id = ews.episode_id
              AND ews.profile_id = ?
            WHERE (ews.status IS NULL OR ews.status != 'WATCHED')
              AND e.air_date IS NOT NULL
              AND e.air_date <= CURDATE()
          ) sub
          WHERE sub.rn <= 3
        ),
        shows_with_active_episodes AS (
          SELECT DISTINCT show_id
          FROM next_episodes_per_active_season
        ),
        fallback_episodes AS (
          SELECT
            sub.show_id,
            sub.season_number,
            sub.episode_id,
            sub.episode_title,
            sub.episode_number,
            sub.overview,
            sub.season_id,
            sub.still_image,
            sub.air_date,
            sub.runtime,
            sub.is_active_season
          FROM (
            SELECT
              rs.show_id,
              e.season_number,
              e.id AS episode_id,
              e.title AS episode_title,
              e.episode_number,
              e.overview,
              e.season_id,
              e.still_image,
              e.air_date,
              e.runtime,
              0 AS is_active_season,
              ROW_NUMBER() OVER (PARTITION BY rs.show_id ORDER BY e.episode_number) AS rn
            FROM recent_shows rs
            INNER JOIN episodes e ON e.show_id = rs.show_id
            LEFT JOIN episode_watch_status ews
              ON e.id = ews.episode_id
              AND ews.profile_id = ?
            WHERE NOT EXISTS (
                SELECT 1 FROM shows_with_active_episodes swae WHERE swae.show_id = rs.show_id
              )
              AND (ews.status IS NULL OR ews.status != 'WATCHED')
              AND e.air_date IS NOT NULL
              AND e.air_date <= CURDATE()
              AND e.season_number = (
                SELECT MIN(e2.season_number)
                FROM episodes e2
                LEFT JOIN episode_watch_status ews2
                  ON e2.id = ews2.episode_id
                  AND ews2.profile_id = ?
                WHERE e2.show_id = rs.show_id
                  AND (ews2.status IS NULL OR ews2.status != 'WATCHED')
                  AND e2.air_date IS NOT NULL
                  AND e2.air_date <= CURDATE()
              )
          ) sub
          WHERE sub.rn <= 3
        ),
        all_candidate_episodes AS (
          SELECT * FROM next_episodes_per_active_season
          UNION ALL
          SELECT * FROM fallback_episodes
        )
        SELECT
          rs.show_id,
          rs.show_title,
          rs.poster_image,
          rs.last_watched_date,
          ace.episode_id,
          ace.episode_title,
          ace.overview,
          ace.episode_number,
          ace.season_number,
          ace.season_id,
          ace.still_image,
          ace.air_date,
          ace.runtime,
          ace.is_active_season,
          s.network,
          GROUP_CONCAT(DISTINCT ss.name ORDER BY ss.name SEPARATOR ', ') AS streaming_services
        FROM recent_shows rs
        INNER JOIN all_candidate_episodes ace ON ace.show_id = rs.show_id
        INNER JOIN shows s ON s.id = rs.show_id
        LEFT JOIN show_services tss ON rs.show_id = tss.show_id
        LEFT JOIN streaming_services ss ON tss.streaming_service_id = ss.id
        GROUP BY rs.show_id, rs.show_title, rs.poster_image, rs.last_watched_date,
                 ace.episode_id, ace.episode_title, ace.overview, ace.episode_number,
                 ace.season_number, ace.season_id, ace.still_image, ace.air_date, ace.runtime,
                 ace.is_active_season, s.network
        ORDER BY rs.last_watched_date DESC, rs.show_id, ace.season_number ASC, ace.episode_number ASC
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
        runtime: number;
        network: string | null;
        streaming_services: string | null;
        is_active_season: number; // 1 = active season, 0 = fallback season
      }

      const [rows] = await pool.execute<OptimizedResultRow[]>(query, [
        profileId,
        profileId,
        profileId,
        profileId,
        profileId,
        profileId,
      ]);

      if (rows.length === 0) {
        return [];
      }

      // Group episodes by show and season for round-robin selection
      interface SeasonEpisodes {
        seasonNumber: number;
        isActiveSeason: boolean;
        episodes: NextEpisode[];
      }

      const showMap = new Map<
        number,
        {
          show: Omit<KeepWatchingShow, 'episodes'>;
          seasonMap: Map<number, SeasonEpisodes>;
        }
      >();

      for (const row of rows) {
        if (!showMap.has(row.show_id)) {
          showMap.set(row.show_id, {
            show: {
              showId: row.show_id,
              showTitle: row.show_title,
              posterImage: row.poster_image || '',
              lastWatched: row.last_watched_date.toISOString(),
            },
            seasonMap: new Map(),
          });
        }

        const entry = showMap.get(row.show_id)!;
        if (!entry.seasonMap.has(row.season_number)) {
          entry.seasonMap.set(row.season_number, {
            seasonNumber: row.season_number,
            isActiveSeason: row.is_active_season === 1,
            episodes: [],
          });
        }

        const season = entry.seasonMap.get(row.season_number)!;
        season.episodes.push({
          episodeId: row.episode_id,
          episodeTitle: row.episode_title,
          overview: row.overview || '',
          episodeNumber: row.episode_number,
          seasonNumber: row.season_number,
          episodeStillImage: row.still_image || '',
          airDate: row.air_date,
          runtime: row.runtime,
          showId: row.show_id,
          showName: row.show_title,
          seasonId: row.season_id,
          posterImage: row.poster_image || '',
          network: row.network || '',
          streamingServices: row.streaming_services || '',
          profileId: profileId,
        });
      }

      // Apply round-robin episode selection across seasons per show
      const results: KeepWatchingShow[] = [];

      for (const [, entry] of showMap) {
        const seasons = Array.from(entry.seasonMap.values());
        seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

        // Round-robin to pick 2 episodes across active seasons (or all seasons if no active)
        const selectedEpisodes: NextEpisode[] = [];
        const indices = new Map(seasons.map((s) => [s.seasonNumber, 0]));
        const seasonNumbers = seasons.map((s) => s.seasonNumber);

        while (selectedEpisodes.length < 2 && seasonNumbers.length > 0) {
          for (const sn of [...seasonNumbers]) {
            if (selectedEpisodes.length >= 2) break;

            const season = seasons.find((s) => s.seasonNumber === sn);
            const idx = indices.get(sn);

            if (season && idx !== undefined && idx < season.episodes.length) {
              selectedEpisodes.push(season.episodes[idx]);
              indices.set(sn, idx + 1);
            } else {
              seasonNumbers.splice(seasonNumbers.indexOf(sn), 1);
            }
          }
        }

        results.push({
          ...entry.show,
          episodes: selectedEpisodes,
        });
      }

      return results;
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
