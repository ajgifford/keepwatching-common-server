import { z } from 'zod';

export const createPositiveIntegerSchema = (fieldName: string) =>
  z.string().transform((val, ctx) => {
    const num = Number(val);
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a number`,
      });
      return z.NEVER;
    }

    if (!Number.isInteger(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be an integer`,
      });
      return z.NEVER;
    }

    if (num <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a positive integer`,
      });
      return z.NEVER;
    }

    return num;
  });
