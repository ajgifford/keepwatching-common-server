import { NoAffectedRowsError, NotFoundError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import {
  AdminContentRatingSummary,
  AdminRatingWithProfile,
  ContentRating,
  RatingContentType,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface ContentRatingRow extends RowDataPacket {
  id: number;
  profile_id: number;
  content_type: RatingContentType;
  content_id: number;
  content_title: string;
  poster_image: string;
  rating: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function transformContentRatingRow(row: ContentRatingRow): ContentRating {
  return {
    id: row.id,
    profileId: row.profile_id,
    contentType: row.content_type,
    contentId: row.content_id,
    contentTitle: row.content_title,
    posterImage: row.poster_image,
    rating: row.rating,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertRating(
  profileId: number,
  contentType: RatingContentType,
  contentId: number,
  rating: number,
  note: string | null | undefined,
  contentTitle: string,
  posterImage: string,
): Promise<ContentRating> {
  const pool = getDbPool();
  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO profile_content_ratings
         (profile_id, content_type, content_id, rating, note, content_title, poster_image)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating),
         note = VALUES(note),
         content_title = VALUES(content_title),
         poster_image = VALUES(poster_image)`,
      [profileId, contentType, contentId, rating, note ?? null, contentTitle, posterImage],
    );

    const [rows] = await pool.execute<ContentRatingRow[]>(
      `SELECT * FROM profile_content_ratings
       WHERE profile_id = ? AND content_type = ? AND content_id = ?`,
      [profileId, contentType, contentId],
    );

    if (!rows.length) {
      throw new NotFoundError('Rating not found after upsert');
    }

    return transformContentRatingRow(rows[0]);
  } catch (error) {
    handleDatabaseError(error, 'upserting content rating');
  }
}

export async function getRatingsForProfile(profileId: number): Promise<ContentRating[]> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.execute<ContentRatingRow[]>(
      `SELECT * FROM profile_content_ratings WHERE profile_id = ? ORDER BY updated_at DESC`,
      [profileId],
    );
    return rows.map(transformContentRatingRow);
  } catch (error) {
    handleDatabaseError(error, 'getting ratings for profile');
  }
}

export async function getAggregateRatingsForContent(
  contentType: RatingContentType,
  contentId: number,
): Promise<AdminContentRatingSummary> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rating, COUNT(*) AS cnt FROM profile_content_ratings
       WHERE content_type = ? AND content_id = ? GROUP BY rating`,
      [contentType, contentId],
    );

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let weightedSum = 0;

    for (const row of rows) {
      const star = row.rating as 1 | 2 | 3 | 4 | 5;
      const cnt = Number(row.cnt);
      distribution[star] = cnt;
      total += cnt;
      weightedSum += star * cnt;
    }

    const averageRating = total > 0 ? Math.round((weightedSum / total) * 10) / 10 : 0;

    return { contentType, contentId, averageRating, ratingCount: total, distribution };
  } catch (error) {
    handleDatabaseError(error, 'getting aggregate ratings for content');
  }
}

export async function getAllRatings(filters?: {
  contentType?: RatingContentType;
  profileId?: number;
  accountId?: number;
}): Promise<AdminRatingWithProfile[]> {
  const pool = getDbPool();
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.contentType) {
      conditions.push('pcr.content_type = ?');
      params.push(filters.contentType);
    }
    if (filters?.profileId) {
      conditions.push('pcr.profile_id = ?');
      params.push(filters.profileId);
    }
    if (filters?.accountId) {
      conditions.push('p.account_id = ?');
      params.push(filters.accountId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pcr.id, pcr.profile_id, p.name AS profile_name, p.account_id,
              pcr.content_type, pcr.content_id, pcr.content_title, pcr.rating,
              pcr.note, pcr.created_at, pcr.updated_at
       FROM profile_content_ratings pcr
       JOIN profiles p ON pcr.profile_id = p.profile_id
       ${where}
       ORDER BY pcr.updated_at DESC`,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      profileName: row.profile_name,
      accountId: row.account_id,
      contentType: row.content_type,
      contentId: row.content_id,
      contentTitle: row.content_title,
      rating: row.rating,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    handleDatabaseError(error, 'getting all ratings with notes');
  }
}

export async function adminDeleteRating(ratingId: number): Promise<void> {
  const pool = getDbPool();
  try {
    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM profile_content_ratings WHERE id = ?`, [
      ratingId,
    ]);
    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError('Rating not found');
    }
  } catch (error) {
    handleDatabaseError(error, 'admin deleting content rating');
  }
}

export async function deleteRating(profileId: number, ratingId: number): Promise<void> {
  const pool = getDbPool();
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM profile_content_ratings WHERE id = ? AND profile_id = ?`,
      [ratingId, profileId],
    );

    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError('Rating not found or does not belong to this profile');
    }
  } catch (error) {
    handleDatabaseError(error, 'deleting content rating');
  }
}
