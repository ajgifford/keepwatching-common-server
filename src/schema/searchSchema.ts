import { z } from 'zod';

export const searchQuerySchema = z.object({
  searchString: z.string().min(1).max(100).trim(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  page: z.coerce.number().int().positive().optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
