import { seasonWatchStatusBodySchema } from '@schema/seasonSchema';

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
      const statuses = ['WATCHED', 'WATCHING', 'NOT_WATCHED', 'UP_TO_DATE'];

      statuses.forEach((status) => {
        const input = {
          seasonId: 789,
          status,
        };

        const result = seasonWatchStatusBodySchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should handle optional recursive flag', () => {
      let result = seasonWatchStatusBodySchema.safeParse({
        seasonId: 789,
        status: 'WATCHED',
      });
      expect(result.success).toBe(true);

      result = seasonWatchStatusBodySchema.safeParse({
        seasonId: 789,
        status: 'WATCHED',
        recursive: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recursive).toBe(true);
      }
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
        expect(formattedErrors.status?._errors).toContain(
          'Status must be one of: NOT_WATCHED, WATCHING, WATCHED, or UP_TO_DATE',
        );
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

    it('should reject non-boolean recursive flag', () => {
      const invalidInput = {
        seasonId: 789,
        status: 'WATCHED',
        recursive: 'yes',
      };

      const result = seasonWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('recursive');
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
