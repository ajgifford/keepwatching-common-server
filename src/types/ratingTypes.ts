import {
  CommunityRecommendation,
  ContentRating,
  ProfileRecommendation,
  RatingContentType,
  RecommendationDetail,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ProfileRecommendationRow extends RowDataPacket {
  id: number;
  profile_id: number;
  content_type: RatingContentType;
  content_id: number;
  rating: number | null;
  message: string | null;
  created_at: string;
}

export function transformProfileRecommendationRow(row: ProfileRecommendationRow): ProfileRecommendation {
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

export interface CommunityRecommendationRow extends RowDataPacket {
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

export function transformCommunityRecommendationRow(row: CommunityRecommendationRow): CommunityRecommendation {
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

export interface RecommendationDetailRow extends RowDataPacket {
  profile_name: string;
  rating: number | null;
  message: string | null;
  created_at: string;
}

export function transformRecommendationDetailRow(row: RecommendationDetailRow): RecommendationDetail {
  return {
    profileName: row.profile_name,
    rating: row.rating,
    message: row.message,
    createdAt: row.created_at,
  };
}

export interface ContentRatingRow extends RowDataPacket {
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

export function transformContentRatingRow(row: ContentRatingRow): ContentRating {
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
