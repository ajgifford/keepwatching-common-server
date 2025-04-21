import { episodeWatchStatusSchema, nextEpisodeWatchStatusSchema } from '@schema/episodeSchema';

describe('episodeSchema', () => {
  describe('episodeWatchStatusSchema', () => {
    it('should validate valid episode watch status object', () => {
      const validInput = {
        episodeId: 123,
        status: 'WATCHED',
      };

      const result = episodeWatchStatusSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'WATCHING', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          episodeId: 123,
          status,
        };

        const result = episodeWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        episodeId: 123,
        status: 'INVALID_STATUS',
      };

      const result = episodeWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be one of: WATCHED, WATCHING, or NOT_WATCHED');
      }
    });

    it('should reject non-positive episode ID', () => {
      const invalidInput = {
        episodeId: 0,
        status: 'WATCHED',
      };

      const result = episodeWatchStatusSchema.safeParse(invalidInput);
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

      const result = episodeWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.episodeId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject missing fields', () => {
      let result = episodeWatchStatusSchema.safeParse({
        status: 'WATCHED',
      });
      expect(result.success).toBe(false);

      result = episodeWatchStatusSchema.safeParse({
        episodeId: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('nextEpisodeWatchStatusSchema', () => {
    it('should validate valid next episode watch status object', () => {
      const validInput = {
        showId: 456,
        seasonId: 789,
        episodeId: 123,
        status: 'WATCHED',
      };

      const result = nextEpisodeWatchStatusSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'WATCHING', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          showId: 456,
          seasonId: 789,
          episodeId: 123,
          status,
        };

        const result = nextEpisodeWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        showId: 456,
        seasonId: 789,
        episodeId: 123,
        status: 'INVALID_STATUS',
      };

      const result = nextEpisodeWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be one of: WATCHED, WATCHING, or NOT_WATCHED');
      }
    });

    it('should reject non-positive IDs', () => {
      const testCases = [
        { field: 'showId', value: 0 },
        { field: 'seasonId', value: -1 },
        { field: 'episodeId', value: -5 },
      ];

      testCases.forEach(({ field, value }) => {
        const input = {
          showId: 456,
          seasonId: 789,
          episodeId: 123,
          status: 'WATCHED',
          [field]: value,
        };

        const result = nextEpisodeWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.issues[0].message;
          expect(errorMessage).toContain('must be a positive integer');
        }
      });
    });

    it('should reject non-integer IDs', () => {
      const testCases = [
        { field: 'showId', value: 456.7 },
        { field: 'seasonId', value: 789.1 },
        { field: 'episodeId', value: 123.4 },
      ];

      testCases.forEach(({ field, value }) => {
        const input = {
          showId: 456,
          seasonId: 789,
          episodeId: 123,
          status: 'WATCHED',
          [field]: value,
        };

        const result = nextEpisodeWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.issues[0].message;
          expect(errorMessage).toContain('Expected integer, received float');
        }
      });
    });

    it('should reject missing fields', () => {
      const requiredFields = ['showId', 'seasonId', 'episodeId', 'status'];

      requiredFields.forEach((field) => {
        const validInput = {
          showId: 456,
          seasonId: 789,
          episodeId: 123,
          status: 'WATCHED',
        };

        const incompleteInput: Record<string, any> = { ...validInput };
        delete incompleteInput[field];

        const result = nextEpisodeWatchStatusSchema.safeParse(incompleteInput);
        expect(result.success).toBe(false);
      });
    });
  });
});
