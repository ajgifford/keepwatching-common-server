import { ContentReferenceRow, transformContentReferenceRow } from '../../types/contentTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { ContentReference } from '@ajgifford/keepwatching-types';

/**
 * Get trending shows based on how many users have favorited them recently
 */
export async function getTrendingShows(limit: number = 10): Promise<ContentReference[]> {
  try {
    const query = `
      SELECT s.id, s.title, s.tmdb_id, s.release_date
      FROM shows s
      JOIN show_watch_status sws ON s.id = sws.show_id
      WHERE sws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY s.id, s.title, s.tmdb_id
      ORDER BY COUNT(sws.profile_id) DESC, s.user_rating DESC
      LIMIT ${limit}
    `;

    const [shows] = await getDbPool().execute<ContentReferenceRow[]>(query);
    return shows.map(transformContentReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting trending shows');
  }
}

/**
 * Get recently added shows to the database
 */
export async function getNewlyAddedShows(limit: number = 10): Promise<ContentReference[]> {
  try {
    const query = `
      SELECT id, title, tmdb_id, release_date
      FROM shows
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY created_at DESC, user_rating DESC
      LIMIT ${limit}
    `;

    const [shows] = await getDbPool().execute<ContentReferenceRow[]>(query);
    return shows.map(transformContentReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting newly added shows');
  }
}

/**
 * Get highest rated shows
 */
export async function getTopRatedShows(limit: number = 10): Promise<ContentReference[]> {
  try {
    const query = `
      SELECT id, title, tmdb_id, release_date
      FROM shows
      WHERE user_rating >= 7.0
      ORDER BY user_rating DESC, created_at DESC
      LIMIT ${limit}
    `;

    const [shows] = await getDbPool().execute<ContentReferenceRow[]>(query);
    return shows.map(transformContentReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting top rated shows');
  }
}
