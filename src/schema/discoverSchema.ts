import { z } from 'zod';

export const discoverTopQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    error: (issue) => `Show type must be either "movie" or "series", received "${issue.input}"`,
  }),
  service: z.enum(['netflix', 'disney', 'hbo', 'apple', 'prime'], {
    error: (issue) => `Invalid streaming service provided: "${issue.input}"`,
  }),
});

export const discoverChangesQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    error: (issue) => `Show type must be either "movie" or "series", received "${issue.input}"`,
  }),
  service: z.enum(['netflix', 'disney', 'hbo', 'apple', 'prime'], {
    error: (issue) => `Invalid streaming service provided: "${issue.input}"`,
  }),
  changeType: z.enum(['new', 'upcoming', 'expiring'], {
    error: (issue) => `Change type must be either "new", "upcoming" or "expiring", received "${issue.input}"`,
  }),
});

export const discoverTrendingQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    error: (issue) => `Show type must be either "movie" or "series", received "${issue.input}"`,
  }),
  page: z.coerce.number().int().positive().default(1),
});

export const discoverSimilarContentSchema = z.object({
  id: z.string().min(1).regex(/^\d+$/, { message: 'ID must be numeric' }),
});

export type DiscoverTopQuery = z.infer<typeof discoverTopQuerySchema>;
export type DiscoverChangesQuery = z.infer<typeof discoverChangesQuerySchema>;
export type DiscoverTrendingQuery = z.infer<typeof discoverTrendingQuerySchema>;
export type SimilarContentParams = z.infer<typeof discoverSimilarContentSchema>;
