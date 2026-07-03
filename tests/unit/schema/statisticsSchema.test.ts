import { recapQuerySchema } from '@schema/statisticsSchema';

describe('statisticsSchema', () => {
  describe('recapQuerySchema', () => {
    it('should validate a valid year period', () => {
      const result = recapQuerySchema.safeParse({ period: 'year', year: '2026' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ period: 'year', year: 2026, month: undefined });
      }
    });

    it('should validate a valid month period', () => {
      const result = recapQuerySchema.safeParse({ period: 'month', year: '2026', month: '7' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ period: 'month', year: 2026, month: 7 });
      }
    });

    it('should reject an invalid period value', () => {
      const result = recapQuerySchema.safeParse({ period: 'week', year: '2026' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format() as any;
        expect(formattedErrors.period?._errors).toContain('Period must be either "month" or "year", received "week"');
      }
    });

    it('should reject a month period without a month value', () => {
      const result = recapQuerySchema.safeParse({ period: 'month', year: '2026' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format() as any;
        expect(formattedErrors.month?._errors).toContain('month is required when period is "month"');
      }
    });

    it('should reject a month value outside 1-12', () => {
      const result = recapQuerySchema.safeParse({ period: 'month', year: '2026', month: '13' });
      expect(result.success).toBe(false);
    });

    it('should reject a non-numeric year', () => {
      const result = recapQuerySchema.safeParse({ period: 'year', year: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});
