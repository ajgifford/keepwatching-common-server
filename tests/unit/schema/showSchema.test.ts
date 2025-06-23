import { addShowFavoriteBodySchema, showParamsSchema, showWatchStatusBodySchema } from '@schema/showSchema';

describe('showSchema', () => {
  describe('addShowFavoriteSchema', () => {
    it('should validate valid show favorite object', () => {
      const validInput = {
        showTMDBId: 456,
      };

      const expectedOutput = {
        showTMDBId: 456,
      };

      const result = addShowFavoriteBodySchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(expectedOutput);
      }
    });

    it('should reject non-positive show ID', () => {
      const invalidInput = {
        showTMDBId: 0,
      };

      const result = addShowFavoriteBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Show TMDB ID must be a positive integer');
      }
    });

    it('should reject non-integer show ID', () => {
      const invalidInput = {
        showTMDBId: 456.7,
      };

      const result = addShowFavoriteBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showTMDBId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject missing show ID', () => {
      const result = addShowFavoriteBodySchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('showTMDBId');
      }
    });
  });

  describe('showParamsSchema', () => {
    it('should validate valid show params object', () => {
      const validInput = {
        accountId: '1',
        profileId: '123',
        showId: '456',
      };

      const expectedOutput = {
        accountId: 1,
        profileId: 123,
        showId: 456,
      };

      const result = showParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(expectedOutput);
      }
    });

    it('should reject non-numeric IDs', () => {
      const testCases = [
        { field: 'accountId', value: 'abc' },
        { field: 'profileId', value: 'xyz' },
        { field: 'showId', value: 'notANumber' },
      ];

      testCases.forEach(({ field, value }) => {
        const input = {
          accountId: '1',
          profileId: '123',
          showId: '456',
          [field]: value,
        };

        const result = showParamsSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.issues[0].message;
          expect(errorMessage).toContain('must be a number');
        }
      });
    });

    it('should accept string number values', () => {
      const validInput = {
        accountId: '1',
        profileId: '123',
        showId: '456',
      };

      const result = showParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const requiredFields = ['accountId', 'profileId', 'showId'];

      requiredFields.forEach((field) => {
        const validInput = {
          accountId: '1',
          profileId: '123',
          showId: '456',
        };

        const incompleteInput: Record<string, any> = { ...validInput };
        delete incompleteInput[field];

        const result = showParamsSchema.safeParse(incompleteInput);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('showWatchStatusSchema', () => {
    it('should validate valid show watch status object', () => {
      const validInput = {
        showId: 456,
        status: 'WATCHED',
      };

      const result = showWatchStatusBodySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          showId: 456,
          status,
        };

        const result = showWatchStatusBodySchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        showId: 456,
        status: 'FINISHED',
      };

      const result = showWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be either NOT_WATCHED or WATCHED');
      }
    });

    it('should reject non-positive show ID', () => {
      const invalidInput = {
        showId: 0,
        status: 'WATCHED',
      };

      const result = showWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showId?._errors).toContain('Show ID must be a positive integer');
      }
    });

    it('should reject non-integer show ID', () => {
      const invalidInput = {
        showId: 456.7,
        status: 'WATCHED',
      };

      const result = showWatchStatusBodySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject missing required fields', () => {
      let result = showWatchStatusBodySchema.safeParse({
        status: 'WATCHED',
      });
      expect(result.success).toBe(false);

      result = showWatchStatusBodySchema.safeParse({
        showId: 456,
      });
      expect(result.success).toBe(false);
    });
  });
});
