import { episodeWatchStatusBodySchema } from '@schema/episodeSchema';

describe('episodeSchema', () => {
  describe('episodeWatchStatusBodySchema', () => {
    it('should validate valid episode watch status object', () => {
      const validInput = {
        episodeId: 123,
        status: 'WATCHED',
      };

      const result = episodeWatchStatusBodySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          episodeId: 123,
          status,
        };

        const result = episodeWatchStatusBodySchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        episodeId: 123,
        status: 'INVALID_STATUS',
      };

      const result = episodeWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be either NOT_WATCHED or WATCHED');
      }
    });

    it('should reject non-positive episode ID', () => {
      const invalidInput = {
        episodeId: 0,
        status: 'WATCHED',
      };

      const result = episodeWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.episodeId?._errors).toContain('Episode ID must be a positive integer');
      }
    });

    it('should reject non-integer episode ID', () => {
      const invalidInput = {
        episodeId: 123.45,
        status: 'WATCHED',
      };

      const result = episodeWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.episodeId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject missing fields', () => {
      let result = episodeWatchStatusBodySchema.safeParse({
        status: 'WATCHED',
      });
      expect(result.success).toBe(false);

      result = episodeWatchStatusBodySchema.safeParse({
        episodeId: 123,
      });
      expect(result.success).toBe(false);
    });
  });
});
