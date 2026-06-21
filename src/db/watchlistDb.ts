import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { WatchlistContentType, WatchlistItem } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface WatchlistRow extends RowDataPacket {
  id: number;
  profile_id: number;
  content_type: WatchlistContentType;
  content_id: number;
  priority: number;
  added_at: string;
  title: string;
  poster_image: string;
  genres: string;
  streaming_services: string;
  runtime: number | null;
  has_new_season: 0 | 1;
}

function transformWatchlistRow(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    contentType: row.content_type,
    contentId: row.content_id,
    priority: row.priority,
    addedAt: row.added_at,
    title: row.title,
    posterImage: row.poster_image,
    genres: row.genres ?? '',
    streamingServices: row.streaming_services ?? '',
    runtime: row.runtime ?? null,
    hasNewSeason: Boolean(row.has_new_season),
  };
}

export async function getWatchlistForProfile(profileId: number): Promise<WatchlistItem[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getWatchlistForProfile', async () => {
      const pool = getDbPool();
      const query = `
        SELECT
          wi.id,
          wi.profile_id,
          wi.content_type,
          wi.content_id,
          wi.priority,
          wi.added_at,
          CASE wi.content_type
            WHEN 'show' THEN s.title
            WHEN 'movie' THEN m.title
          END AS title,
          CASE wi.content_type
            WHEN 'show' THEN s.poster_image
            WHEN 'movie' THEN m.poster_image
          END AS poster_image,
          CASE wi.content_type
            WHEN 'show' THEN (
              SELECT GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ')
              FROM show_genres sg JOIN genres g ON sg.genre_id = g.id
              WHERE sg.show_id = wi.content_id
            )
            WHEN 'movie' THEN (
              SELECT GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ')
              FROM movie_genres mg JOIN genres g ON mg.genre_id = g.id
              WHERE mg.movie_id = wi.content_id
            )
          END AS genres,
          CASE wi.content_type
            WHEN 'show' THEN (
              SELECT GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ')
              FROM show_services ts JOIN streaming_services ss ON ts.streaming_service_id = ss.id
              WHERE ts.show_id = wi.content_id
            )
            WHEN 'movie' THEN (
              SELECT GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ')
              FROM movie_services ms JOIN streaming_services ss ON ms.streaming_service_id = ss.id
              WHERE ms.movie_id = wi.content_id
            )
          END AS streaming_services,
          CASE wi.content_type
            WHEN 'show' THEN ROUND((
              SELECT AVG(e.runtime) FROM episodes e
              WHERE e.show_id = wi.content_id AND e.runtime IS NOT NULL AND e.runtime > 0
            ))
            WHEN 'movie' THEN m.runtime
          END AS runtime,
          CASE
            WHEN wi.content_type = 'show' THEN (
              SELECT IF(sws.status = 'UP_TO_DATE' AND s_inner.next_episode_to_air IS NOT NULL, 1, 0)
              FROM show_watch_status sws
              JOIN shows s_inner ON sws.show_id = s_inner.id
              WHERE sws.show_id = wi.content_id AND sws.profile_id = wi.profile_id
            )
            ELSE 0
          END AS has_new_season
        FROM watchlist_items wi
        LEFT JOIN shows s ON wi.content_type = 'show' AND wi.content_id = s.id
        LEFT JOIN movies m ON wi.content_type = 'movie' AND wi.content_id = m.id
        WHERE wi.profile_id = ?
        ORDER BY wi.priority ASC
      `;
      const [rows] = await pool.execute<WatchlistRow[]>(query, [profileId]);
      return rows.map(transformWatchlistRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting watchlist for profile');
  }
}

export async function addWatchlistItem(
  accountId: number,
  profileId: number,
  contentType: WatchlistContentType,
  contentId: number,
): Promise<WatchlistItem> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('addWatchlistItem', async () => {
      const pool = getDbPool();
      const insertQuery = `
        INSERT INTO watchlist_items (account_id, profile_id, content_type, content_id, priority)
        SELECT ?, ?, ?, ?, COALESCE(MAX(priority), -1) + 1
        FROM watchlist_items
        WHERE profile_id = ?
      `;
      const [result] = await pool.execute<ResultSetHeader>(insertQuery, [
        accountId,
        profileId,
        contentType,
        contentId,
        profileId,
      ]);
      const newId = result.insertId;
      const items = await getWatchlistForProfile(profileId);
      const newItem = items.find((i) => i.id === newId);
      if (!newItem) throw new Error('Watchlist item not found after insert');
      return newItem;
    });
  } catch (error) {
    handleDatabaseError(error, 'adding watchlist item');
  }
}

export async function removeWatchlistItem(itemId: number, profileId: number): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming('removeWatchlistItem', async () => {
      const pool = getDbPool();
      await pool.execute<ResultSetHeader>('DELETE FROM watchlist_items WHERE id = ? AND profile_id = ?', [
        itemId,
        profileId,
      ]);
    });
  } catch (error) {
    handleDatabaseError(error, 'removing watchlist item');
  }
}

export async function updateWatchlistPriorities(
  profileId: number,
  priorities: Array<{ id: number; priority: number }>,
): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming('updateWatchlistPriorities', async () => {
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const { id, priority } of priorities) {
          await conn.execute<ResultSetHeader>(
            'UPDATE watchlist_items SET priority = ? WHERE id = ? AND profile_id = ?',
            [priority, id, profileId],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    });
  } catch (error) {
    handleDatabaseError(error, 'updating watchlist priorities');
  }
}
