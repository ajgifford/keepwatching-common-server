import { z } from 'zod';

export const discoverTopQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    errorMap: (_issue, ctx) => ({ message: `Show type must be either "movie" or "series", received "${ctx.data}"` }),
  }),
  service: z.enum(['netflix', 'disney', 'hbo', 'apple', 'prime'], {
    errorMap: (_issue, ctx) => ({ message: `Invalid streaming service provided: "${ctx.data}"` }),
  }),
});

export const discoverChangesQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    errorMap: (_issue, ctx) => ({ message: `Show type must be either "movie" or "series", received "${ctx.data}"` }),
  }),
  service: z.enum(['netflix', 'disney', 'hbo', 'apple', 'prime'], {
    errorMap: (_issue, ctx) => ({ message: `Invalid streaming service provided: "${ctx.data}"` }),
  }),
  changeType: z.enum(['new', 'upcoming', 'expiring'], {
    errorMap: (_issue, ctx) => ({
      message: `Change type must be either "new", "upcoming" or "expiring", received "${ctx.data}"`,
    }),
  }),
});

export const discoverTrendingQuerySchema = z.object({
  showType: z.enum(['movie', 'series'], {
    errorMap: (_issue, ctx) => ({ message: `Show type must be either "movie" or "series", received "${ctx.data}"` }),
  }),
  page: z.string().regex(/^\d+$/, { message: 'Page must be a positive number' }).optional().default('1'),
});

export const discoverSimilarContentSchema = z.object({
  id: z.string().min(1).regex(/^\d+$/, { message: 'ID must be numeric' }),
});

export type DiscoverTopQuery = z.infer<typeof discoverTopQuerySchema>;
export type DiscoverChangesQuery = z.infer<typeof discoverChangesQuerySchema>;
export type DiscoverTrendingQuery = z.infer<typeof discoverTrendingQuerySchema>;
export type SimilarContentParams = z.infer<typeof discoverSimilarContentSchema>;
