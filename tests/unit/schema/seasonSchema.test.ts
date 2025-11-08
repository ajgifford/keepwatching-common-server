import { seasonWatchStatusBodySchema } from '@schema/seasonSchema';
import { describe, expect, it } from 'vitest';

describe('seasonSchema', () => {
  describe('seasonWatchStatusSchema', () => {
    it('should validate valid season watch status object', () => {
      const validInput = {
        seasonId: 789,
        status: 'WATCHED',
      };

      const result = seasonWatchStatusBodySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          seasonId: 789,
          status,
        };

        const result = seasonWatchStatusBodySchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        seasonId: 789,
        status: 'COMPLETED',
      };

      const result = seasonWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be either NOT_WATCHED or WATCHED');
      }
    });

    it('should reject non-positive season ID', () => {
      const invalidInput = {
        seasonId: 0,
        status: 'WATCHED',
      };

      const result = seasonWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.seasonId?._errors).toContain('Season ID must be a positive integer');
      }
    });

    it('should reject non-integer season ID', () => {
      const invalidInput = {
        seasonId: 789.5,
        status: 'WATCHED',
      };

      const result = seasonWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Expected integer, received float');
      }
    });

    it('should reject missing required fields', () => {
      let result = seasonWatchStatusBodySchema.safeParse({
        status: 'WATCHED',
      });
      expect(result.success).toBe(false);

      result = seasonWatchStatusBodySchema.safeParse({
        seasonId: 789,
      });
      expect(result.success).toBe(false);
    });
  });
});
