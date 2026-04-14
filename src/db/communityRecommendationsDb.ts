import { ConflictError, NoAffectedRowsError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import {
  AdminRecommendationWithProfile,
  CommunityRecommendation,
  ProfileRecommendation,
  RatingContentType,
  RecommendationDetail,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface ProfileRecommendationRow extends RowDataPacket {
  id: number;
  profile_id: number;
  content_type: RatingContentType;
  content_id: number;
  rating: number | null;
  message: string | null;
  created_at: string;
}

interface CommunityRecommendationRow extends RowDataPacket {
  id: number;
  content_type: RatingContentType;
  content_id: number;
  tmdb_id: number;
  content_title: string;
  poster_image: string;
  release_date: string;
  genres: string;
  average_rating: number | null;
  rating_count: number;
  message_count: number;
  recommendation_count: number;
  created_at: string;
}

interface RecommendationDetailRow extends RowDataPacket {
  profile_name: string;
  rating: number | null;
  message: string | null;
  created_at: string;
}

function transformProfileRecommendationRow(row: ProfileRecommendationRow): ProfileRecommendation {
  return {
    id: row.id,
    profileId: row.profile_id,
    contentType: row.content_type,
    contentId: row.content_id,
    rating: row.rating,
    message: row.message,
    createdAt: row.created_at,
  };
}

function transformCommunityRecommendationRow(row: CommunityRecommendationRow): CommunityRecommendation {
  return {
    id: row.id,
    contentType: row.content_type,
    contentId: row.content_id,
    tmdbId: row.tmdb_id,
    contentTitle: row.content_title,
    posterImage: row.poster_image,
    releaseDate: row.release_date,
    genres: row.genres,
    averageRating: row.average_rating !== null ? Math.round(row.average_rating * 10) / 10 : null,
    ratingCount: Number(row.rating_count),
    messageCount: Number(row.message_count),
    recommendationCount: row.recommendation_count,
    createdAt: row.created_at,
  };
}

export async function addRecommendation(
  profileId: number,
  contentType: RatingContentType,
  contentId: number,
  rating: number | null | undefined,
  message: string | null | undefined,
): Promise<ProfileRecommendation> {
  const pool = getDbPool();
  try {
    const [existing] = await pool.execute<ProfileRecommendationRow[]>(
      `SELECT id FROM profile_recommendations WHERE profile_id = ? AND content_type = ? AND content_id = ?`,
      [profileId, contentType, contentId],
    );

    if (existing.length > 0) {
      throw new ConflictError('This profile has already recommended this content');
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO profile_recommendations (profile_id, content_type, content_id, rating, message)
       VALUES (?, ?, ?, ?, ?)`,
      [profileId, contentType, contentId, rating ?? null, message ?? null],
    );

    const [rows] = await pool.execute<ProfileRecommendationRow[]>(
      `SELECT * FROM profile_recommendations WHERE id = ?`,
      [result.insertId],
    );

    return transformProfileRecommendationRow(rows[0]);
  } catch (error) {
    handleDatabaseError(error, 'adding community recommendation');
  }
}

export async function removeRecommendation(
  profileId: number,
  contentType: RatingContentType,
  contentId: number,
): Promise<void> {
  const pool = getDbPool();
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM profile_recommendations WHERE profile_id = ? AND content_type = ? AND content_id = ?`,
      [profileId, contentType, contentId],
    );

    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError('Recommendation not found for this profile and content');
    }
  } catch (error) {
    handleDatabaseError(error, 'removing community recommendation');
  }
}

export async function getRecommendationsForProfile(profileId: number): Promise<ProfileRecommendation[]> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.execute<ProfileRecommendationRow[]>(
      `SELECT * FROM profile_recommendations WHERE profile_id = ? ORDER BY created_at DESC`,
      [profileId],
    );
    return rows.map(transformProfileRecommendationRow);
  } catch (error) {
    handleDatabaseError(error, 'getting recommendations for profile');
  }
}

