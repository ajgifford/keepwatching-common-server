import { createPositiveIntegerSchema } from './schemaUtil';
import { z } from 'zod';

export const upsertRatingBodySchema = z.object({
  contentType: z.enum(['show', 'movie']),
  contentId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(1000).nullable().optional(),
  contentTitle: z.string().min(1),
  posterImage: z.string().min(1),
});

export const sendRecommendationBodySchema = z.object({
  contentType: z.enum(['show', 'movie']),
  contentId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
});

export const communityRecommendationsQuerySchema = z.object({
  contentType: z.enum(['show', 'movie']).optional(),
});

export const ratingParamsSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
  ratingId: createPositiveIntegerSchema('Rating ID'),
});

export const ratingProfileParamsSchema = z.object({
  accountId: createPositiveIntegerSchema('Account ID'),
  profileId: createPositiveIntegerSchema('Profile ID'),
});

export const contentRecommendationDetailsParamsSchema = z.object({
  contentType: z.enum(['show', 'movie']),
  contentId: createPositiveIntegerSchema('Content ID'),
});

export type UpsertRatingBody = z.infer<typeof upsertRatingBodySchema>;
export type SendRecommendationBody = z.infer<typeof sendRecommendationBodySchema>;
export type CommunityRecommendationsQuery = z.infer<typeof communityRecommendationsQuerySchema>;
export type RatingParams = z.infer<typeof ratingParamsSchema>;
export type RatingProfileParams = z.infer<typeof ratingProfileParamsSchema>;
export type ContentRecommendationDetailsParams = z.infer<typeof contentRecommendationDetailsParamsSchema>;
