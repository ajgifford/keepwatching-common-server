import { z } from 'zod';

export const searchParamsSchema = z.object({
  searchString: z.string().min(1).max(100).trim(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  page: z.string().regex(/^\d+$/).optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;