export async function getAllRecommendationsWithAttribution(filters?: {
  contentType?: RatingContentType;
  profileId?: number;
  accountId?: number;
}): Promise<AdminRecommendationWithProfile[]> {
  const pool = getDbPool();
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.contentType) {
      conditions.push('pr.content_type = ?');
      params.push(filters.contentType);
    }
    if (filters?.profileId) {
      conditions.push('pr.profile_id = ?');
      params.push(filters.profileId);
    }
    if (filters?.accountId) {
      conditions.push('p.account_id = ?');
      params.push(filters.accountId);
    }

    const showFilter = filters?.contentType && filters.contentType !== 'show' ? 'AND 1=0' : '';
    const movieFilter = filters?.contentType && filters.contentType !== 'movie' ? 'AND 1=0' : '';

    const showQuery = `
      SELECT
        pr.id, pr.profile_id, p.name AS profile_name, p.account_id,
        pr.content_type, pr.content_id, s.title AS content_title, s.poster_image,
        pr.rating, pr.message, pr.created_at,
        (SELECT COUNT(DISTINCT pr2.profile_id)
         FROM profile_recommendations pr2
         WHERE pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id) AS recommendation_count
      FROM profile_recommendations pr
      JOIN profiles p ON pr.profile_id = p.profile_id
      JOIN shows s ON pr.content_id = s.id
      WHERE pr.content_type = 'show' ${showFilter}`;

    const movieQuery = `
      SELECT
        pr.id, pr.profile_id, p.name AS profile_name, p.account_id,
        pr.content_type, pr.content_id, m.title AS content_title, m.poster_image,
        pr.rating, pr.message, pr.created_at,
        (SELECT COUNT(DISTINCT pr2.profile_id)
         FROM profile_recommendations pr2
         WHERE pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id) AS recommendation_count
      FROM profile_recommendations pr
      JOIN profiles p ON pr.profile_id = p.profile_id
      JOIN movies m ON pr.content_id = m.id
      WHERE pr.content_type = 'movie' ${movieFilter}`;

    let baseQuery: string;
    let baseParams: (string | number)[];

    if (filters?.contentType === 'show') {
      baseQuery = `${showQuery} ORDER BY pr.created_at DESC`;
      baseParams = [];
    } else if (filters?.contentType === 'movie') {
      baseQuery = `${movieQuery} ORDER BY pr.created_at DESC`;
      baseParams = [];
    } else {
      baseQuery = `(${showQuery}) UNION ALL (${movieQuery}) ORDER BY created_at DESC`;
      baseParams = [];
    }

    // Apply profileId / accountId filters by wrapping in a subquery
    let finalQuery: string;
    let finalParams: (string | number)[];

    if (filters?.profileId || filters?.accountId) {
      const outerConditions: string[] = [];
      const outerParams: (string | number)[] = [];
      if (filters?.profileId) {
        outerConditions.push('t.profile_id = ?');
        outerParams.push(filters.profileId);
      }
      if (filters?.accountId) {
        outerConditions.push('t.account_id = ?');
        outerParams.push(filters.accountId);
      }
      finalQuery = `SELECT * FROM (${baseQuery}) t WHERE ${outerConditions.join(' AND ')}`;
      finalParams = [...baseParams, ...outerParams];
    } else {
      finalQuery = baseQuery;
      finalParams = baseParams;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(finalQuery, finalParams);

    return rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      profileName: row.profile_name,
      accountId: row.account_id,
      contentType: row.content_type,
      contentId: row.content_id,
      contentTitle: row.content_title,
      posterImage: row.poster_image,
      rating: row.rating,
      message: row.message,
      recommendationCount: Number(row.recommendation_count),
      createdAt: row.created_at,
    }));
  } catch (error) {
    handleDatabaseError(error, 'getting all recommendations with attribution');
  }
}

export async function getTopRecommendedContent(
  contentType?: RatingContentType,
  limit = 10,
): Promise<CommunityRecommendation[]> {
  const pool = getDbPool();
  try {
    const showQuery = `
      SELECT
        MIN(pr.id) AS id, pr.content_type, pr.content_id, s.tmdb_id,
        s.title AS content_title, s.poster_image, s.release_date,
        (SELECT GROUP_CONCAT(DISTINCT g.genre ORDER BY g.genre SEPARATOR ', ')
         FROM show_genres sg JOIN genres g ON sg.genre_id = g.id
         WHERE sg.show_id = s.id) AS genres,
        AVG(pr.rating) AS average_rating,
        COUNT(DISTINCT CASE WHEN pr.rating IS NOT NULL THEN pr.profile_id END) AS rating_count,
        COUNT(DISTINCT CASE WHEN pr.message IS NOT NULL THEN pr.profile_id END) AS message_count,
        COUNT(DISTINCT pr2.profile_id) AS recommendation_count,
        MAX(pr.created_at) AS created_at
      FROM profile_recommendations pr
      JOIN profile_recommendations pr2
        ON pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id
      JOIN shows s ON pr.content_id = s.id
      WHERE pr.content_type = 'show'
      GROUP BY pr.content_type, pr.content_id, s.tmdb_id, s.title, s.poster_image, s.release_date`;

    const movieQuery = `
      SELECT
        MIN(pr.id) AS id, pr.content_type, pr.content_id, m.tmdb_id,
        m.title AS content_title, m.poster_image, m.release_date,
        (SELECT GROUP_CONCAT(DISTINCT g.genre ORDER BY g.genre SEPARATOR ', ')
         FROM movie_genres mg JOIN genres g ON mg.genre_id = g.id
         WHERE mg.movie_id = m.id) AS genres,
        AVG(pr.rating) AS average_rating,
        COUNT(DISTINCT CASE WHEN pr.rating IS NOT NULL THEN pr.profile_id END) AS rating_count,
        COUNT(DISTINCT CASE WHEN pr.message IS NOT NULL THEN pr.profile_id END) AS message_count,
        COUNT(DISTINCT pr2.profile_id) AS recommendation_count,
        MAX(pr.created_at) AS created_at
      FROM profile_recommendations pr
      JOIN profile_recommendations pr2
        ON pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id
      JOIN movies m ON pr.content_id = m.id
      WHERE pr.content_type = 'movie'
      GROUP BY pr.content_type, pr.content_id, m.tmdb_id, m.title, m.poster_image, m.release_date`;

    let query: string;
    if (contentType === 'show') {
      query = `${showQuery} ORDER BY recommendation_count DESC, created_at DESC LIMIT ?`;
    } else if (contentType === 'movie') {
      query = `${movieQuery} ORDER BY recommendation_count DESC, created_at DESC LIMIT ?`;
    } else {
      query = `(${showQuery}) UNION ALL (${movieQuery}) ORDER BY recommendation_count DESC, created_at DESC LIMIT ?`;
    }

    const [rows] = await pool.execute<CommunityRecommendationRow[]>(query, [limit]);
    return rows.map(transformCommunityRecommendationRow);
  } catch (error) {
    handleDatabaseError(error, 'getting top recommended content');
  }
}

export async function getRecommendationDetails(
  contentType: RatingContentType,
  contentId: number,
): Promise<RecommendationDetail[]> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.execute<RecommendationDetailRow[]>(
      `SELECT p.name AS profile_name, pr.rating, pr.message, pr.created_at
       FROM profile_recommendations pr
       JOIN profiles p ON pr.profile_id = p.profile_id
       WHERE pr.content_type = ? AND pr.content_id = ?
       ORDER BY pr.created_at DESC`,
      [contentType, contentId],
    );
    return rows.map((row) => ({
      profileName: row.profile_name,
      rating: row.rating,
      message: row.message,
      createdAt: row.created_at,
    }));
  } catch (error) {
    handleDatabaseError(error, 'getting recommendation details');
  }
}

export async function adminDeleteRecommendation(id: number): Promise<void> {
  const pool = getDbPool();
  try {
    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM profile_recommendations WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError('Recommendation not found');
    }
  } catch (error) {
    handleDatabaseError(error, 'admin deleting recommendation');
  }
}

export async function getCommunityRecommendations(contentType?: RatingContentType): Promise<CommunityRecommendation[]> {
  const pool = getDbPool();
  try {
    const showQuery = `
      SELECT
        MIN(pr.id)           AS id,
        pr.content_type,
        pr.content_id,
        s.tmdb_id,
        s.title              AS content_title,
        s.poster_image,
        s.release_date,
        (SELECT GROUP_CONCAT(DISTINCT g.genre ORDER BY g.genre SEPARATOR ', ')
         FROM show_genres sg JOIN genres g ON sg.genre_id = g.id
         WHERE sg.show_id = s.id) AS genres,
        AVG(pr.rating)       AS average_rating,
        COUNT(DISTINCT CASE WHEN pr.rating IS NOT NULL THEN pr.profile_id END) AS rating_count,
        COUNT(DISTINCT CASE WHEN pr.message IS NOT NULL THEN pr.profile_id END) AS message_count,
        COUNT(DISTINCT pr2.profile_id) AS recommendation_count,
        MAX(pr.created_at)   AS created_at
      FROM profile_recommendations pr
      JOIN profile_recommendations pr2
        ON pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id
      JOIN shows s ON pr.content_id = s.id
      WHERE pr.content_type = 'show'
      GROUP BY pr.content_type, pr.content_id, s.tmdb_id, s.title, s.poster_image, s.release_date
    `;

    const movieQuery = `
      SELECT
        MIN(pr.id)           AS id,
        pr.content_type,
        pr.content_id,
        m.tmdb_id,
        m.title              AS content_title,
        m.poster_image,
        m.release_date,
        (SELECT GROUP_CONCAT(DISTINCT g.genre ORDER BY g.genre SEPARATOR ', ')
         FROM movie_genres mg JOIN genres g ON mg.genre_id = g.id
         WHERE mg.movie_id = m.id) AS genres,
        AVG(pr.rating)       AS average_rating,
        COUNT(DISTINCT CASE WHEN pr.rating IS NOT NULL THEN pr.profile_id END) AS rating_count,
        COUNT(DISTINCT CASE WHEN pr.message IS NOT NULL THEN pr.profile_id END) AS message_count,
        COUNT(DISTINCT pr2.profile_id) AS recommendation_count,
        MAX(pr.created_at)   AS created_at
      FROM profile_recommendations pr
      JOIN profile_recommendations pr2
        ON pr2.content_type = pr.content_type AND pr2.content_id = pr.content_id
      JOIN movies m ON pr.content_id = m.id
      WHERE pr.content_type = 'movie'
      GROUP BY pr.content_type, pr.content_id, m.tmdb_id, m.title, m.poster_image, m.release_date
    `;

    let query: string;
    if (contentType === 'show') {
      query = `${showQuery} ORDER BY recommendation_count DESC, created_at DESC`;
    } else if (contentType === 'movie') {
      query = `${movieQuery} ORDER BY recommendation_count DESC, created_at DESC`;
    } else {
      query = `(${showQuery}) UNION ALL (${movieQuery}) ORDER BY recommendation_count DESC, created_at DESC`;
    }

    const [rows] = await pool.execute<CommunityRecommendationRow[]>(query);
    return rows.map(transformCommunityRecommendationRow);
  } catch (error) {
    handleDatabaseError(error, 'getting community recommendations');
  }
}
